#!/usr/bin/env bash
# 批量生成 Pro 内测兑换码，插入生产 redeem_code 表，并打印生成的码供运营分发。
# 用户在 App「我的」页输入码即可自助开通 Pro，无需人工审批。
# 沿用 seed-internal-pro-entitlements.sh 的 SSH + sqlite 风格。
#
# 用法：
#   COUNT=20 MAX_USES=1 EXPIRES_DAYS=30 PLAN_CODE=internal-trial \
#     SSH_KEY=~/.ssh/ai_baby_aliyun scripts/seed-redeem-codes.sh
#
# 默认：生成 20 个一次性码（max_uses=1），30 天兑换有效期，planCode=internal-trial。
# 幂等：撞到已存在的码会跳过（code 唯一约束）。表不存在时自动建（与后端 DDL 一致）。
set -euo pipefail

ECS_HOST="${ECS_HOST:-120.55.188.242}"
ECS_USER="${ECS_USER:-root}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/ai_baby_aliyun}"
REMOTE_DB="${REMOTE_DB:-/var/lib/ai-baby-growth-companion/baby-companion.sqlite}"
COUNT="${COUNT:-20}"
MAX_USES="${MAX_USES:-1}"
EXPIRES_DAYS="${EXPIRES_DAYS:-30}"
PLAN_CODE="${PLAN_CODE:-internal-trial}"
NOTE="${NOTE:-batch redeem codes}"

echo "Generating ${COUNT} redeem codes on ${ECS_USER}@${ECS_HOST}"
echo "  DB:          ${REMOTE_DB}"
echo "  planCode:    ${PLAN_CODE}"
echo "  maxUses:     ${MAX_USES}"
echo "  expiresDays: ${EXPIRES_DAYS}"

ssh -i "$SSH_KEY" -o BatchMode=yes -o ConnectTimeout=15 "${ECS_USER}@${ECS_HOST}" \
  "DB='${REMOTE_DB}' COUNT='${COUNT}' MAX_USES='${MAX_USES}' EXPIRES_DAYS='${EXPIRES_DAYS}' PLAN_CODE='${PLAN_CODE}' NOTE='${NOTE}' python3 - <<'PY'
import os, sqlite3, uuid, secrets, string, datetime
db = os.environ['DB']
count = int(os.environ['COUNT'])
max_uses = int(os.environ['MAX_USES'])
expires_days = int(os.environ['EXPIRES_DAYS'])
plan = os.environ['PLAN_CODE']
note = os.environ['NOTE']
now = datetime.datetime.now(datetime.timezone.utc)
now_iso = now.isoformat()
expires_iso = (now + datetime.timedelta(days=expires_days)).isoformat() if expires_days > 0 else None
alphabet = string.ascii_uppercase + string.digits

def gen():
    raw = ''.join(secrets.choice(alphabet) for _ in range(12))
    return 'XB-' + raw[0:4] + '-' + raw[4:8] + '-' + raw[8:12]

con = sqlite3.connect(db)
cur = con.cursor()
cur.execute('''
    CREATE TABLE IF NOT EXISTS redeem_code (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      plan_code TEXT,
      expires_at TEXT,
      max_uses INTEGER,
      used_count INTEGER,
      note TEXT,
      created_at TEXT,
      updated_at TEXT
    )
''')
made = []
for _ in range(count):
    code = gen()
    try:
        cur.execute(
            'INSERT INTO redeem_code (id, code, plan_code, expires_at, max_uses, used_count, note, created_at, updated_at) '
            'VALUES (?,?,?,?,?,?,?,?,?)',
            ('redeem-' + str(uuid.uuid4()), code, plan, expires_iso, max_uses, 0, note, now_iso, now_iso),
        )
        made.append(code)
    except sqlite3.IntegrityError:
        pass  # 极少数撞码，跳过
con.commit()
con.close()
print('Generated', len(made), 'codes (planCode=%s, maxUses=%d, expiresDays=%d):' % (plan, max_uses, expires_days))
for c in made:
    print(' ', c)
PY"
