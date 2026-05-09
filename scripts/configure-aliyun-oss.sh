#!/usr/bin/env bash
set -euo pipefail

ECS_HOST="${ECS_HOST:-${1:-}}"
ECS_USER="${ECS_USER:-root}"
ECS_PORT="${ECS_PORT:-22}"
SSH_KEY="${SSH_KEY:-}"
REMOTE_CONFIG_DIR="${REMOTE_CONFIG_DIR:-/etc/ai-baby-growth-companion}"
REMOTE_USER="${REMOTE_USER:-babyapp}"
ALIYUN_OSS_ACCESS_KEY_ID="${ALIYUN_OSS_ACCESS_KEY_ID:-}"
ALIYUN_OSS_ACCESS_KEY_SECRET="${ALIYUN_OSS_ACCESS_KEY_SECRET:-}"

usage() {
  cat <<EOF
Usage:
  ECS_HOST=<public-ip> \\
  SSH_KEY=/path/to/key \\
  ALIYUN_OSS_ACCESS_KEY_ID=... \\
  ALIYUN_OSS_ACCESS_KEY_SECRET=... \\
  scripts/configure-aliyun-oss.sh

Writes:
  ${REMOTE_CONFIG_DIR}/aliyun_oss_access_key_id
  ${REMOTE_CONFIG_DIR}/aliyun_oss_access_key_secret
EOF
}

if [[ "$ECS_HOST" == "-h" || "$ECS_HOST" == "--help" ]]; then
  usage
  exit 0
fi

if [[ -z "$ECS_HOST" || -z "$ALIYUN_OSS_ACCESS_KEY_ID" || -z "$ALIYUN_OSS_ACCESS_KEY_SECRET" ]]; then
  usage
  exit 1
fi

ssh_args=(-p "$ECS_PORT")
if [[ -n "$SSH_KEY" ]]; then
  ssh_args+=(-i "$SSH_KEY")
fi

write_remote_secret() {
  local value="$1"
  local filename="$2"

  printf '%s' "$value" | ssh "${ssh_args[@]}" "$ECS_USER@$ECS_HOST" \
    "REMOTE_CONFIG_DIR='$REMOTE_CONFIG_DIR' REMOTE_USER='$REMOTE_USER' FILENAME='$filename' bash -c 'set -euo pipefail
if [[ \"\$(id -u)\" -eq 0 ]]; then SUDO=\"\"; else SUDO=\"sudo\"; fi
\$SUDO install -d -m 750 -o root -g \"\$REMOTE_USER\" \"\$REMOTE_CONFIG_DIR\"
tmp=\"\$(mktemp)\"
cat > \"\$tmp\"
\$SUDO install -m 640 -o root -g \"\$REMOTE_USER\" \"\$tmp\" \"\$REMOTE_CONFIG_DIR/\$FILENAME\"
rm -f \"\$tmp\"'"
}

write_remote_secret "$ALIYUN_OSS_ACCESS_KEY_ID" "aliyun_oss_access_key_id"
write_remote_secret "$ALIYUN_OSS_ACCESS_KEY_SECRET" "aliyun_oss_access_key_secret"

echo "OSS access key files were written to $ECS_HOST:$REMOTE_CONFIG_DIR"
