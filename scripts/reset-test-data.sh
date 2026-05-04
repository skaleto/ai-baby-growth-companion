#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

TARGET="${1:-${RESET_TARGET:-}}"
LOCAL_PORT="${LOCAL_PORT:-8080}"
LOCAL_DATA_DIR="${LOCAL_DATA_DIR:-$BACKEND_DIR/data}"
LOCAL_SCREEN_NAME="${LOCAL_SCREEN_NAME:-baby-backend}"
LOCAL_BACKEND_LOG="${LOCAL_BACKEND_LOG:-$BACKEND_DIR/backend.log}"
ANDROID_STUDIO_JBR="${ANDROID_STUDIO_JBR:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
SERVICE_NAME="${SERVICE_NAME:-ai-baby-growth-companion}"
DEPLOY_PORT="${DEPLOY_PORT:-8300}"
ECS_HOST="${ECS_HOST:-8.210.235.155}"
ECS_USER="${ECS_USER:-root}"
ECS_PORT="${ECS_PORT:-22}"
SSH_KEY="${SSH_KEY:-/Users/bytedance/.ssh/ai_baby_aliyun}"
REMOTE_DATA_DIR="${REMOTE_DATA_DIR:-/var/lib/ai-baby-growth-companion}"
REMOTE_USER="${REMOTE_USER:-babyapp}"
INVITE_CODE_COUNT="${INVITE_CODE_COUNT:-5}"
SKIP_RESTART="${SKIP_RESTART:-0}"

usage() {
  cat <<EOF
Usage:
  scripts/reset-test-data.sh local
  scripts/reset-test-data.sh cloud

Options:
  LOCAL_DATA_DIR=$LOCAL_DATA_DIR
  LOCAL_PORT=$LOCAL_PORT
  ECS_HOST=$ECS_HOST
  SSH_KEY=$SSH_KEY
  DEPLOY_PORT=$DEPLOY_PORT
  REMOTE_DATA_DIR=$REMOTE_DATA_DIR
  INVITE_CODE_COUNT=$INVITE_CODE_COUNT
  SKIP_RESTART=0

This deletes app persistent test data only:
  - SQLite database and extra tables
  - uploaded attachments
  - auth sessions, JWT secret, invite-code DB state
  - generated reports/backups under the app data directory

It does not delete source code, built JAR/APK files, or model API key files
under /etc/ai-baby-growth-companion.
EOF
}

log() {
  printf '[reset-test-data] %s\n' "$*"
}

die() {
  printf '[reset-test-data] ERROR: %s\n' "$*" >&2
  exit 1
}

ensure_safe_data_dir() {
  local dir="$1"
  [[ -n "$dir" ]] || die "data directory is empty"
  [[ "$dir" != "/" ]] || die "refusing to reset /"
  case "$dir" in
    */ai-baby-growth-companion|*/ai-baby-growth-companion/*|*/backend/data|*/backend/backend/data)
      ;;
    *)
      die "refusing to reset unexpected data directory: $dir"
      ;;
  esac
}

random_code() {
  if command -v openssl >/dev/null 2>&1; then
    local hex
    hex="$(openssl rand -hex 4)"
    printf '%06d\n' "$((0x$hex % 1000000))"
  else
    printf '%06d\n' "$(((RANDOM * 31 + RANDOM) % 1000000))"
  fi
}

write_invite_codes() {
  local data_dir="$1"
  local file="$data_dir/auth/invite_codes"
  local tmp="$file.tmp"

  mkdir -p "$data_dir/auth"
  {
    printf '# 小宝成长伙伴测试邀请码，一行一个。\n'
    printf '# reset-test-data.sh 于 %s 重新生成。\n' "$(date '+%Y-%m-%d %H:%M:%S %z')"
    local count=0
    local code
    while [[ "$count" -lt "$INVITE_CODE_COUNT" ]]; do
      code="$(random_code)"
      if ! grep -q "^${code}$" "$tmp" 2>/dev/null; then
        printf '%s\n' "$code"
        count="$((count + 1))"
      fi
    done
  } >"$tmp"
  mv "$tmp" "$file"
  chmod 600 "$file"
}

find_backend_jar() {
  find "$BACKEND_DIR/target" -maxdepth 1 -type f -name 'baby-companion-backend-*.jar' ! -name '*.original' 2>/dev/null | sort | tail -n 1
}

java_major_version() {
  local java_bin="$1"
  local version
  version="$("$java_bin" -version 2>&1 | awk -F\" '/version/ {print $2; exit}')"
  if [[ "$version" == 1.* ]]; then
    echo "$version" | cut -d. -f2
  else
    echo "$version" | cut -d. -f1
  fi
}

resolve_java_bin() {
  local candidates=()
  if [[ -n "${JAVA_HOME:-}" ]]; then
    candidates+=("$JAVA_HOME/bin/java")
  fi
  candidates+=("$ANDROID_STUDIO_JBR/bin/java")
  if command -v /usr/libexec/java_home >/dev/null 2>&1; then
    local java_home
    java_home="$(/usr/libexec/java_home -v 17 2>/dev/null || true)"
    if [[ -n "$java_home" ]]; then
      candidates+=("$java_home/bin/java")
    fi
  fi
  if command -v java >/dev/null 2>&1; then
    candidates+=("$(command -v java)")
  fi

  local candidate
  for candidate in "${candidates[@]}"; do
    [[ -x "$candidate" ]] || continue
    local major
    major="$(java_major_version "$candidate" || echo 0)"
    if [[ "$major" =~ ^[0-9]+$ && "$major" -ge 17 ]]; then
      echo "$candidate"
      return 0
    fi
  done

  die "Java 17+ not found. Set JAVA_HOME or ANDROID_STUDIO_JBR."
}

stop_local_backend() {
  if command -v screen >/dev/null 2>&1; then
    while read -r session; do
      [[ -n "$session" ]] || continue
      log "Stopping local screen session $session"
      screen -S "$session" -X quit || true
    done < <(screen -ls 2>/dev/null | awk -v name=".$LOCAL_SCREEN_NAME" '$1 ~ name {print $1}')
  fi

  if command -v lsof >/dev/null 2>&1; then
    while read -r pid; do
      [[ -n "$pid" ]] || continue
      local command_line
      command_line="$(ps -p "$pid" -o command= 2>/dev/null || true)"
      if [[ "$command_line" == *baby-companion-backend* || "$command_line" == *"$BACKEND_DIR"* ]]; then
        log "Stopping local backend process $pid"
        kill "$pid" || true
      fi
    done < <(lsof -tiTCP:"$LOCAL_PORT" -sTCP:LISTEN 2>/dev/null || true)
  fi
}

wait_for_health() {
  local url="$1"
  local label="$2"
  for attempt in {1..45}; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      log "$label is healthy: $url"
      return 0
    fi
    sleep 1
  done
  return 1
}

start_local_backend() {
  [[ "$SKIP_RESTART" != "1" ]] || return 0

  local jar
  local java_bin
  jar="$(find_backend_jar)"
  [[ -n "$jar" && -f "$jar" ]] || die "backend JAR not found. Build it first with: cd backend && mvn -DskipTests package"
  java_bin="$(resolve_java_bin)"

  log "Starting local backend on port $LOCAL_PORT"
  screen -dmS "$LOCAL_SCREEN_NAME" bash -lc "
    cd '$BACKEND_DIR'
    PORT='$LOCAL_PORT' \
    APP_DATA_DIR='$LOCAL_DATA_DIR' \
    AUTH_JWT_SECRET_FILE='$LOCAL_DATA_DIR/auth/jwt_secret' \
    AUTH_INVITE_CODES_FILE='$LOCAL_DATA_DIR/auth/invite_codes' \
    '$java_bin' -jar '$jar' > '$LOCAL_BACKEND_LOG' 2>&1
  "

  if ! wait_for_health "http://localhost:${LOCAL_PORT}/api/health" "Local backend"; then
    tail -n 120 "$LOCAL_BACKEND_LOG" >&2 || true
    die "local backend did not become healthy"
  fi
}

reset_local() {
  LOCAL_DATA_DIR="$(cd "$(dirname "$LOCAL_DATA_DIR")" && pwd)/$(basename "$LOCAL_DATA_DIR")"
  ensure_safe_data_dir "$LOCAL_DATA_DIR"

  log "Resetting local app data at $LOCAL_DATA_DIR"
  stop_local_backend
  rm -rf "$LOCAL_DATA_DIR"
  mkdir -p "$LOCAL_DATA_DIR/auth"
  chmod 700 "$LOCAL_DATA_DIR/auth"
  write_invite_codes "$LOCAL_DATA_DIR"
  rm -rf "$BACKEND_DIR/backend/data"
  start_local_backend

  log "Local invite codes file: $LOCAL_DATA_DIR/auth/invite_codes"
}

ssh_args() {
  local args=(-p "$ECS_PORT")
  if [[ -n "$SSH_KEY" ]]; then
    args+=(-i "$SSH_KEY")
  fi
  printf '%q ' "${args[@]}"
}

reset_cloud() {
  ensure_safe_data_dir "$REMOTE_DATA_DIR"
  [[ -n "$ECS_HOST" ]] || die "ECS_HOST is required for cloud reset"

  local ssh_options
  ssh_options="$(ssh_args)"

  log "Resetting cloud app data on $ECS_USER@$ECS_HOST:$REMOTE_DATA_DIR"
  ssh -p "$ECS_PORT" ${SSH_KEY:+-i "$SSH_KEY"} "$ECS_USER@$ECS_HOST" \
    "SERVICE_NAME='$SERVICE_NAME' REMOTE_DATA_DIR='$REMOTE_DATA_DIR' REMOTE_USER='$REMOTE_USER' INVITE_CODE_COUNT='$INVITE_CODE_COUNT' SKIP_RESTART='$SKIP_RESTART' bash -s" <<'REMOTE_RESET'
set -euo pipefail

if [[ "$(id -u)" -eq 0 ]]; then
  SUDO=""
else
  SUDO="sudo"
fi

die() {
  printf '[reset-test-data] ERROR: %s\n' "$*" >&2
  exit 1
}

ensure_safe_data_dir() {
  local dir="$1"
  [[ -n "$dir" ]] || die "data directory is empty"
  [[ "$dir" != "/" ]] || die "refusing to reset /"
  case "$dir" in
    */ai-baby-growth-companion|*/ai-baby-growth-companion/*)
      ;;
    *)
      die "refusing to reset unexpected data directory: $dir"
      ;;
  esac
}

random_code() {
  if command -v openssl >/dev/null 2>&1; then
    local hex
    hex="$(openssl rand -hex 4)"
    printf '%06d\n' "$((0x$hex % 1000000))"
  else
    printf '%06d\n' "$(((RANDOM * 31 + RANDOM) % 1000000))"
  fi
}

write_invite_codes() {
  local data_dir="$1"
  local file="$data_dir/auth/invite_codes"
  local tmp="$file.tmp"
  $SUDO mkdir -p "$data_dir/auth"
  {
    printf '# 小宝成长伙伴测试邀请码，一行一个。\n'
    printf '# reset-test-data.sh 于 %s 重新生成。\n' "$(date '+%Y-%m-%d %H:%M:%S %z')"
    count=0
    while [[ "$count" -lt "$INVITE_CODE_COUNT" ]]; do
      code="$(random_code)"
      if ! grep -q "^${code}$" "$tmp" 2>/dev/null; then
        printf '%s\n' "$code"
        count="$((count + 1))"
      fi
    done
  } | $SUDO tee "$tmp" >/dev/null
  $SUDO mv "$tmp" "$file"
  $SUDO chmod 600 "$file"
}

ensure_safe_data_dir "$REMOTE_DATA_DIR"
$SUDO systemctl stop "$SERVICE_NAME" || true
$SUDO rm -rf "$REMOTE_DATA_DIR"
$SUDO mkdir -p "$REMOTE_DATA_DIR/auth"
write_invite_codes "$REMOTE_DATA_DIR"
$SUDO chown -R "$REMOTE_USER:$REMOTE_USER" "$REMOTE_DATA_DIR"
$SUDO chmod 700 "$REMOTE_DATA_DIR/auth"
$SUDO chmod 600 "$REMOTE_DATA_DIR/auth/invite_codes"
if [[ "$SKIP_RESTART" != "1" ]]; then
  $SUDO systemctl start "$SERVICE_NAME"
fi
printf '[reset-test-data] Cloud invite codes file: %s/auth/invite_codes\n' "$REMOTE_DATA_DIR"
REMOTE_RESET

  if [[ "$SKIP_RESTART" != "1" ]]; then
    if ! wait_for_health "http://${ECS_HOST}:${DEPLOY_PORT}/api/health" "Cloud backend"; then
      ssh -p "$ECS_PORT" ${SSH_KEY:+-i "$SSH_KEY"} "$ECS_USER@$ECS_HOST" "journalctl -u '$SERVICE_NAME' -n 120 --no-pager" >&2 || true
      die "cloud backend did not become healthy"
    fi
  fi

  log "Cloud invite codes file: $REMOTE_DATA_DIR/auth/invite_codes"
  log "Read it with: ssh -p $ECS_PORT ${SSH_KEY:+-i $SSH_KEY }$ECS_USER@$ECS_HOST 'cat $REMOTE_DATA_DIR/auth/invite_codes'"
  : "$ssh_options"
}

case "$TARGET" in
  local)
    reset_local
    ;;
  cloud)
    reset_cloud
    ;;
  -h|--help|"")
    usage
    [[ -n "$TARGET" ]] || exit 1
    ;;
  *)
    usage
    die "unknown target: $TARGET"
    ;;
esac
