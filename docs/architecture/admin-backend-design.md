# 管理后台设计（Admin Backend Design）

- 日期：2026-06-09
- 状态：设计已确认，待写实现计划
- 范围：为「小宝记」做一个**完全独立**的管理后台（独立服务实例 + 独立鉴权），部署到现有 ECS，把目前只能靠 SSH+SQL/脚本做的运营动作变成网页。

## 1. 目标与非目标

**目标（v1）**：把以下运营动作图形化，单人运营即可自助完成：
1. 内测申请处理（列出 pending → 一键批准开通 Pro / 驳回）。
2. 兑换码管理（生成、列表、停用）。
3. Pro 权益管理（按手机号查家庭 → 开通/续期/撤销）。
4. AI 用量与成本（每家庭月度次数 vs 额度、token，全局概览）。

**非目标（v1 不做，留作以后）**：客户端崩溃/错误上报、Agent 运行轨迹、数据权利请求、邀请码管理、OTA 版本开关。这些低频或有替代。

**关键约束（用户明确要求）**：
- 与现有用户鉴权体系**完全独立**（不复用 caregiver JWT / 邀请码）。
- **独立服务实例**（不挂在主后端 8300 上）。
- 简单优先。管理员**用手机号登录**，白名单初始仅 `18915618653`。

## 2. 架构

独立的 **Node.js + Express** 小服务，与主后端（Spring Boot, 8300）进程隔离，部署在同一台 ECS 的 **8400** 端口，自己的 systemd 单元 `ai-baby-admin`。

```
浏览器(管理员)
  └─ http://120.55.188.242:8400/         静态后台页(原生 HTML/JS,零构建)
       └─ /admin-api/*                   Express,X-Admin token 鉴权
            └─ better-sqlite3 (WAL)      ──同一个── /var/lib/ai-baby-growth-companion/baby-companion.sqlite
                                                        ▲
主后端 Spring Boot :8300 ────────────────────────────────┘ (同库,各自进程)
```

目录结构：
```
admin/
  server.mjs            Express 入口:路由 + 鉴权中间件 + 启动
  lib/
    db.mjs              打开共享 SQLite(WAL, busy_timeout),封装查询
    auth.mjs            手机白名单 + 密码校验 + HMAC 令牌签发/校验
    repo.mjs            对 pro_trial_*/redeem_code/ai_usage_log/auth_* 的读写(复用后端列约定)
  routes/
    applications.mjs    内测申请
    redeemCodes.mjs     兑换码
    entitlements.mjs    Pro 权益
    usage.mjs           AI 用量/概览
  public/
    index.html          单页:登录 → 4 个 Tab
    app.js              fetch /admin-api/*,渲染
    style.css           简洁实用样式
  test/                 node --test 单测(临时 SQLite)
  package.json
```

> **备选方案(已否决)**:再起一个 Spring Boot 服务——同 Java 栈但要多模块拆共享实体、多一个 JVM 占内存,不够"简单"。

## 3. 鉴权与安全

与主站 auth 完全隔离,自带一套:

- **登录**:`POST /admin-api/login {phone, password}`。
  - `phone` 必须在白名单 `ADMIN_PHONES`(逗号分隔,初始 `18915618653`)。
  - `password` 必须等于服务端 secret `ADMIN_PASSWORD`(**默认 `123456`**,6 位数字,部署时可改;timing-safe 比较)。
  - 通过 → 返回 HMAC 签名令牌 `base64(payload).sig`,payload=`{phone, exp}`(默认 8h),sig=HMAC-SHA256(payload, `ADMIN_TOKEN_SECRET`)。
- **鉴权中间件**:除 `/login` 外所有 `/admin-api/*` 要求 `Authorization: Bearer <token>`;校验签名 + 未过期 + phone 仍在白名单。
- **防爆破**:登录失败按 IP 做简单内存限流(如 1 分钟 10 次),并对密码用 timing-safe 比较。
- **密钥来源**:`ADMIN_PASSWORD`、`ADMIN_TOKEN_SECRET` 作为 secret 放 `/etc/ai-baby-growth-companion/`(与现有 deepseek/doubao key 同目录),由 systemd EnvironmentFile 注入,不进仓库。
- **传输**:v1 用 IP+端口 HTTP;上线前建议挂 HTTPS/域名(与主站一致)。文档注明此风险。

> 设计取舍:用户要"用手机号登录"。纯手机号(无密码)任何知道 `18915618653` 的人都能进,不安全;故采用**手机号(白名单)+ 密码**。若后续要纯手机号,改 `auth.mjs` 一处即可。
>
> `ADMIN_PASSWORD` 默认 `123456`(简单口令,内测自用够用)。后台能改任意家庭权益,**暴露到公网 / 上 HTTPS 前建议改成强口令**——改 systemd EnvironmentFile 即可,无需改代码。

## 4. 数据访问与并发

- 管理服务用 `better-sqlite3` 直接读写**同一个生产 SQLite**,开 `journal_mode` 跟随库现状、`busy_timeout=5000`。
- 写操作很低频(开权益、发码、批准申请),与主后端写冲突概率极低;`busy_timeout` + 写操作 try/重试兜底,SQLITE_BUSY 时重试。
- 读端点尽量只读、查询快,避免长事务影响主后端。
- **写语义必须与后端一致**(避免数据不一致):
  - 开通 Pro = upsert `pro_trial_entitlement`(`enabled='true'`、`plan_code`、`starts_at`、`expires_at`=now+N 天、ISO 字符串、`id='pro-entitlement-<familyId>'`),与 `ProTrialService.grantEntitlement` 同款,不缩短已有更长有效期。`permanent` 时 `expires_at=NULL`(永不过期)。
  - 撤销 = `enabled='false'` + `updated_at`。
  - 兑换码 = 插入 `redeem_code`(`id/code/plan_code/expires_at/max_uses/used_count=0/...`),与 `seed-redeem-codes.sh` 同款;停用 = 把 `expires_at` 置为当前时间(立即过期)。
  - 批准申请 = 给该 family `grantEntitlement` + 把 `pro_trial_application.status` 置 `approved`;驳回 = 置 `rejected`。

## 5. API(/admin-api）

| 方法 路径 | 作用 |
| --- | --- |
| GET `/health` | 健康检查(无需鉴权,部署探针用) |
| POST `/login` | 手机号+密码 → 令牌 |
| GET `/overview` | 全局:家庭数、Pro 数、近30天 AI 次数/token、pending 申请数 |
| GET `/applications?status=pending` | 申请列表(join 手机号/角色) |
| POST `/applications/:familyId/approve` | 开通 Pro(默认90天)+ 标记 approved |
| POST `/applications/:familyId/reject` | 标记 rejected |
| GET `/redeem-codes` | 兑换码列表(已用/上限/过期) |
| POST `/redeem-codes` | 生成 `{count, maxUses, expiresDays, planCode}` → 返回码 |
| POST `/redeem-codes/:code/disable` | 立即过期 |
| GET `/families?phone=` | 按手机号查家庭+成员+权益+用量 |
| POST `/entitlements` | `{familyId, days|permanent}` 开通/续期 |
| POST `/entitlements/:familyId/revoke` | 撤销 |
| GET `/usage?familyId=&days=30` | 某家庭/全局 AI 用量明细 |

错误统一返回 `{error: "<中文文案>"}` + 合适状态码(401 未授权 / 400 入参 / 404 找不到 / 409 冲突)。

## 6. 前端(public）

- 单页:未登录显示登录框(手机号+密码);登录后顶部 4 个 Tab(申请/兑换码/权益/用量)+ 概览条。
- 原生 JS `fetch`,令牌存 `sessionStorage`,每次带 `Authorization`;401 自动回登录。
- 简洁实用风格,无构建步骤(直接静态文件)。

## 7. 部署

- `scripts/deploy-admin.sh`(沿用 `deploy-aliyun-ecs.sh` 风格):
  1. ECS 装 Node(apt 或 NodeSource);
  2. rsync `admin/`(排除 `node_modules`)到 `/opt/ai-baby-admin`;
  3. ECS 上 `npm ci --omit=dev`(better-sqlite3 走预编译二进制,linux-x64 有 prebuilt,无需编译链);
  4. 写 `/etc/ai-baby-growth-companion/admin.env`(ADMIN_PHONES/ADMIN_PASSWORD/ADMIN_TOKEN_SECRET/DB 路径/PORT=8400),装 systemd 单元 `ai-baby-admin` 并启动;
  5. 健康检查 `GET /admin-api/health`。
- **需在阿里云安全组放行 8400 端口**(文档+脚本输出提醒)。

## 8. 测试

- `node --test`(临时 SQLite,建表后):
  - 鉴权:白名单外手机号拒登、错密码拒登、对的放行、令牌过期/篡改拒绝。
  - 兑换码:生成 N 个、列表、停用后立即过期。
  - 权益:开通→enabled=true & 有效期、撤销→false、不缩短已有更长有效期。
  - 申请:批准→开通+approved、驳回→rejected。
- 部署后手工 smoke:登录、查一个家庭、发 1 个码、看概览。

## 9. 风险与取舍

- **共享 SQLite**:两进程同库,理论上有锁竞争。缓解:WAL + busy_timeout + 低频写 + 重试。若日后写量上升,再考虑让管理服务改走主后端 admin API。
- **HTTP 明文(v1)**:端口暴露在公网 IP。缓解:白名单+密码+令牌;上线尽快上 HTTPS/域名。
- **越权风险**:后台能改任何家庭权益。缓解:独立强口令、令牌短时、操作可在 `note` 字段留痕(如 `admin grant`)。
