#!/usr/bin/env bash
# 部署最小监控 + 每日备份调度到 ECS（REQ-OPS-004/002, R1）。
# 把 monitor.sh + backup-app-data.sh 安装到 ECS，并配置 cron:
#   - monitor 每 15 分钟（5xx / 磁盘 / 备份新鲜度）
#   - backup 每日 03:30
# 告警出口由 ALERT_WEBHOOK_URL 提供（钉钉/飞书自定义机器人）；为空则监控只写日志、可日后补。
#
# 用法:
#   SSH_KEY=~/.ssh/ai_baby_aliyun ALERT_WEBHOOK_URL='https://oapi.dingtalk.com/robot/send?access_token=...' \
#     ALERT_WEBHOOK_TYPE=dingtalk scripts/install-monitoring.sh
set -euo pipefail

ECS_HOST="${ECS_HOST:-120.55.188.242}"
ECS_USER="${ECS_USER:-root}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/ai_baby_aliyun}"
REMOTE_BIN="${REMOTE_BIN:-/opt/ai-baby-growth-companion}"
DATA_DIR="${DATA_DIR:-/var/lib/ai-baby-growth-companion}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/ai-baby-growth-companion}"
ALERT_WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"
ALERT_WEBHOOK_TYPE="${ALERT_WEBHOOK_TYPE:-dingtalk}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Installing monitoring + backup cron on ${ECS_USER}@${ECS_HOST}"
[[ -n "$ALERT_WEBHOOK_URL" ]] && echo "  alert webhook: ${ALERT_WEBHOOK_TYPE} (configured)" || echo "  alert webhook: (none — monitor will log only)"

scp -i "$SSH_KEY" -o BatchMode=yes "$ROOT_DIR/scripts/monitor.sh" "${ECS_USER}@${ECS_HOST}:${REMOTE_BIN}/monitor.sh"
scp -i "$SSH_KEY" -o BatchMode=yes "$ROOT_DIR/scripts/backup-app-data.sh" "${ECS_USER}@${ECS_HOST}:${REMOTE_BIN}/backup-app-data.sh"

ssh -i "$SSH_KEY" -o BatchMode=yes "${ECS_USER}@${ECS_HOST}" \
  "REMOTE_BIN='$REMOTE_BIN' DATA_DIR='$DATA_DIR' BACKUP_ROOT='$BACKUP_ROOT' ALERT_WEBHOOK_URL='$ALERT_WEBHOOK_URL' ALERT_WEBHOOK_TYPE='$ALERT_WEBHOOK_TYPE' bash -s" <<'REMOTE'
set -euo pipefail
chmod +x "$REMOTE_BIN/monitor.sh" "$REMOTE_BIN/backup-app-data.sh"
mkdir -p "$BACKUP_ROOT"

# 重建 cron：先剔除旧的同名任务行，再写入最新的
CRON_TMP="$(mktemp)"
crontab -l 2>/dev/null | grep -vE "monitor\.sh|backup-app-data\.sh" > "$CRON_TMP" || true
echo "*/15 * * * * ALERT_WEBHOOK_URL='$ALERT_WEBHOOK_URL' ALERT_WEBHOOK_TYPE='$ALERT_WEBHOOK_TYPE' DATA_DIR='$DATA_DIR' BACKUP_ROOT='$BACKUP_ROOT' $REMOTE_BIN/monitor.sh" >> "$CRON_TMP"
echo "30 3 * * * DATA_DIR='$DATA_DIR' BACKUP_ROOT='$BACKUP_ROOT' $REMOTE_BIN/backup-app-data.sh >> /var/log/baby-backup.log 2>&1" >> "$CRON_TMP"
crontab "$CRON_TMP"
rm -f "$CRON_TMP"

echo "已安装 cron:"
crontab -l | grep -E "monitor|backup" || true
echo "先跑一次备份（种下首个备份，避免监控首次误报无备份）:"
DATA_DIR="$DATA_DIR" BACKUP_ROOT="$BACKUP_ROOT" bash "$REMOTE_BIN/backup-app-data.sh" >> /var/log/baby-backup.log 2>&1 \
  && echo "  backup ok" || echo "  backup 首跑有问题，见 /var/log/baby-backup.log"
echo "立即跑一次 monitor (smoke):"
ALERT_WEBHOOK_URL="$ALERT_WEBHOOK_URL" ALERT_WEBHOOK_TYPE="$ALERT_WEBHOOK_TYPE" DATA_DIR="$DATA_DIR" BACKUP_ROOT="$BACKUP_ROOT" bash "$REMOTE_BIN/monitor.sh" || true
tail -3 /var/log/baby-monitor.log 2>/dev/null || true
REMOTE

echo "Done. 监控每 15 分钟、备份每日 03:30。ALERT_WEBHOOK_URL 为空时监控仅写 /var/log/baby-monitor.log，可日后重跑本脚本补 webhook。"
