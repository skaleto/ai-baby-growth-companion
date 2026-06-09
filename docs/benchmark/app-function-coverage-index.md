# App Function Coverage Index

Updated: 2026-06-07

Generated conceptually from `docs/product/feature-inventory.md` through `scripts/l2-benchmark/app-function-coverage-index.mjs`. This row-level index follows the current Records-first, module-native AI direction.

| Priority | Feature | Area | Status | Coverage owner | Gap / next action |
|---|---|---|---|---|---|
| P0 | 记录默认首页 | 应用壳与导航 | covered_by_layer | frontend | 2026-06-07 `npm run verify:frontend` smoke starts from Records. |
| P0 | 底部四 Tab 导航 | 应用壳与导航 | covered_by_layer | frontend | 2026-06-07 smoke verifies `记录 / 相册 / 账本 / 我的`; no chat/reminder tab. |
| P0 | 固定移动视口 | 应用壳与导航 | covered_by_layer | frontend |  |
| P1 | 模块内 AI 入口 | 应用壳与导航 | covered_by_layer | frontend | Records now owns the lightweight AI composer; standalone chat tab removed. |
| P1 | OTA 更新 | 应用壳与导航 | covered_by_layer | cloud, native |  |
| P2 | 运行版本信息 | 应用壳与导航 | known_gap | frontend | Add My-page runtime info assertion. |
| P0 | 手机号 + 家庭邀请码登录 | 登录、家庭与权限 | covered_by_layer | backend, frontend |  |
| P0 | 新成员身份与权限 | 登录、家庭与权限 | covered_by_layer | backend |  |
| P0 | 状态读取 | 登录、家庭与权限 | covered_by_layer | backend, cloud |  |
| P0 | 写权限拦截 | 登录、家庭与权限 | covered_by_layer | backend, l2 |  |
| P1 | 待确认确认/丢弃 | 登录、家庭与权限 | covered_by_layer | backend, l2 |  |
| P1 | SQLite 启动迁移 | 登录、家庭与权限 | covered_by_layer | backend |  |
| P0 | 记录页轻量 AI 输入 | 记录模块 | covered_by_layer | frontend | `scripts/frontend-smoke.mjs` verifies Records AI quick input and keyboard path. |
| P0 | 喂养手动记录 | 记录模块 | known_gap | frontend, backend | Add manual feeding create/edit/delete probe. |
| P0 | 睡眠手动记录 | 记录模块 | known_gap | frontend, backend | Add manual sleep probe. |
| P0 | 便便/体温/健康记录 | 记录模块 | known_gap | frontend, l0_l1 | Add low/high-risk health boundary checks. |
| P0 | 成长入口与最新值 | 记录模块 | covered_by_layer | frontend |  |
| P0 | 手动新增成长测量 | 记录模块 | covered_by_layer | frontend, backend |  |
| P1 | 成长测量编辑删除 | 记录模块 | covered_by_layer | frontend, backend |  |
| P0 | 里程碑入口 | 记录模块 | covered_by_layer | frontend | Product simplification structure test asserts Records milestone entry and My no longer owns it. |
| P0 | 今日统计可信 | 记录模块 | covered_by_layer | frontend | Keep care-log stats event-detail first. |
| P1 | 当天时间线 | 记录模块 | known_gap | frontend | Verify AI/manual records both appear. |
| P1 | 趋势包含成长 | 记录模块 | covered_by_layer | frontend | Product simplification structure test asserts `growth-trend-card` in Records trends. |
| P1 | 日历回看 | 记录模块 | known_gap | frontend | Add seeded calendar probe. |
| P2 | 空状态低焦虑 | 记录模块 | known_gap | frontend | Assert no nagging missing-record prompts. |
| P0 | 相册上传 | 相册模块 | covered_by_layer | frontend, l0_l1 | AI save_to_album remains disabled; album upload is manual/domain-covered. |
| P0 | 按天分组 | 相册模块 | covered_by_layer | frontend, native | Album groups by `occurredAt` day; media capture date tests cover EXIF/native/file/upload fallback. |
| P1 | 相册预览编辑删除 | 相册模块 | known_gap | frontend | Add album preview/edit/delete probe. |
| P1 | 低打扰 AI 增强 | 相册模块 | known_gap | docs, frontend | Keep P0 without prominent AI center. |
| P2 | 媒体权限与缩略图 | 相册模块 | known_gap | backend, cloud | Add thumbnail and cross-family probe. |
| P0 | 手动记账 | 账本模块 | covered_by_layer | frontend | Frontend smoke opens manual expense editor and checks mobile keyboard/modal layout. |
| P0 | 家庭共享账本 | 账本模块 | covered_by_layer | cloud | Add read-only ledger UI assertion. |
| P0 | AI 记账待确认 | 账本模块 | covered | l2, l0_l1 | Re-back with action tool in migration. |
| P1 | 月度分类统计 | 账本模块 | known_gap | frontend | Add seeded category summary probe. |
| P1 | 图片/小票识别权益 | 账本模块 | known_gap | docs, frontend | Keep as later Pro capability. |
| P2 | 条码/商品查询不回归 | 账本模块 | covered_by_layer | docs, frontend |  |
| P0 | 宝宝资料与家庭成员 | 我的模块 | covered_by_layer | frontend |  |
| P0 | 提醒管理入口 | 我的模块 | covered_by_layer | frontend | Frontend smoke enters reminder management from My profile card; bottom reminder tab removed. |
| P0 | 隐私与法律入口 | 我的模块 | covered_by_layer | frontend, docs |  |
| P1 | Pro/权益说明 | 我的模块 | known_gap | frontend | Explain module capabilities without model settings. |
| P1 | 只读提示 | 我的模块 | known_gap | frontend | Add viewer fixture. |
| P2 | 退出登录 | 我的模块 | covered_by_layer | backend |  |
| P0 | 中文模型上下文 harness | Agent 与模型能力 | covered | l0_l1, docs |  |
| P0 | Tool-first 喂养写入 | Agent 与模型能力 | covered | l2, backend |  |
| P0 | Tool-first 成长待确认 | Agent 与模型能力 | covered | l2, backend |  |
| P0 | Tool-first 账本待确认 | Agent 与模型能力 | covered | l2, backend |  |
| P0 | 最终回复基于工具结果 | Agent 与模型能力 | covered | l0_l1, backend |  |
| P0 | 不提供 AI 提醒工具 | Agent 与模型能力 | covered | l0_l1, backend |  |
| P1 | 纯文本/多模态自适应 | Agent 与模型能力 | covered_by_layer | frontend | Product simplification structure test covers system-selected DeepSeek text and Doubao visual routing. |
| P1 | 医疗安全边界 | Agent 与模型能力 | covered | l0_l1, l2 |  |
| P2 | 会话历史保留 | Agent 与模型能力 | known_gap | backend | Keep data compatible after chat-tab removal. |
| P0 | 语音输入 | 原生、媒体与云端 | known_gap | native, frontend | Add web mock and device probe. |
| P0 | 图片/视频入口权益 | 原生、媒体与云端 | covered_by_layer | frontend | Product simplification structure test covers Pro-gated camera buttons and explanation copy. |
| P1 | 原生通知保留 | 原生、媒体与云端 | known_gap | native | Device probe required. |
| P1 | ECS 代码部署 | 原生、媒体与云端 | covered_by_layer | cloud |  |
| P1 | OTA 发布 | 原生、媒体与云端 | covered_by_layer | cloud, native |  |
| P2 | 数据删除/导出 | 原生、媒体与云端 | known_gap | docs, backend | Release-hardening item. |
