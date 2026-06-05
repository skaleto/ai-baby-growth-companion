#!/usr/bin/env bash
# 最小监控告警（REQ-OPS-004 子集, R1）。在 ECS host 上由 cron 每 15 分钟运行一次，检查:
#   1. 最近窗口内 5xx 比例
#   2. 数据盘使用率
#   3. 最近一次备份的新鲜度
# 命中阈值则发钉钉/飞书自定义机器人 webhook（ALERT_WEBHOOK_URL 为空时仅写日志，不报错）。
#
# 用法（cron）:
#   */15 * * * * ALERT_WEBHOOK_URL='https://...' ALERT_WEBHOOK_TYPE=dingtalk /opt/ai-baby-growth-companion/monitor.sh
set -uo pipefail

SERVICE="${SERVICE:-ai-baby-growth-companion}"
DATA_DIR="${DATA_DIR:-/var/lib/ai-baby-growth-companion}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/ai-baby-growth-companion}"
WINDOW="${WINDOW:-15 min ago}"
DISK_THRESHOLD="${DISK_THRESHOLD:-80}"
ERROR_RATE_THRESHOLD="${ERROR_RATE_THRESHOLD:-5}"
MIN_REQUESTS="${MIN_REQUESTS:-20}"
BACKUP_MAX_AGE_HOURS="${BACKUP_MAX_AGE_HOURS:-26}"
ALERT_WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"
ALERT_WEBHOOK_TYPE="${ALERT_WEBHOOK_TYPE:-dingtalk}"
LOG="${MONITOR_LOG:-/var/log/baby-monitor.log}"

alerts=()

# 1. 5xx 比例（RequestLoggingFilter 在 5xx 时记 ERROR + status=5xx）
total=$(journalctl -u "$SERVICE" --since "$WINDOW" --no-pager 2>/dev/null | grep -cE "status=[0-9]" || true)
errors=$(journalctl -u "$SERVICE" --since "$WINDOW" --no-pager 2>/dev/null | grep -cE "status=5[0-9][0-9]" || true)
rate=0
if [[ "${total:-0}" -ge "$MIN_REQUESTS" && "${errors:-0}" -gt 0 ]]; then
  rate=$(( errors * 100 / total ))
  if [[ "$rate" -ge "$ERROR_RATE_THRESHOLD" ]]; then
    alerts+=("5xx 比例 ${rate}% (${errors}/${total}) ≥ ${ERROR_RATE_THRESHOLD}%")
  fi
fi

# 2. 数据盘使用率
disk=$(df --output=pcent "$DATA_DIR" 2>/dev/null | tail -1 | tr -dc '0-9')
if [[ -n "$disk" && "$disk" -ge "$DISK_THRESHOLD" ]]; then
  alerts+=("磁盘使用率 ${disk}% ≥ ${DISK_THRESHOLD}% ($DATA_DIR)")
fi

# 3. 备份新鲜度
age_h="?"
latest=$(ls -dt "$BACKUP_ROOT"/*/ 2>/dev/null | head -1)
if [[ -z "$latest" ]]; then
  alerts+=("未找到任何备份目录 ($BACKUP_ROOT)")
else
  age_h=$(( ( $(date +%s) - $(stat -c %Y "$latest") ) / 3600 ))
  if [[ "$age_h" -gt "$BACKUP_MAX_AGE_HOURS" ]]; then
    alerts+=("最近备份距今 ${age_h}h > ${BACKUP_MAX_AGE_HOURS}h")
  fi
fi

ts=$(date '+%Y-%m-%d %H:%M:%S')
mkdir -p "$(dirname "$LOG")" 2>/dev/null || true

if [[ "${#alerts[@]}" -eq 0 ]]; then
  echo "[$ts] OK (5xx ${errors:-0}/${total:-0}=${rate}%, disk ${disk:-?}%, backup ${age_h}h)" >> "$LOG"
  exit 0
fi

summary=$(printf '%s; ' "${alerts[@]}")
echo "[$ts] ALERT: ${summary}" >> "$LOG"

if [[ -z "$ALERT_WEBHOOK_URL" ]]; then
  echo "[$ts] (ALERT_WEBHOOK_URL 未配置，仅写日志)" >> "$LOG"
  exit 0
fi

text="⚠️ 小宝记后端告警 [$ts]"
for a in "${alerts[@]}"; do text="${text}
- ${a}"; done
# 转义换行与引号供 JSON 使用
json_text=$(printf '%s' "$text" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')

if [[ "$ALERT_WEBHOOK_TYPE" == "feishu" ]]; then
  payload="{\"msg_type\":\"text\",\"content\":{\"text\":${json_text}}}"
else
  payload="{\"msgtype\":\"text\",\"text\":{\"content\":${json_text}}}"
fi

if curl -s -m 10 -X POST "$ALERT_WEBHOOK_URL" -H 'Content-Type: application/json' -d "$payload" >/dev/null 2>&1; then
  echo "[$ts] alert webhook sent (${ALERT_WEBHOOK_TYPE})" >> "$LOG"
else
  echo "[$ts] alert webhook FAILED" >> "$LOG"
fi
