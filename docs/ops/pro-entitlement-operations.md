# Pro 内测运营手册（Runbook）

面向运营：如何给用户开通 Pro、发放兑换码、查状态、处理支持工单。代码侧的发版部署见
[aliyun-ecs-deploy.md](aliyun-ecs-deploy.md) 与 [mobile-updates.md](mobile-updates.md)。

## 边界（当前线上口径）

- **凡走 AI 助手的回合都属 Pro**：记录里的 AI、账本里的 AI、图片/视频整理、小票识别。
- **Free 家庭每月 10 次**免费 AI 体验（只数顶层用户回合 `agent_chat`/`agent_stream`，planner/视觉/记账/压缩等子步不计）。用完返回 403 `PRO_QUOTA_EXCEEDED`，App 引导申请内测 / 输兑换码。
- **Pro 家庭不限次**。Pro 由家庭的 `pro_trial_entitlement`（`enabled=true` 且在有效期内）决定。
- 手动记录、相册浏览、手动账本、数据备份/导出 = 永久免费。

## 快速参考

| 项 | 值 |
| --- | --- |
| ECS | `120.55.188.242`（SSH `root`） |
| SSH Key | `~/.ssh/ai_baby_aliyun` |
| 生产 DB | `/var/lib/ai-baby-growth-companion/baby-companion.sqlite` |
| 兑换端点 | `POST /api/pro/redeem` `{ "code": "..." }`（caregiver 登录态） |
| 免费额度配置 | `app.pro.free-monthly-ai-quota`（默认 10） |
| 兑换开通时长 | `app.pro.redeem-grant-days`（默认 90 天） |

> 下面凡是 SSH 进生产跑 SQL 的，统一用这个前缀：
> ```bash
> SSH="ssh -i ~/.ssh/ai_baby_aliyun root@120.55.188.242"
> DB="/var/lib/ai-baby-growth-companion/baby-companion.sqlite"
> ```

---

## 动作 A：发放内测兑换码（主路径，推荐）

新内测用户走**自助兑换**——你发码，他在 App「我的」页输码即开通，无需你手动审批。

```bash
cd ~/Documents/ai-baby-growth-companion
COUNT=20 MAX_USES=1 EXPIRES_DAYS=30 PLAN_CODE=internal-trial \
  SSH_KEY=~/.ssh/ai_baby_aliyun bash scripts/seed-redeem-codes.sh
```

- `COUNT`：生成多少个码（默认 20）。
- `MAX_USES`：每个码可被兑换几次（默认 1，即一次性码）。设大于 1 可做"一码多人"。
- `EXPIRES_DAYS`：码的兑换有效期天数（默认 30；填 0 = 永不过期）。
- 脚本会**打印生成的码**，复制分发即可。幂等、撞码自动跳过。

> 注意：`EXPIRES_DAYS` 是"码能被兑换的截止时间"；兑换成功后用户的 Pro 有效期是另一回事（默认 90 天，见 `app.pro.redeem-grant-days`）。

**用户侧**：打开 App →「我的」→ Pro 卡片 →「输入内测码」→ 兑换 → 立即开通。

---

## 动作 B：手动给某个家庭开 / 关 Pro（支持工单）

当用户兑换不了、或要给特定家庭直接开通 / 撤销时。

### 1）按手机号定位家庭

```bash
$SSH "sqlite3 $DB \"
  SELECT m.family_id, u.phone, m.role_name
  FROM auth_user u JOIN auth_family_member m ON m.user_id = u.id
  WHERE u.phone = '13800000000';\""
```

### 2）开通 Pro（90 天，幂等）

```bash
$SSH "sqlite3 $DB \"
  INSERT INTO pro_trial_entitlement (id, family_id, enabled, starts_at, expires_at, plan_code, note, created_at, updated_at)
  VALUES ('pro-entitlement-<FAMILY_ID>', '<FAMILY_ID>', 'true',
          strftime('%Y-%m-%dT%H:%M:%fZ','now'),
          strftime('%Y-%m-%dT%H:%M:%fZ','now','+90 days'),
          'internal-trial', 'manual grant', strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  ON CONFLICT(family_id) DO UPDATE SET
    enabled='true',
    expires_at=strftime('%Y-%m-%dT%H:%M:%fZ','now','+90 days'),
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now');\""
```

> 永久开通：把两个 `expires_at` 都改成 `NULL`（无有效期 = 永不过期）。

### 3）撤销 Pro

```bash
$SSH "sqlite3 $DB \"UPDATE pro_trial_entitlement SET enabled='false',
  updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE family_id='<FAMILY_ID>';\""
```

撤销后该家庭立刻回到 Free（每月 10 次）。历史数据照常可看、可导出、可删除（不受门禁影响）。

---

## 动作 C：批量保护现有家庭（grandfather）

启用/收紧门禁前，给**所有现存家庭**一次性种上 Pro，避免老用户被突然限流。幂等，已有的跳过。

```bash
SSH_KEY=~/.ssh/ai_baby_aliyun bash scripts/seed-internal-pro-entitlements.sh
```

> 2026-06-09 上线"统一 AI 门禁"时已执行过一次（7 个家庭全部保护）。日常一般用不到，仅在做下一次门禁收紧、或批量导入老用户时再跑。

---

## 动作 D：查看状态

```bash
# 有多少家庭、多少已开通 Pro
$SSH "sqlite3 $DB \"
  SELECT 'families='||COUNT(*) FROM auth_family;
  SELECT 'pro_families='||COUNT(*) FROM pro_trial_entitlement WHERE enabled='true';\""

# 兑换码使用情况（已兑次数 / 上限 / 过期时间）
$SSH "sqlite3 $DB \"
  SELECT code, used_count||'/'||max_uses AS uses, plan_code, expires_at
  FROM redeem_code ORDER BY created_at DESC LIMIT 50;\""

# 某家庭近 30 天已用的免费 AI 次数（与门禁口径一致）
$SSH "sqlite3 $DB \"
  SELECT COUNT(*) AS used_30d FROM ai_usage_log
  WHERE family_id='<FAMILY_ID>' AND success='true' AND quota_counted='true'
    AND feature IN ('agent_chat','agent_stream')
    AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days');\""
```

---

## 动作 E：调整每月免费额度

免费次数由 `app.pro.free-monthly-ai-quota`（默认 10）控制，定义在 `ProTrialService` 的构造参数。
改值需在后端配置（`application.properties` 或 systemd 服务的环境变量）里设置后**重新部署后端**，
注入方式见 [aliyun-ecs-deploy.md](aliyun-ecs-deploy.md)。兑换开通时长同理：`app.pro.redeem-grant-days`（默认 90）。

---

## 发版（参考，属研发动作）

- 后端部署到 ECS：`ECS_HOST=120.55.188.242 SSH_KEY=~/.ssh/ai_baby_aliyun npm run deploy:aliyun`
- 前端 OTA 发布：见 [mobile-updates.md](mobile-updates.md)（务必带生产 `VITE_AGENT_API_BASE_URL`，否则全量 load failed）。
