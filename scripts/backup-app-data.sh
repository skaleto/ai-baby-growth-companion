#!/usr/bin/env bash
#
# backup-app-data.sh — REQ-OPS-002 consistent backup of the baby-companion app data.
#
# WHAT IT BACKS UP (DB + media + app_state consistency)
#   The app keeps ALL structured app_state (careLogs / albumItems / growthMeasurements /
#   reminders / chat / agent runs / pending_effect / ...) inside the SQLite database
#   (backend/data/baby-companion.sqlite), which runs in WAL mode. A plain `cp` of a WAL
#   database is NOT consistent (recent commits live in the -wal sidecar until checkpoint),
#   so this script uses sqlite3's online ".backup" API to produce a single, transaction-
#   consistent snapshot without locking the live writer.
#
#   Media + secrets + OTA bundles live as files under the data dir:
#     <data-dir>/uploads/          local attachment files + thumbnails (when APP_STORAGE_MODE=local)
#     <data-dir>/auth/             jwt_secret, invite_codes
#     <data-dir>/mobile-updates/   OTA bundles + manifest.json
#   These are copied separately (rsync) so DB and media are independent restore units.
#   When APP_STORAGE_MODE=oss the attachment bytes live in OSS, not on disk — back those up
#   via OSS versioning / lifecycle (see notes below); this script still captures the DB
#   (which holds the OSS object keys) plus any residual local files.
#
# OUTPUT LAYOUT
#   backups/<UTC-timestamp>/
#     db/baby-companion.sqlite     consistent .backup snapshot (integrity-checked)
#     media/                       rsync mirror of media/auth/mobile-updates (live SQLite excluded)
#     MANIFEST.txt                 sizes, durations, integrity-check result, source paths
#
# USAGE
#   scripts/backup-app-data.sh                 # back up the local backend/data
#   DB_PATH=/path/baby-companion.sqlite scripts/backup-app-data.sh
#   DATA_DIR=/var/lib/ai-baby-growth-companion scripts/backup-app-data.sh
#   BACKUP_ROOT=/mnt/backups scripts/backup-app-data.sh
#
#   Remote (ECS) parameters are OPTIONAL and NOT required — the default is fully local.
#   To pull a remote ECS data dir down first, set ECS_HOST (and optionally ECS_USER /
#   SSH_KEY / REMOTE_DATA_DIR); the script will rsync it to a local staging dir, then
#   back that up. Without ECS_HOST nothing remote is touched.
#
# CRON / RETENTION (recommended — wire up on the host, not in this repo)
#   Daily at 03:30 server time:
#     30 3 * * *  cd /opt/ai-baby-growth-companion && DATA_DIR=/var/lib/ai-baby-growth-companion \
#                 BACKUP_ROOT=/var/backups/ai-baby-growth-companion \
#                 scripts/backup-app-data.sh >> /var/log/baby-backup.log 2>&1
#
#   Retention policy (REQ-OPS-002): keep 7 daily / 30 weekly / 90 monthly snapshots.
#   Each run writes a self-contained backups/<UTC-timestamp>/ dir; prune old ones with a
#   companion cron (example — adjust to taste; uses mtime-based GFS pruning):
#     # delete daily snapshots older than 7 days, except Sundays (weekly) and the 1st (monthly)
#     find "$BACKUP_ROOT" -maxdepth 1 -type d -name '20*' -mtime +7 \
#       \! -newermt "$(date -d 'last sunday' +%F)" -print
#   For production prefer object storage with native lifecycle rules; for OSS-stored media
#   enable Bucket Versioning + a lifecycle policy instead of relying on file copies.
#   `scripts/deploy-aliyun-ecs.sh` should call this script before each deploy so every
#   release is preceded by a DB snapshot.
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

# --- configuration (all overridable via env) ---------------------------------
DATA_DIR="${DATA_DIR:-$BACKEND_DIR/data}"
DB_PATH="${DB_PATH:-$DATA_DIR/baby-companion.sqlite}"
BACKUP_ROOT="${BACKUP_ROOT:-$ROOT_DIR/backups}"
SQLITE_BIN="${SQLITE_BIN:-sqlite3}"

# Optional remote pull (default: purely local — nothing remote is touched).
ECS_HOST="${ECS_HOST:-}"
ECS_USER="${ECS_USER:-root}"
ECS_PORT="${ECS_PORT:-22}"
SSH_KEY="${SSH_KEY:-}"
REMOTE_DATA_DIR="${REMOTE_DATA_DIR:-/var/lib/ai-baby-growth-companion}"

usage() {
  cat <<EOF
Usage:
  scripts/backup-app-data.sh

Creates a consistent snapshot of the SQLite DB (online .backup, WAL-safe) plus media
files under backups/<UTC-timestamp>/, then verifies the snapshot with PRAGMA integrity_check.

Options (env vars):
  DATA_DIR=$DATA_DIR
  DB_PATH=$DB_PATH
  BACKUP_ROOT=$BACKUP_ROOT
  SQLITE_BIN=$SQLITE_BIN
  ECS_HOST=        Optional. If set, rsync the remote data dir down first, then back it up.
  ECS_USER=$ECS_USER
  ECS_PORT=$ECS_PORT
  SSH_KEY=         Optional private key for the remote pull.
  REMOTE_DATA_DIR=$REMOTE_DATA_DIR
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

log() { printf '[backup] %s\n' "$*"; }
die() { printf '[backup][error] %s\n' "$*" >&2; exit 1; }

# human-readable byte size for a file or directory (portable: macOS + Linux)
size_h() {
  local target="$1"
  [[ -e "$target" ]] || { echo "0B (missing)"; return; }
  if du -sh "$target" >/dev/null 2>&1; then
    du -sh "$target" | awk '{print $1}'
  else
    echo "?"
  fi
}
size_bytes() {
  local target="$1"
  [[ -e "$target" ]] || { echo 0; return; }
  # -s gives KB blocks on both platforms; multiply for an approximate byte count
  local kb
  kb="$(du -sk "$target" 2>/dev/null | awk '{print $1}')"
  echo $(( ${kb:-0} * 1024 ))
}

command -v "$SQLITE_BIN" >/dev/null 2>&1 || die "sqlite3 not found (set SQLITE_BIN). On Debian/Ubuntu: apt-get install -y sqlite3"
command -v rsync >/dev/null 2>&1 || die "rsync not found"

# --- optional: pull remote ECS data dir to a local staging area --------------
if [[ -n "$ECS_HOST" ]]; then
  ssh_args=( -p "$ECS_PORT" -o BatchMode=yes -o StrictHostKeyChecking=accept-new )
  [[ -n "$SSH_KEY" ]] && ssh_args+=( -i "$SSH_KEY" )
  STAGING_DIR="$(mktemp -d "${TMPDIR:-/tmp}/baby-backup-staging.XXXXXX")"
  trap 'rm -rf "$STAGING_DIR"' EXIT
  log "Pulling remote data dir $ECS_USER@$ECS_HOST:$REMOTE_DATA_DIR -> $STAGING_DIR"
  rsync -az -e "ssh ${ssh_args[*]}" "$ECS_USER@$ECS_HOST:$REMOTE_DATA_DIR/" "$STAGING_DIR/"
  DATA_DIR="$STAGING_DIR"
  DB_PATH="$STAGING_DIR/baby-companion.sqlite"
fi

[[ -f "$DB_PATH" ]] || die "SQLite DB not found at: $DB_PATH"

# --- prepare destination -----------------------------------------------------
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST_DIR="$BACKUP_ROOT/$STAMP"
DB_DEST_DIR="$DEST_DIR/db"
MEDIA_DEST_DIR="$DEST_DIR/media"
DB_DEST="$DB_DEST_DIR/baby-companion.sqlite"
MANIFEST="$DEST_DIR/MANIFEST.txt"

mkdir -p "$DB_DEST_DIR" "$MEDIA_DEST_DIR"
log "Backup destination: $DEST_DIR"

# epoch seconds (whole seconds is plenty for ops timing and portable)
now_s() { date -u +%s; }

# --- 1. consistent online DB backup (WAL-safe, no lock) ----------------------
log "Running online .backup of $DB_PATH (WAL-safe, no write lock)..."
db_start="$(now_s)"
# .backup uses the SQLite Online Backup API: a consistent snapshot even with concurrent
# writers, and it correctly folds in any uncommitted-to-main WAL frames.
"$SQLITE_BIN" "$DB_PATH" ".backup '$DB_DEST'"
db_end="$(now_s)"
db_secs=$(( db_end - db_start ))
[[ -f "$DB_DEST" ]] || die ".backup did not produce $DB_DEST"

# --- 2. verify the snapshot --------------------------------------------------
log "Verifying snapshot with PRAGMA integrity_check..."
ic_start="$(now_s)"
INTEGRITY="$("$SQLITE_BIN" "$DB_DEST" "PRAGMA integrity_check;" 2>&1 || true)"
ic_end="$(now_s)"
ic_secs=$(( ic_end - ic_start ))

# also run a foreign_key_check (cheap extra consistency signal)
FK_CHECK="$("$SQLITE_BIN" "$DB_DEST" "PRAGMA foreign_key_check;" 2>&1 || true)"

INTEGRITY_OK="no"
[[ "$INTEGRITY" == "ok" ]] && INTEGRITY_OK="yes"

# --- 3. media / auth / mobile-updates copy (DB excluded — handled above) ------
log "Copying media + auth + mobile-updates from $DATA_DIR (excluding live SQLite files)..."
media_start="$(now_s)"
# Exclude the live SQLite db + its WAL/SHM sidecars: the DB is captured consistently above.
rsync -a \
  --exclude 'baby-companion.sqlite' \
  --exclude 'baby-companion.sqlite-wal' \
  --exclude 'baby-companion.sqlite-shm' \
  --exclude 'baby-companion.sqlite-journal' \
  "$DATA_DIR"/ "$MEDIA_DEST_DIR"/
media_end="$(now_s)"
media_secs=$(( media_end - media_start ))

# --- 4. sizes ----------------------------------------------------------------
DB_SIZE_H="$(size_h "$DB_DEST")"
DB_SIZE_B="$(size_bytes "$DB_DEST")"
MEDIA_SIZE_H="$(size_h "$MEDIA_DEST_DIR")"
MEDIA_SIZE_B="$(size_bytes "$MEDIA_DEST_DIR")"
UPLOADS_SIZE_H="$(size_h "$MEDIA_DEST_DIR/uploads")"
TOTAL_SECS=$(( db_secs + ic_secs + media_secs ))

# --- 5. manifest -------------------------------------------------------------
{
  echo "baby-companion app data backup"
  echo "timestamp_utc:        $STAMP"
  echo "host:                 $(hostname 2>/dev/null || echo unknown)"
  echo "source_data_dir:      $DATA_DIR"
  echo "source_db:            $DB_PATH"
  [[ -n "$ECS_HOST" ]] && echo "remote_source:        $ECS_USER@$ECS_HOST:$REMOTE_DATA_DIR"
  echo "sqlite_version:       $("$SQLITE_BIN" --version 2>/dev/null | awk '{print $1}')"
  echo
  echo "db_snapshot:          $DB_DEST"
  echo "db_size:              $DB_SIZE_H ($DB_SIZE_B bytes)"
  echo "db_backup_seconds:    $db_secs"
  echo "integrity_check:      $INTEGRITY"
  echo "integrity_ok:         $INTEGRITY_OK"
  echo "integrity_seconds:    $ic_secs"
  echo "foreign_key_check:    $([[ -z "$FK_CHECK" ]] && echo 'ok (no violations)' || echo "$FK_CHECK")"
  echo
  echo "media_dir:            $MEDIA_DEST_DIR"
  echo "media_size:           $MEDIA_SIZE_H ($MEDIA_SIZE_B bytes)"
  echo "uploads_size:         $UPLOADS_SIZE_H"
  echo "media_copy_seconds:   $media_secs"
  echo
  echo "total_seconds:        $TOTAL_SECS"
} > "$MANIFEST"

# --- 6. report ---------------------------------------------------------------
echo
log "==================== backup summary ===================="
cat "$MANIFEST"
log "========================================================"

if [[ "$INTEGRITY_OK" != "yes" ]]; then
  die "integrity_check did NOT return ok — snapshot may be corrupt. See $MANIFEST"
fi

log "Backup complete and verified: $DEST_DIR"
