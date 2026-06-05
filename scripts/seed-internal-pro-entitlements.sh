#!/usr/bin/env bash
# R1 (REQ-PRO-001): 启用 Pro entitlement gating 前，给生产现有家庭种"内测" entitlement，
# 避免现有内测家庭的今日小结 / 图片视频理解被突然切断。
#
# 幂等：已有 entitlement 的家庭跳过，可安全重复执行。
# 新注册家庭默认 **无** Pro，需后续单独审批（这正是 gating 的意义）。
#
# 用法：
#   SSH_KEY=~/.ssh/ai_baby_aliyun scripts/seed-internal-pro-entitlements.sh
set -euo pipefail

ECS_HOST="${ECS_HOST:-120.55.188.242}"
ECS_USER="${ECS_USER:-root}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/ai_baby_aliyun}"
REMOTE_DB="${REMOTE_DB:-/var/lib/ai-baby-growth-companion/baby-companion.sqlite}"
PLAN_CODE="${PLAN_CODE:-internal-trial}"
NOTE="${NOTE:-internal trial seed (R1 Pro gating migration)}"

echo "Seeding internal Pro entitlements on ${ECS_USER}@${ECS_HOST}"
echo "  DB:        ${REMOTE_DB}"
echo "  planCode:  ${PLAN_CODE}"

ssh -i "$SSH_KEY" -o BatchMode=yes -o ConnectTimeout=15 "${ECS_USER}@${ECS_HOST}" \
  "DB='${REMOTE_DB}' PLAN_CODE='${PLAN_CODE}' NOTE='${NOTE}' python3 - <<'PY'
import os, sqlite3, uuid, datetime
db = os.environ['DB']
plan = os.environ['PLAN_CODE']
note = os.environ['NOTE']
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
con = sqlite3.connect(db)
con.row_factory = sqlite3.Row
cur = con.cursor()
families = [r['id'] for r in cur.execute('SELECT id FROM auth_family')]
seeded, skipped = [], 0
for fid in families:
    has = cur.execute('SELECT 1 FROM pro_trial_entitlement WHERE family_id=? LIMIT 1', (fid,)).fetchone()
    if has:
        skipped += 1
        continue
    cur.execute(
        'INSERT INTO pro_trial_entitlement '
        '(id, family_id, enabled, starts_at, expires_at, plan_code, note, created_at, updated_at) '
        'VALUES (?,?,?,?,?,?,?,?,?)',
        ('pro-entitlement-' + str(uuid.uuid4()), fid, 'true', now, None, plan, note, now, now)
    )
    seeded.append(fid)
con.commit()
print(f'families_total={len(families)} seeded={len(seeded)} skipped_existing={skipped}')
for f in seeded:
    print('  seeded', f)
con.close()
PY"

echo "Done. 新注册家庭默认无 Pro entitlement，需后续单独审批。"
