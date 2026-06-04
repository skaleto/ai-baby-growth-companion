#!/usr/bin/env bash
#
# restore-app-data.sh — REQ-OPS-002 restore of a backup produced by backup-app-data.sh.
#
# SAFETY MODEL (mirrors deploy's SYNC_DATA=0 default)
#   Restores into a NEW target directory and REFUSES to overwrite a non-empty target by
#   default. It never touches the live production data dir unless you point RESTORE_DIR at
#   it AND pass FORCE=1 — deliberately awkward, so a drill can't clobber real family data.
#
# WHAT IT RESTORES (DB + media + app_state consistency)
#   <backup>/db/baby-companion.sqlite  -> <RESTORE_DIR>/baby-companion.sqlite
#                                         (this DB holds ALL app_state: careLogs / albumItems /
#                                          growthMeasurements / reminders / chat / etc.)
#   <backup>/media/                    -> <RESTORE_DIR>/  (uploads/, auth/, mobile-updates/ incl. manifest.json)
#   After copying, the restored DB is checkpointed-clean (a .backup snapshot has no WAL),
#   then verified with PRAGMA integrity_check.
#
# USAGE
#   scripts/restore-app-data.sh <backup-dir>
#   scripts/restore-app-data.sh <backup-dir> <restore-dir>
#   RESTORE_DIR=/tmp/restore-check scripts/restore-app-data.sh backups/20260605T....Z
#
#   Bring the restored data dir live (NOT done automatically — outside this script's scope):
#     sudo systemctl stop  ai-baby-growth-companion
#     sudo rsync -a <restore-dir>/ /var/lib/ai-baby-growth-companion/
#     sudo systemctl start ai-baby-growth-companion
#   The service reads APP_DATA_DIR (see deploy-aliyun-ecs.sh); point it at the restored dir
#   or rsync the restored dir over the live one while the service is stopped.
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

SQLITE_BIN="${SQLITE_BIN:-sqlite3}"
FORCE="${FORCE:-0}"

BACKUP_DIR="${1:-${BACKUP_DIR:-}}"
RESTORE_DIR="${2:-${RESTORE_DIR:-}}"

usage() {
  cat <<EOF
Usage:
  scripts/restore-app-data.sh <backup-dir> [restore-dir]

Restores a backup-app-data.sh snapshot (DB + media + app_state) into a NEW directory and
verifies it with PRAGMA integrity_check. Refuses to overwrite a non-empty target unless FORCE=1.

Arguments / env:
  <backup-dir>   Path to a backups/<UTC-timestamp>/ directory (must contain db/baby-companion.sqlite).
  [restore-dir]  Target data dir to create. Default: <backup-dir>/restored
  RESTORE_DIR=   Same as positional restore-dir.
  FORCE=0        Set 1 to allow restoring into a non-empty target (use with care).
  SQLITE_BIN=$SQLITE_BIN
EOF
}

if [[ "${BACKUP_DIR:-}" == "-h" || "${BACKUP_DIR:-}" == "--help" || -z "${BACKUP_DIR:-}" ]]; then
  usage
  [[ -z "${BACKUP_DIR:-}" ]] && exit 1 || exit 0
fi

log() { printf '[restore] %s\n' "$*"; }
die() { printf '[restore][error] %s\n' "$*" >&2; exit 1; }

size_h() {
  local target="$1"
  [[ -e "$target" ]] || { echo "0B (missing)"; return; }
  du -sh "$target" 2>/dev/null | awk '{print $1}'
}
now_s() { date -u +%s; }

command -v "$SQLITE_BIN" >/dev/null 2>&1 || die "sqlite3 not found (set SQLITE_BIN)"
command -v rsync >/dev/null 2>&1 || die "rsync not found"

# normalize backup dir
BACKUP_DIR="$(cd "$BACKUP_DIR" 2>/dev/null && pwd || true)"
[[ -n "$BACKUP_DIR" && -d "$BACKUP_DIR" ]] || die "backup dir not found: ${1:-$BACKUP_DIR}"

SRC_DB="$BACKUP_DIR/db/baby-companion.sqlite"
SRC_MEDIA="$BACKUP_DIR/media"
[[ -f "$SRC_DB" ]] || die "backup is missing db/baby-companion.sqlite: $SRC_DB"

# verify the SOURCE snapshot before we trust it
log "Verifying source snapshot integrity..."
SRC_INTEGRITY="$("$SQLITE_BIN" "$SRC_DB" "PRAGMA integrity_check;" 2>&1 || true)"
[[ "$SRC_INTEGRITY" == "ok" ]] || die "source snapshot failed integrity_check: $SRC_INTEGRITY"

# default restore target lives under the backup dir (never the prod dir)
RESTORE_DIR="${RESTORE_DIR:-$BACKUP_DIR/restored}"

# safety: refuse to clobber a non-empty existing target unless FORCE=1
if [[ -e "$RESTORE_DIR" ]]; then
  if [[ -n "$(ls -A "$RESTORE_DIR" 2>/dev/null)" && "$FORCE" != "1" ]]; then
    die "restore target is not empty: $RESTORE_DIR
     Refusing to overwrite (safe default, like deploy SYNC_DATA=0).
     Choose an empty/new target, or re-run with FORCE=1 to override."
  fi
fi
mkdir -p "$RESTORE_DIR"
RESTORE_DIR="$(cd "$RESTORE_DIR" && pwd)"
log "Restoring into: $RESTORE_DIR"

start_s="$(now_s)"

# --- 1. restore DB -----------------------------------------------------------
# Copy the snapshot in as the live db name. The snapshot is self-contained (no WAL sidecar),
# so a plain copy is consistent here.
log "Restoring DB -> $RESTORE_DIR/baby-companion.sqlite"
cp "$SRC_DB" "$RESTORE_DIR/baby-companion.sqlite"

# --- 2. restore media / auth / mobile-updates --------------------------------
if [[ -d "$SRC_MEDIA" ]]; then
  log "Restoring media + auth + mobile-updates from $SRC_MEDIA"
  rsync -a "$SRC_MEDIA"/ "$RESTORE_DIR"/
else
  log "No media/ dir in backup — DB-only restore."
fi

end_s="$(now_s)"
restore_secs=$(( end_s - start_s ))

# --- 3. verify the restored DB -----------------------------------------------
log "Verifying restored DB with PRAGMA integrity_check..."
RESTORED_INTEGRITY="$("$SQLITE_BIN" "$RESTORE_DIR/baby-companion.sqlite" "PRAGMA integrity_check;" 2>&1 || true)"
RESTORED_FK="$("$SQLITE_BIN" "$RESTORE_DIR/baby-companion.sqlite" "PRAGMA foreign_key_check;" 2>&1 || true)"
RESTORED_TABLES="$("$SQLITE_BIN" "$RESTORE_DIR/baby-companion.sqlite" "SELECT count(*) FROM sqlite_master WHERE type='table';" 2>&1 || true)"

DB_SIZE_H="$(size_h "$RESTORE_DIR/baby-companion.sqlite")"
MEDIA_SIZE_H="$(size_h "$RESTORE_DIR/uploads")"

echo
log "==================== restore summary ===================="
echo "backup_dir:          $BACKUP_DIR"
echo "restore_dir:         $RESTORE_DIR"
echo "restored_db_size:    $DB_SIZE_H"
echo "restored_uploads:    $MEDIA_SIZE_H"
echo "restored_tables:     $RESTORED_TABLES"
echo "restore_seconds:     $restore_secs"
echo "integrity_check:     $RESTORED_INTEGRITY"
echo "foreign_key_check:   $([[ -z "$RESTORED_FK" ]] && echo 'ok (no violations)' || echo "$RESTORED_FK")"
log "========================================================="

[[ "$RESTORED_INTEGRITY" == "ok" ]] || die "restored DB failed integrity_check: $RESTORED_INTEGRITY"

log "Restore complete and verified: $RESTORE_DIR"
log "To go live, stop the service and rsync this dir into APP_DATA_DIR (see header notes)."
