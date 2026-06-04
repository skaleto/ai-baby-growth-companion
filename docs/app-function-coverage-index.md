# App Function Coverage Index

Generated from `docs/feature-inventory.md` through `scripts/l2-benchmark/app-function-coverage-index.mjs`. This is scenario-level coverage, below `harness/feature_list.json`.

| Priority | Feature | Area | Status | Coverage owner | Gap / next action |
|---|---|---|---|---|---|
| P0 | 移动底部导航 | 应用壳、导航与运行环境 | covered_by_layer | frontend |  |
| P0 | 固定移动视口 | 应用壳、导航与运行环境 | covered_by_layer | frontend |  |
| P1 | 右侧/左侧桌面辅助栏 | 应用壳、导航与运行环境 | covered_by_layer | frontend |  |
| P1 | OTA 更新 | 应用壳、导航与运行环境 | covered_by_layer | native, cloud |  |
| P2 | 运行版本信息 | 应用壳、导航与运行环境 | known_gap | frontend | Add a frontend smoke assertion for platform/native/backend version fields on the My tab. |
| P0 | 手机号 + 家庭邀请码登录 | 登录、家庭与首次设置 | covered_by_layer | backend, frontend |  |
| P0 | 已注册用户再次登录 | 登录、家庭与首次设置 | covered_by_layer | backend |  |
| P0 | 新成员选择身份与权限 | 登录、家庭与首次设置 | covered_by_layer | backend |  |
| P1 | 角色预检 | 登录、家庭与首次设置 | covered_by_layer | backend |  |
| P1 | 首次小宝资料设置 | 登录、家庭与首次设置 | covered_by_layer | frontend |  |
| P1 | 非照护人等待设置 | 登录、家庭与首次设置 | known_gap | frontend | Add a viewer-in-empty-family frontend/API fixture and assert the wait page blocks setup editing. |
| P1 | 家庭名称默认值 | 登录、家庭与首次设置 | known_gap | frontend | Add an onboarding probe that types a baby nickname and asserts the suggested family name can be overridden. |
| P2 | 退出登录 | 登录、家庭与首次设置 | covered_by_layer | backend |  |
| P0 | 状态读取 | 后端状态、权限与持久化 | covered_by_layer | backend, cloud |  |
| P0 | 写权限拦截 | 后端状态、权限与持久化 | covered_by_layer | backend, l2 |  |
| P0 | 单条记录 upsert/delete | 后端状态、权限与持久化 | covered_by_layer | backend |  |
| P1 | 照护日志按日期合并 | 后端状态、权限与持久化 | covered_by_layer | backend |  |
| P1 | 待确认确认/丢弃 | 后端状态、权限与持久化 | covered_by_layer | backend, l2 |  |
| P1 | SQLite 启动迁移 | 后端状态、权限与持久化 | covered_by_layer | backend |  |
| P0 | 文本聊天 | 聊天与 Agent | covered | l2 |  |
| P0 | 模型选择 | 聊天与 Agent | covered_by_layer | frontend, l0_l1 |  |
| P0 | 低延迟开关 | 聊天与 Agent | covered_by_layer | backend, frontend |  |
| P0 | Agent 权限 | 聊天与 Agent | covered_by_layer | backend |  |
| P1 | Planner + Runtime | 聊天与 Agent | covered | l0_l1, l2 |  |
| P1 | Skill 渐进披露 | 聊天与 Agent | covered_by_layer | l0_l1 |  |
| P1 | 联网查询 | 聊天与 Agent | covered_by_layer | l0_l1 |  |
| P1 | 安全边界 | 聊天与 Agent | covered | l0_l1, l2 |  |
| P1 | 会话摘要压缩 | 聊天与 Agent | known_gap | backend | Add API/backend tests for conversationSummary compression isolation and a read-only L2 summary query cross-check. |
| P2 | 失败提示 | 聊天与 Agent | known_gap | frontend | Add mock 500/malformed-stream frontend probe and assert no app_state writes. |
| P0 | 喂奶完整记录 | 自动记录、待确认与能力边界 | covered | l2 |  |
| P0 | 喂奶开始意图不记录 | 自动记录、待确认与能力边界 | covered | l2, l0_l1 |  |
| P0 | 睡眠完整记录 | 自动记录、待确认与能力边界 | covered | l2 |  |
| P0 | 聊天内撤销/删除边界 | 自动记录、待确认与能力边界 | covered | l2, l0_l1 |  |
| P1 | 自动记录撤销卡片 | 自动记录、待确认与能力边界 | covered_by_layer | frontend |  |
| P1 | 待确认编辑表单 | 自动记录、待确认与能力边界 | covered_by_layer | frontend, backend |  |
| P1 | 多事件拆分与去重 | 自动记录、待确认与能力边界 | covered | l2 |  |
| P0 | 按住说话 | 语音输入与 ASR | known_gap | native | Add browser mock MediaRecorder/WebSocket probe and real iOS/Android voice-input device probe. |
| P0 | ASR 鉴权 | 语音输入与 ASR | covered_by_layer | backend | Add viewer-token WebSocket coverage to the cloud/API gate. |
| P1 | 音频格式 | 语音输入与 ASR | covered_by_layer | backend |  |
| P2 | 原生麦克风权限 | 语音输入与 ASR | known_gap | native | Run device permission-denied probes and record UI copy evidence. |
| P0 | 聊天图片/视频上传 | 图片、视频、附件与媒体预览 | covered_by_layer | frontend, l2 |  |
| P0 | 附件持久化 | 图片、视频、附件与媒体预览 | covered_by_layer | backend | Add OSS presign mock coverage if the upload provider path changes. |
| P1 | 缩略图 | 图片、视频、附件与媒体预览 | known_gap | backend | Add upload-thumbnail API smoke with a tiny fixture image. |
| P1 | 媒体预览 | 图片、视频、附件与媒体预览 | covered_by_layer | frontend |  |
| P1 | 家庭附件权限 | 图片、视频、附件与媒体预览 | covered_by_layer | cloud |  |
| P2 | 上传限制 | 图片、视频、附件与媒体预览 | known_gap | api | Add API tests for unsupported MIME and over-limit payload rejection. |
| P0 | 今日视图 | 记录 Tab | covered_by_layer | frontend |  |
| P0 | 趋势视图 | 记录 Tab | covered_by_layer | frontend | Add records trend probe with seeded 7-day careLogs. |
| P0 | 日历视图 | 记录 Tab | known_gap | frontend | Add records calendar probe with seeded month data and date switching. |
| P1 | 时间线编辑 | 记录 Tab | known_gap | frontend | Add a Playwright probe that edits milk amount and verifies today/trend stats update. |
| P1 | 完成提醒进入事实时间线 | 记录 Tab | known_gap | frontend | Add seeded reminder completion probe and assert Records timeline contains the completed reminder event. |
| P2 | 空状态 | 记录 Tab | covered_by_layer | frontend |  |
| P0 | 成长入口与最新值 | 成长数据维护 | covered_by_layer | frontend |  |
| P0 | 手动新增成长测量 | 成长数据维护 | covered_by_layer | frontend, backend |  |
| P1 | 手动删除成长测量 | 成长数据维护 | covered_by_layer | frontend, backend |  |
| P1 | 成长测量编辑能力 | 成长数据维护 | covered_by_layer | frontend, backend |  |
| P0 | AI 成长数据待确认 | 成长数据维护 | covered | l2, backend |  |
| P1 | 成长数据边界 | 成长数据维护 | covered | l2, l0_l1 |  |
| P1 | 成长趋势只读查询 | 成长数据维护 | covered | l2 |  |
| P0 | 手动记账 | 账本 Tab | known_gap | frontend | Add ledger form Playwright probe for create/edit/delete and stats updates. |
| P0 | 家庭共享 | 账本 Tab | covered_by_layer | cloud | Add read-only ledger edit-hidden frontend assertion. |
| P0 | AI 记账待确认 | 账本 Tab | covered | l2, l0_l1 |  |
| P1 | 本月视图 | 账本 Tab | known_gap | frontend | Add seeded ledger month probe for totals, category share, and large expense sorting. |
| P1 | 年度视图 | 账本 Tab | known_gap | frontend | Add seeded cross-month ledger probe for 12-month bar rendering. |
| P1 | 明细视图 | 账本 Tab | known_gap | frontend | Add ledger detail edit/delete Playwright probe with confirmation modal assertions. |
| P2 | 条码/商品查询 | 账本 Tab | covered_by_layer | docs, frontend |  |
| P0 | 相册上传 | 相册 Tab | covered_by_layer | l2, frontend |  |
| P0 | 分类筛选 | 相册 Tab | known_gap | frontend | Add album seeded category filter probe. |
| P1 | 自动准入 | 相册 Tab | covered | l2, l0_l1 |  |
| P1 | 后续保存指令 | 相册 Tab | known_gap | l2 | Add L2 scenario for uploading a video, then saying '刚才的视频保存到相册' using attachment hydration. |
| P1 | 相册预览编辑删除 | 相册 Tab | known_gap | frontend | Add album preview edit/delete probe with seeded albumItems and attachment metadata. |
| P2 | 文件名生成 | 相册 Tab | known_gap | l0_l1 | Add album domain unit test for title/MIME-based display filename generation. |
| P0 | 提醒列表 | 提醒 Tab | covered | l2, frontend |  |
| P0 | 手动新建/编辑 | 提醒 Tab | covered_by_layer | frontend, native |  |
| P0 | 完成/删除二次确认 | 提醒 Tab | covered_by_layer | frontend |  |
| P0 | Agent 创建提醒 | 提醒 Tab | covered | l2, l0_l1 |  |
| P1 | 循环喂奶锚点 | 提醒 Tab | known_gap | frontend | Add seeded milk-event reminder probe for dueAt anchoring and reschedule after new milk event. |
| P1 | 延后 | 提醒 Tab | known_gap | frontend | Add reminder postpone Playwright probe covering cancel and confirm. |
| P1 | 系统状态 | 提醒 Tab | covered_by_layer | native, frontend |  |
| P2 | 快捷创建 | 提醒 Tab | known_gap | frontend | Add quick-create frontend probe for vaccine/checkup/bath/feed/medicine/revisit/custom prompts. |
| P0 | Android 原生闹铃 | 原生通知与全屏闹铃 | known_gap | native | Run Android device probe for lock-screen full-screen alarm, looping sound, close, and interval reschedule. |
| P0 | Android 普通通知循环 | 原生通知与全屏闹铃 | known_gap | native | Add JVM/Robolectric-style receiver test or Android device probe for notification repeat nextDueAt event queue. |
| P1 | iOS 本地通知 | 原生通知与全屏闹铃 | known_gap | native | Run iOS device/simulator notification permission and delivery probe. |
| P1 | 前端全屏闹铃页 | 原生通知与全屏闹铃 | known_gap | frontend | Add frontend probe that injects ringingReminder state and verifies overlay, sound close, and nextDueAt update copy. |
| P2 | 系统限制说明 | 原生通知与全屏闹铃 | covered_by_layer | docs |  |
| P0 | 查看小宝资料 | 我的 Tab 与资料管理 | covered_by_layer | frontend |  |
| P0 | 编辑小宝资料 | 我的 Tab 与资料管理 | covered_by_layer | frontend, l2 |  |
| P1 | 只读提示 | 我的 Tab 与资料管理 | known_gap | frontend | Add viewer-role frontend fixture covering My tab, hidden edit controls, hidden chat tab, and write-entry absence. |
| P1 | 家庭照护人列表 | 我的 Tab 与资料管理 | covered_by_layer | backend |  |
| P0 | DeepSeek 模型 | OpenAI/DeepSeek/Doubao 模型与配置能力 | covered_by_layer | backend |  |
| P0 | Doubao 模型 | OpenAI/DeepSeek/Doubao 模型与配置能力 | covered_by_layer | backend, l2 |  |
| P1 | API Key | OpenAI/DeepSeek/Doubao 模型与配置能力 | covered_by_layer | backend |  |
| P1 | 低延迟默认关闭 | OpenAI/DeepSeek/Doubao 模型与配置能力 | covered_by_layer | frontend |  |
| P0 | 后端健康检查 | 部署、云端与移动更新 | covered_by_layer | cloud, harness |  |
| P1 | 阿里云部署脚本 | 部署、云端与移动更新 | covered_by_layer | cloud |  |
| P1 | 移动 OTA 包 | 部署、云端与移动更新 | covered_by_layer | cloud, native |  |
| P2 | 测试数据重置 | 部署、云端与移动更新 | known_gap | api | Add temp SQLite reset-test-data probe that proves auth/session/business/upload data is cleared without touching production data. |
