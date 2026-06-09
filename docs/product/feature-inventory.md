# 小宝记当前功能清单与测试蓝图

更新时间：2026-06-06

## Summary

本文是后续 agent 必读的当前功能清单。它只描述新的产品方向：

- 主线是记录和陪伴，不做电商、专家问诊、知识付费、开放社区。
- 记录是默认首页；目标底部导航是 `记录 / 相册 / 账本 / 我的`。
- AI 不再作为独立聊天中心，而是记录、相册、账本里的模块内输入/增强能力。
- 提醒保留为我的页里的管理能力；本轮 Agent tool-first 迁移不提供 AI 提醒/待办写入工具。
- 面向用户不暴露模型选择、深度思考、快速模式等内部控制项。

历史 5 月商业化、DailySummaryView、独立提醒 Tab、独立聊天 Tab 决策已删除或被 2026-06-06 specs 覆盖，不应作为当前实现依据。

## 验证约束

- UI、样式、移动布局、导航、表单、键盘、输入区或交互变化必须运行 `npm run verify:frontend`。
- Agent 行为变化必须运行 `npm run test:agent-benchmark`；涉及 L2 覆盖或 coverage 文件时运行 `npm run test:agent-l2:unit`。
- 原生风险变化必须运行 `npm run mobile:sync`，并在环境允许时运行 `npm run build:ios:debug` / `npm run build:android:debug`。
- ECS/OTA 发布必须遵守 AGENTS.md 的生产 API base URL 和 `SYNC_DATA=0` 规则。

## 共享边界

家庭共享数据：`profile`、`growthEvents`、`growthMeasurements`、`careLogs`、`albumItems`、`expenses`、附件文件。

账号私有数据：历史 `messages`、`reminders`、`memories`、`pendingEffects`、`conversationSummary`。

## 功能清单

### 1. 应用壳与导航

| 优先级 | 功能 | 当前目标 | 自动化验证建议 |
| --- | --- | --- | --- |
| P0 | 记录默认首页 | 新用户、已登录照护人、刷新恢复后优先进入记录页。 | 登录 smoke 断言 active tab 为 records，首屏出现记录页而非聊天页。 |
| P0 | 底部四 Tab 导航 | 移动端底部只承载 `记录 / 相册 / 账本 / 我的`。 | Playwright 检查底部文案和 aria-label，不出现聊天/提醒 Tab。 |
| P0 | 固定移动视口 | App 固定壳和底部导航不造成横向溢出或主按钮遮挡。 | 视口矩阵下检查 scrollWidth、底部栏和输入区。 |
| P1 | 模块内 AI 入口 | AI 入口贴在记录/相册/账本模块内，不作为独立底部 Tab。 | 记录页存在“记一笔”输入；相册/账本没有醒目的泛 AI 中心。 |
| P1 | OTA 更新 | 原生端通过 `/api/mobile-updates/check` 拉取 bundle。 | OTA 构建后校验生产 base URL、checksum 和 stale/current probe。 |
| P2 | 运行版本信息 | 我的页展示 App/OTA/backend 版本和平台信息。 | 我的页 smoke 断言版本字段渲染。 |

### 2. 登录、家庭与权限

| 优先级 | 功能 | 当前目标 | 自动化验证建议 |
| --- | --- | --- | --- |
| P0 | 手机号 + 家庭邀请码登录 | `POST /api/auth/login` 返回 token、user、family、member、onboardingRequired。 | API + Web 登录 fixture。 |
| P0 | 新成员身份与权限 | 新手机号选择家庭角色和是否照护人；已有成员复用身份。 | 后端 Auth 测试和登录页 smoke。 |
| P0 | 状态读取 | `GET /api/app/state` 返回家庭共享 + 当前账号私有视图。 | A/B 家庭共享与私有边界测试。 |
| P0 | 写权限拦截 | 写状态、上传、Agent、ASR 均要求照护人。 | 只读 token 调用写接口断言 403。 |
| P1 | 待确认确认/丢弃 | `pendingEffects` 当前账号私有；确认后进入对应共享或私有集合。 | 后端 AppState 测试 + 前端 pending 卡确认。 |
| P1 | SQLite 启动迁移 | 启动空库和旧库均能建立当前 schema。 | 后端集成测试启动临时库。 |

### 3. 记录模块

| 优先级 | 功能 | 当前目标 | 自动化验证建议 |
| --- | --- | --- | --- |
| P0 | 记录页轻量 AI 输入 | 记录页提供文本/语音“记一笔今天的变化...”入口，复用 Agent 能力。 | 记录页输入触发 `/api/agent/chat/stream`，结果留在记录页。 |
| P0 | 喂养手动记录 | 支持手动新增/编辑/删除奶量、类型、时间和备注。 | 新增三笔奶量后断言时间线和统计一致。 |
| P0 | 睡眠手动记录 | 支持开始/结束或时长记录，统计来自事件明细。 | 新增睡眠段后断言今日和趋势同步。 |
| P0 | 便便/体温/健康记录 | 支持低风险事实记录；高风险只做非诊疗提示。 | 体温异常进入安全提示，不输出诊断。 |
| P0 | 成长入口与最新值 | 记录页首屏展示身高、体重、头围最新值和入口。 | seed growthMeasurements 后断言最新值。 |
| P0 | 手动新增成长测量 | 支持身高/体重/头围、日期、备注和范围校验。 | 有效值保存；999cm 拒绝。 |
| P1 | 成长测量编辑删除 | 历史测量可编辑/删除，只读成员不可写。 | 编辑同 id 更新；删除后列表消失。 |
| P0 | 里程碑入口 | 发育/成长里程碑从我的页迁入记录域。 | 记录页出现里程碑入口，我的页不作为主入口。 |
| P0 | 今日统计可信 | 奶量、次数、睡眠等优先从事件明细聚合，聚合字段只作 fallback。 | 三次奶量事件合计正确，时间线和趋势一致。 |
| P1 | 当天时间线 | 展示当天所有照护、成长、里程碑、账本关联事实。 | 按时间排序，不漏 AI/手动记录。 |
| P1 | 趋势包含成长 | 趋势页同时呈现近 7 天照护趋势和成长最新变化。 | seed careLogs/growthMeasurements 后断言两类趋势。 |
| P1 | 日历回看 | 月历标记有记录日期，点击后切换当天时间线。 | seed 跨天记录后切换日期。 |
| P2 | 空状态低焦虑 | 无记录日期只给温和入口，不出现催补弹框。 | 断言无“要补一下吗”等补记催促。 |

### 4. 相册模块

| 优先级 | 功能 | 当前目标 | 自动化验证建议 |
| --- | --- | --- | --- |
| P0 | 相册上传 | 照护人可上传图片/视频，生成家庭共享 albumItems。 | local 上传 fixture，断言相册 tile。 |
| P0 | 按天分组 | 相册按照片拍摄/素材日期优先分组，不再按月分组；取不到拍摄时间时再用文件时间和上传时间兜底。 | 同天多图同组、跨天分组不同；`capturedAt`/EXIF fallback 有单元测试。 |
| P1 | 相册预览编辑删除 | 支持预览、编辑日期/备注/分类、删除。 | 点击 tile 打开预览并编辑保存。 |
| P1 | 低打扰 AI 增强 | P0 不强化 AI；P1 只做日期建议、去重、封面、小故事等低打扰增强。 | P0 smoke 断言无醒目泛 AI 入口。 |
| P2 | 媒体权限与缩略图 | 附件按 family 校验，图片缩略图可读取。 | 跨家庭附件 403；thumbnail API 小图返回。 |

### 5. 账本模块

| 优先级 | 功能 | 当前目标 | 自动化验证建议 |
| --- | --- | --- | --- |
| P0 | 手动记账 | 支持金额、分类、日期、备注、附件。 | 新增/编辑/删除支出，统计更新。 |
| P0 | 家庭共享账本 | 账本按家庭共享；只读成员可看不可写。 | A 写 B 可见，B 无编辑按钮。 |
| P0 | AI 记账待确认 | 文本账本请求生成持久化 pending，确认后入账。 | `expense-record` L2 + AppState confirm。 |
| P1 | 月度分类统计 | 展示本月总额、分类占比和大额支出。 | seed 多分类支出断言汇总。 |
| P1 | 图片/小票识别权益 | 图片/小票 AI 识别属 Pro 能力，Free 每月免费额度内可用，识别结果必须待确认。 | 后端 requireAiAccess 门禁 + 待确认入账。 |
| P2 | 条码/商品查询不回归 | 不恢复扫码、商品查询或导购字段。 | UI/API 断言无扫码/商品查询入口。 |

### 6. 我的模块

| 优先级 | 功能 | 当前目标 | 自动化验证建议 |
| --- | --- | --- | --- |
| P0 | 宝宝资料与家庭成员 | 我的页承载宝宝资料、家庭成员、我的身份。 | 进入我的页断言资料和成员身份。 |
| P0 | 提醒管理入口 | 提醒从独立 Tab 降级到我的页管理入口；系统通知能力保留。 | 底部无提醒 Tab；我的页可进入提醒管理。 |
| P0 | 隐私与法律入口 | 我的页展示隐私、用户协议、儿童信息和 AI 数据说明。 | 法律摘要弹层可打开。 |
| P1 | Pro/权益说明 | 我的页说明统一边界：凡走 AI 助手即 Pro，Free 每月若干次免费体验并展示剩余次数；不暴露模型设置。 | 我的页显示「本月还剩 X 次」，不出现模型选择/深度思考/快速模式。 |
| P1 | 只读提示 | 仅查看成员显示只读状态，写入口隐藏。 | viewer fixture 覆盖各模块主写入口。 |
| P2 | 退出登录 | 退出后撤销 session 并清本地 token。 | 旧 token 访问 state 返回 401。 |

### 7. Agent 与模型能力

| 优先级 | 功能 | 当前目标 | 自动化验证建议 |
| --- | --- | --- | --- |
| P0 | 中文模型上下文 harness | 每次调用模型前提供当前时间、宝宝资料、最近消息、最近记录、能力清单和 bad-case 规则。 | `npm run test:agent-benchmark`。 |
| P0 | Tool-first 喂养写入 | 完整低风险喂养由模型调用受控工具直接写 careLog。 | 新增 action tool 测试和 `feed-complete` L2。 |
| P0 | Tool-first 成长待确认 | 成长测量由工具创建持久化 pending，不直接写最终集合。 | `growth-measurement-complete` L2 断言 pending 可见。 |
| P0 | Tool-first 账本待确认 | 文本账本请求由工具创建持久化 pending。 | `expense-record` L2 断言 pending 可见。 |
| P0 | 最终回复基于工具结果 | 没有工具成功结果时，AI 不得说“已记好/已创建草稿”。 | benchmark 覆盖 failed/needs_input。 |
| P0 | 不提供 AI 提醒工具 | 模型不获得 set_reminder/todo 工具，不承诺创建提醒或待办。 | reminder 请求返回能力边界，无 app_state mutation。 |
| P1 | 纯文本/多模态自适应 | 纯文本默认文本模型；有图片/视频时用视觉模型；用户不选择模型。 | 请求体/后端路由测试。 |
| P1 | 医疗安全边界 | 高风险健康问题只做记录/提示/就医建议，不做诊断用药。 | Agent benchmark 高烧/用药/疫苗边界。 |
| P2 | 会话历史保留 | 历史聊天数据不丢，但不作为底部主入口。 | 数据读取仍兼容 messages。 |

### 8. 原生、媒体与云端

| 优先级 | 功能 | 当前目标 | 自动化验证建议 |
| --- | --- | --- | --- |
| P0 | 语音输入 | 记录页/模块输入支持按住说话、上滑取消、ASR 转文字。 | Web mock + 真机麦克风专项。 |
| P0 | 图片/视频入口权益 | Free 在每月免费额度内可用图片/视频；额度用尽才置灰并引导申请内测；Pro 不限次。 | frontend smoke + 配额耗尽 fixture。 |
| P1 | 原生通知保留 | 手动提醒管理仍能调度系统通知。 | native capability audit + 设备 probe。 |
| P1 | ECS 代码部署 | 代码发布默认 `SYNC_DATA=0`，保护生产 SQLite 和 auth secret。 | 部署后 health + 行为 probe。 |
| P1 | OTA 发布 | OTA 必须注入生产 base URL 并验证 checksum。 | 解包 grep base URL + mobile-updates/check。 |
| P2 | 数据删除/导出 | 公开上架前补充用户数据删除/导出入口。 | release-hardening checklist。 |

## 后续自动化重点

1. 先让 `npm run verify:frontend` 覆盖四 Tab、记录默认首页、记录页 AI 输入、相册按天、我的页提醒入口。
2. Agent tool-first 改造时，先补 action tool 单测，再补 L2 状态断言，最后再删旧 fallback。
3. 账本和成长 pending 必须验证“AI 说有”和 `/api/app/state` 真的可见同一项。
4. 原生能力不要用浏览器 smoke 代替真机证据。

## 主要代码索引

- 前端入口与页面：`frontend/src/App.tsx`
- 底部导航配置：`frontend/src/appOptions.ts`
- 类型定义：`frontend/src/types.ts`
- 状态 API：`frontend/src/appStateApi.ts`
- Agent API：`frontend/src/agentApi.ts`
- ASR API：`frontend/src/asrApi.ts`
- 相册规则：`frontend/src/albumDomain.ts`
- 原生闹铃桥：`frontend/src/nativeAlarm.ts`
- OTA 运行时：`frontend/src/mobileUpdates.ts`
- 后端状态服务：`backend/src/main/java/com/xiaobao/babycompanion/service/AppStateService.java`
- Agent 主链路：`backend/src/main/java/com/xiaobao/babycompanion/agent/AgentRuntime.java`
- Agent action tools：`backend/src/main/java/com/xiaobao/babycompanion/agent/action/`
- Agent 写入边界：`backend/src/main/java/com/xiaobao/babycompanion/service/AgentMutationService.java`
- Agent 能力清单：`backend/src/main/resources/agent/capability-manifest.json`
- 当前模型上下文 harness：`harness/agent-model-context-harness.md`
