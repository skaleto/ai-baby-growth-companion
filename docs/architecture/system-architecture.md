# 小宝记系统架构文档

更新时间：2026-06-06

本文只记录当前仍应作为实现依据的系统边界。历史 PRD、5 月视觉/每日总结方案、旧聊天中心方案已从工作区删除或从当前路线排除；不要从旧归档推导新需求。

## 1. 当前产品边界

小宝记当前定位是“记录和陪伴”的移动优先 App：

- 记录是主线，降低照护者记录负担。
- AI 是模块内的输入和整理能力，不是独立产品中心。
- 暂不做电商、专家问诊、知识付费、开放社区。
- 专业健康内容只做低风险提示和记录边界，不替代医生诊断。

目标主导航：

| Tab | 定位 |
| --- | --- |
| `记录` | 默认首页，今日记录、快速输入、时间线、成长数据、趋势、日历 |
| `相册` | 宝宝照片/视频按天时间流 |
| `账本` | 手动支出记录，后续承接 Pro 图片/小票识别 |
| `我的` | 宝宝资料、家庭成员、提醒管理、隐私、订阅 |

独立 `聊天` 和 `提醒` 不再是目标主导航。聊天历史可以保留为数据或二级入口，但不作为核心路径。

## 2. 业务角色和数据边界

| 角色 | 能力 |
| --- | --- |
| 照护人 | 可维护家庭共享数据，使用 Agent/ASR/上传，确认待确认项，管理相册、账本、宝宝资料和提醒。 |
| 仅查看成员 | 可查看家庭共享的小宝资料、照护记录、相册和账本；不可调用写入类接口。 |
| 家庭邀请码 | 同一邀请码加入同一家庭；核心亲属角色在家庭内唯一。 |

| 数据类型 | 边界 | 当前要求 |
| --- | --- | --- |
| `profile` | 家庭共享 | 宝宝资料和家庭基础信息 |
| `careLogs` | 家庭共享 | 照护事实和时间线 |
| `growthMeasurements` / `growthEvents` | 家庭共享 | 成长测量和里程碑 |
| `albumItems` | 家庭共享 | 已保存的相册媒体 |
| `expenses` | 家庭共享 | 账本支出 |
| `attachments` | 家庭授权 | 同家庭可读，照护人才可上传/删除 |
| `messages` | 账号私有 | 聊天/记录助手历史 |
| `reminders` | 账号私有 | 提醒管理从我的页进入；AI 提醒工具不在本轮迁移范围 |
| `pendingEffects` | 账号私有 | AI 待确认项必须由后端持久化 |
| `memories` | 账号私有 | 长期记忆不进入本轮 Agent tool 迁移范围 |

## 3. 前端架构

前端是 React + TypeScript + Vite + Capacitor，核心业务仍集中在 `frontend/src/App.tsx`。当前实现需要继续收敛大型组件，但本轮不要做无关重构。

关键模块：

| 模块 | 职责 |
| --- | --- |
| `frontend/src/appStateApi.ts` | 应用状态读取、集合 upsert/delete、附件上传 |
| `frontend/src/agentApi.ts` | Agent 普通请求和 SSE 流式请求 |
| `frontend/src/asrApi.ts` | ASR WebSocket 客户端 |
| `frontend/src/nativeMediaPicker.ts` | iOS/Android 原生媒体选择 |
| `frontend/src/nativeAlarm.ts` | 原生提醒/闹铃桥；入口从我的页管理 |
| `frontend/src/mobileUpdates.ts` | OTA 检查、下载、进度和切换 |

UI 变更最低门槛：

```bash
npm run verify:frontend
```

## 4. 后端架构

后端是 Spring Boot + SQLite。默认生产主机为 `120.55.188.242:8300`。

主要分层：

| 层 | 职责 |
| --- | --- |
| Controller | 登录、状态、Agent、上传、OTA 等 HTTP 入口 |
| Service | Auth、AppState、Agent、上传、提醒、OTA 等业务服务 |
| Repository | SQLite 读写 |
| Agent Runtime | 构造上下文、模型调用、工具执行、最终回复 |

生产数据安全：

- 部署代码时默认 `SYNC_DATA=0`。
- 不覆盖 `backend/data/`、`backend/backend/data/`、`backups/` 或 `.env*`。
- OTA 构建必须显式注入生产 API base URL。

## 5. Agent 当前目标架构

当前 Agent 写入迁移目标是 tool-first action tools，详见：

`docs/architecture/agent-design.md`

P0 只聚焦记录和账本：

| Tool | 默认行为 |
| --- | --- |
| `record_feeding_event` | 字段完整的低风险喂养直接写入 `careLogs` |
| `create_growth_measurement_pending` | 创建持久化 `pending_effect.growthMeasurements` |
| `create_expense_pending` | 创建持久化 `pending_effect.expenses` |

关键原则：

- 工具是后端 Agent Runtime 内部 function calling Spring Bean，不是 CLI 或前端 API。
- 最终回复只能引用工具结果。
- `pending` 必须真实落到 `pending_effect` 并能从 `/api/app/state` 看到。
- AI 提醒/待办工具不在本轮迁移范围。
- 2026-06-07 迁移完成后，`RecordSignalExtractor`、`EffectPolicy` 和 `CareEventCompletenessPolicy` 已从生产主代码删除；P0 记录/账本 AI 写入只走 action tool / `AgentMutationService`。

## 6. 验证和发布

| 变更类型 | 最低验证 |
| --- | --- |
| 文档/索引清理 | `git diff --check` |
| Agent 行为 | `npm run test:agent-benchmark` |
| UI/导航/布局 | `npm run verify:frontend` |
| 后端服务/Schema | 相关 Maven 测试 + agent benchmark |
| Native/Capacitor | `npm run mobile:sync`，必要时原生 build |
| ECS 发布 | `SYNC_DATA=0 ECS_HOST=120.55.188.242 npm run deploy:aliyun` |
| OTA 发布 | `VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update` 并校验 bundle 内无 `localhost:8080` |

## 7. 当前实现入口

后续 agent 应优先读取：

1. `harness/project-index.md`（文档导航中枢）
2. `docs/architecture/agent-design.md`（Agent tool-first 设计细节）
3. `docs/product/feature-inventory.md`（功能与验证清单）
