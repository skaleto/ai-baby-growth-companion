#!/usr/bin/env bash
# 部署独立管理后台到 ECS:8400(systemd: ai-baby-admin)。与主后端进程隔离,共享同一 SQLite。
# 用法: ECS_HOST=120.55.188.242 SSH_KEY=~/.ssh/ai_baby_aliyun bash scripts/deploy-admin.sh
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ECS_HOST="${ECS_HOST:-${1:-120.55.188.242}}"
ECS_USER="${ECS_USER:-root}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/ai_baby_aliyun}"
APP_DIR="${REMOTE_ADMIN_DIR:-/opt/ai-baby-admin}"
CONFIG_DIR="${REMOTE_CONFIG_DIR:-/etc/ai-baby-growth-companion}"
DB_PATH="${REMOTE_DB:-/var/lib/ai-baby-growth-companion/baby-companion.sqlite}"
PORT="${ADMIN_PORT:-8400}"
ADMIN_PHONES="${ADMIN_PHONES:-18915618653}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-123456}"
SSH=(ssh -i "$SSH_KEY" -o BatchMode=yes -o ConnectTimeout=20 "${ECS_USER}@${ECS_HOST}")

echo "Deploying admin to ${ECS_USER}@${ECS_HOST}:${PORT}"

# 1) 装 Node 20(若缺;better-sqlite3 有 linux-x64 预编译)
"${SSH[@]}" 'command -v node >/dev/null 2>&1 || (curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs)'

# 2) 同步代码(排除 node_modules)
"${SSH[@]}" "mkdir -p '$APP_DIR' '$CONFIG_DIR'"
rsync -az --delete -e "ssh -i $SSH_KEY -o BatchMode=yes" \
  --exclude node_modules --exclude .gitignore --exclude web \
  "$ROOT_DIR/admin/" "${ECS_USER}@${ECS_HOST}:$APP_DIR/"

# 3) 装依赖(better-sqlite3 走 linux-x64 预编译)
"${SSH[@]}" "cd '$APP_DIR' && npm ci --omit=dev"

# 4) 写 env(若不存在则用默认;已存在则保留,不覆盖既有密钥)
"${SSH[@]}" "test -f '$CONFIG_DIR/admin.env' || cat > '$CONFIG_DIR/admin.env' <<EOF
ADMIN_PORT=$PORT
ADMIN_DB_PATH=$DB_PATH
ADMIN_PHONES=$ADMIN_PHONES
ADMIN_PASSWORD=$ADMIN_PASSWORD
ADMIN_TOKEN_SECRET=$(openssl rand -hex 32)
EOF
chmod 600 '$CONFIG_DIR/admin.env'"

# 5) systemd 单元
"${SSH[@]}" "cat > /etc/systemd/system/ai-baby-admin.service <<EOF
[Unit]
Description=AI Baby Admin Backend
After=network.target
[Service]
Type=simple
WorkingDirectory=$APP_DIR
EnvironmentFile=$CONFIG_DIR/admin.env
ExecStart=/usr/bin/node $APP_DIR/server.mjs
Restart=on-failure
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload && systemctl enable --now ai-baby-admin && systemctl restart ai-baby-admin"

# 6) 健康检查
echo "Waiting for health..."
for i in $(seq 1 15); do
  if "${SSH[@]}" "curl -fsS http://127.0.0.1:$PORT/admin-api/health" >/dev/null 2>&1; then
    echo "Admin healthy: http://${ECS_HOST}:${PORT}/"; break; fi; sleep 2; done

echo "提醒:在阿里云安全组放行 ${PORT} 端口才能从公网访问。"
echo "默认登录:手机号 ${ADMIN_PHONES%%,*} / 密码 ${ADMIN_PASSWORD}(请尽快改 ${CONFIG_DIR}/admin.env 的 ADMIN_PASSWORD)。"
