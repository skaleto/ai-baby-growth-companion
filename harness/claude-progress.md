# Progress Log

## Current Verified State

- Repository root: `/Users/bytedance/Documents/ai-baby-growth-companion`
- Branch: `main`
- Standard start path: `bash harness/init.sh`
- Standard smoke gate: `git diff --check`, `npm run build`, `npm run test:agent-benchmark`
- Full gate: `bash harness/init.sh --full`
- Cloud target: `120.55.188.242:8300`
- Current app development roadmap: `harness/app-development-roadmap.md`
- Current highest-priority active feature: none
- Current blocker: none recorded for harness creation

## Session Log

### Session 2026-06-02 Recording Companion P1 Implementation, Git Sync, ECS And OTA

- Goal: 按用户要求实现 P1，并同步 Git、ECS 远端和 OTA 包；继续保持“记录为基线、低焦虑反疲劳设计、数据关联陪伴、不做专家/知识付费/电商/社区”的产品边界。
- Completed:
  - 新增 implementation plan `docs/superpowers/plans/2026-06-02-recording-companion-p1-implementation.md` 并按任务勾选。
  - 扩展 `scripts/test-daily-summary-utils.mjs`，先验证 P1 helper 缺失失败，再实现并通过。
  - 在 `frontend/src/utils/dailySummary.ts` 增加 `buildCaregiverCompanionLine` 和 `buildHandoffSummary`，只基于真实 care/growth/reminder/pending/observation 数据生成低焦虑陪伴句和交接摘要。
  - 在 `DailySummaryView` 中新增 `给照护人的话`、`这些观察怎么来的` disclosure、`今日交接` 分组摘要和 `复制交接`；`App.tsx` 接入 reminders、pendingEffectCount 和剪贴板复制反馈。
  - 更新 `daily-summary.css`，让 P1 note、解释入口和交接卡片在移动视口内稳定排版。
  - 扩展 `scripts/probe-daily-summary-view.mjs`：断言 P1 文案，并额外截取交接区滚动位置。
  - 修复 `scripts/frontend-smoke.mjs` 中固定 `2026-05-19` 未来提醒随日期漂移变过期的问题，并把提醒页断言收紧到 `.reminder-group-upcoming .reminder-item`。
  - 在 `AgentPrompts` 增加照护人疲惫/自责/无助的非诊断陪伴边界，以及自伤/伤害宝宝等高风险线下求助边界；`AgentBenchmarkTests` 增加对应 prompt benchmark。
  - 构建并部署 OTA `0.1.0-20260602232444` 到 `120.55.188.242:8300`，生产数据同步保持 `SYNC_DATA=0`。
- Verification run:
  - `node scripts/test-daily-summary-utils.mjs`（先失败于 P1 helper 未导出，后通过）
  - `npm run build`
  - `npm run test:agent-benchmark`（先失败于 prompt 缺少边界，后 26 tests 通过）
  - `node scripts/probe-daily-summary-view.mjs`
  - `npm run verify:frontend`
  - `MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 MOBILE_UPDATE_MESSAGE='小宝今日观察升级：陪伴一句话、今日交接、记录反馈' npm run build:mobile:update`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/bytedance/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - Production probe: `GET /api/health`, `POST /api/mobile-updates/check` for old/current bundle versions, and bundle checksum download verification.
- Evidence:
  - Probe 截图：`.verification/daily-summary-probe/iphone-13-390x844-1-records-today.png` 显示 P1 首屏陪伴句；`.verification/daily-summary-probe/iphone-13-390x844-1b-records-handoff.png` 显示 `今日交接` 分组摘要和 `复制交接`。
  - `npm run verify:frontend` 通过 desktop + 6 个移动视口 smoke。
  - `npm run test:agent-benchmark` 通过 26 tests，`docs/agent-benchmark-results.md` 已更新。
  - 生产 `http://120.55.188.242:8300/api/health` 返回 `ok`。
  - 生产 OTA check 对旧 bundle 返回 `updateAvailable=true`、版本 `0.1.0-20260602232444`；对当前 bundle 返回 `updateAvailable=false`。
  - 生产 OTA bundle 下载 3321376 bytes，sha256 `087927a33177c969182f89e5c551769b2dd75a11ec68d839147e4d415b4460b2` 与 manifest 匹配。
- Known risks:
  - P1 Agent 情感陪伴目前是 prompt/benchmark 边界，不是独立风险分类器；真实模型输出仍需后续线上观察。
  - 本轮发布的是 Web/OTA 和后端 prompt 更新；未做 native `mobile:sync` 或 iOS/Android debug build，因为没有改 Capacitor/native 配置、权限或 WebView-only 逻辑。

### Session 2026-06-02 Recording Companion P0 Implementation

- Goal: 按 `docs/superpowers/specs/2026-06-02-recording-companion-improvements-design.md` v2 启动 P0 实现，让记录页 today 视图出现单一 `小宝今日观察` 主入口，并强化记录后反馈。
- Completed:
  - 新增 implementation plan `docs/superpowers/plans/2026-06-02-recording-companion-p0-implementation.md`。
  - 新增纯函数测试脚本 `scripts/test-daily-summary-utils.mjs`，先验证 helper 缺失失败，再实现并通过。
  - 在 `frontend/src/utils/dailySummary.ts` 增加 `buildCareStats`、`buildGrowthStats`、`countTodayDataPoints`、`summarizeCareLogEffect`。
  - 扩展 `DailySummaryView` 为 `小宝今日观察`：无 summary 也展示主卡，接入 careLog/growthMeasurements/date/babyNickname/canCaregive/missing actions，展示喂养/睡眠/护理/成长 stat cards，并合入 `整理今天/重新整理`。
  - 移除记录页 today 视图中重复的 `Pro 今日小结` 主卡，保留现有生成、missing dismiss/mute、只读约束。
  - 聊天自动记录反馈改为 `已记好`，展示结构化摘要、去向说明、`查看今天` 和 `撤销`。
  - 更新 `scripts/probe-daily-summary-view.mjs`：fixture 注入 careLog/growthMeasurements，断言 `小宝今日观察`、stat cards、无旧 Pro/生成文案，并修复 probe import/shell wrapper 导致的副作用和退出问题。
- Verification run:
  - `bash harness/init.sh`（开工 baseline，通过 `git diff --check`、`npm run build`、`npm run test:agent-benchmark`）
  - `node scripts/test-daily-summary-utils.mjs`（先失败于 helper 未导出，后通过）
  - `npm run build`
  - `node scripts/probe-daily-summary-view.mjs`
  - `npm run verify:frontend`
  - `npm run test:agent-benchmark`
  - `git diff --check`
- Evidence:
  - Probe 截图：`.verification/daily-summary-probe/iphone-13-390x844-1-records-today.png` 显示 `小宝今日观察`、13 条记录、4 张 stat cards、`重新整理`，且页面下方露出 findings。
  - `npm run verify:frontend` 通过 desktop + 6 个移动视口 smoke。
  - `git diff --check` 通过，`harness/feature_list.json` 可被 JSON.parse。
- Known risks:
  - 本轮实现 P0 主闭环；P1 的数据关联陪伴一句话、今日交接摘要和 AI 隐私说明入口尚未实现。
  - 聊天 `已记好` 卡片目前覆盖自动写入 careLog 的 undo 流；提醒/账本等更完整的分类型记录反馈仍需后续包扩展。

### Session 2026-06-02 Recording Companion Improvements Spec

- Goal: 基于 `harness/app-development-roadmap.md` 和当前 App 实现事实，梳理记录与低焦虑陪伴主线下需要改进和补充的点，并整理成 spec。
- Completed:
  - 核对当前实现：聊天自动/待确认记录、DailySummaryView、Pro 今日小结、成长记录 MVP、Agent 医疗边界和 Daily Summary validator。
  - 新增并细化 spec `docs/superpowers/specs/2026-06-02-recording-companion-improvements-design.md`（v2）。
  - Spec 覆盖 P0/P1：`小宝今日观察` 主卡片、宝宝今天 stat cards、聊天记录成功反馈、反疲劳文案、数据关联陪伴一句话、今日交接摘要、隐私与 AI 使用说明。
  - v2 补充用户旅程、页面状态矩阵、stat card 数据映射、记录反馈卡片类型、文案审计清单、P1 高风险边界、埋点指标、UI probe 场景和 5 个 implementation 拆包建议。
  - 明确非目标：专家/知识付费、电商、开放社区、成长曲线/百分位、睡眠预测、心理诊疗、复杂权限、PDF 儿保资料包、孕期到 3 岁全量扩展。
- Verification run:
  - `bash harness/init.sh`（通过 `git diff --check`、`npm run build`、`npm run test:agent-benchmark`）
  - `git diff --check`
  - `rg -n "TODO|TBD|FIXME|待填|占位|不确定|暂定|xxx|\?\?" docs/superpowers/specs/2026-06-02-recording-companion-improvements-design.md`（唯一命中为“不要强行占位”的普通用词）
- Evidence:
  - Spec 当前只引用 `harness/app-development-roadmap.md` 作为战略源，未从 archive 直接取方向。
- Known risks:
  - 本轮只产出 spec，未进入 implementation plan 或代码实现。

### Session 2026-06-02 Research Archive And Roadmap Promotion

- Goal: 将历史调研/竞品/市场/战略草稿统一归档，只保留当前发展脉络在核心 harness，避免后续 agent 把旧研究结论当成当前方向。
- Completed:
  - 将当前战略源迁移到 `harness/app-development-roadmap.md`。
  - 将历史调研与草稿集中归档到 `docs/research-archive/mother-baby-strategy-2026-06-02/`，并新增 `README.md` 索引和读取规则。
  - 归档范围包括 Claude market/cross-app research、Codex 竞品调研与 slide、未跟踪战略草稿、以及含市场/竞品调研的成长指标旧未来设计。
  - 更新 `harness/README.md` 与 `harness/feature_list.json`，声明 `app-development-roadmap.md` 是当前产品方向 source of truth。
  - 更新 `docs/superpowers/plans/2026-06-01-daily-summary-ai-hub.md`，要求执行前按当前 roadmap Phase 0 校准。
- Verification run:
  - `bash harness/init.sh`（通过 `git diff --check`、`npm run build`、`npm run test:agent-benchmark`）
  - `git diff --check`
- Evidence:
  - Archive index: `docs/research-archive/mother-baby-strategy-2026-06-02/README.md`
- Known risks:
  - 历史文件被移动，旧路径不再可直接读取；需要从 archive index 或当前 roadmap 进入。

### Session 2026-06-02 Recording Companion Development Plan

- Goal: 重点复核 Claude 的 `2026-06-01-market-landscape-positioning.md`，结合 `2026-06-01-cross-app-design-review.md`、Codex 竞品调研和用户最新取舍，形成新的产品发展规划。
- Completed:
  - 对齐并修正 market 文档：保留“中文 AI 情感陪伴 × baby 数据关联”和“反记录疲劳陪伴叙事”，但明确情感陪伴不是心理治疗、专家咨询或知识付费。
  - 将“跨域洞察”从独立卖点降为陪伴和反疲劳体验的支撑能力，避免做成用户无感的技术展示。
  - 明确专家 IP、知识付费、电商不做；社区仅远期观察；孕期到 3 岁延展放到主线验证后。
  - 新增发展规划文档，后续迁移为 `harness/app-development-roadmap.md`。
- Verification run:
  - `bash harness/init.sh`（通过 `git diff --check`、`npm run build`、`npm run test:agent-benchmark`）
- Evidence:
  - 新文档推荐 Phase 0 先做 `小宝今日观察` 品牌化、反疲劳文案、聊天记录成功反馈、stat cards、成长最新值接入。
- Known risks:
  - 本轮仍是战略和产品规划，未进入 UI/后端实现。
  - 原未跟踪草稿已归档为 `docs/research-archive/mother-baby-strategy-2026-06-02/2026-06-02-product-strategy-roadmap-draft.md`。

### Session 2026-06-02 Mother-Baby Competitor Research And Strategy Deck

- Goal: 复核 Claude 近期母婴竞品调研，不直接复述其结论；独立 fan-out 国内/海外/策略/代码现状调研，聚焦“记录和陪伴”而非电商，并整合成可执行的产品方向。
- Completed:
  - 并行调研国内竞品（亲宝宝、宝宝树孕育、育学园、妈妈网孕育、时光小屋、小豆苗）和海外竞品（Baby Tracker、Huckleberry、Glow Baby、The Wonder Weeks、FamilyAlbum、What to Expect、BabyCenter）。
  - 核对 Claude 的 `2026-06-01-cross-app-design-review` 与 `daily-summary-ai-hub` plan，保留“AI 中枢/今日发现品牌化/stat cards/成长最新值接入”的精华，并补充家庭私域、儿保资料包、隐私信任、家庭角色权限和焦虑边界。
  - 落地详细调研文档，后续归档为 `docs/research-archive/mother-baby-strategy-2026-06-02/mother-baby-competitor-research-2026-06-02.md`。
  - 落地本地 HTML slide deck，后续归档为 `docs/research-archive/mother-baby-strategy-2026-06-02/mother-baby-strategy-2026-06-02-slides.html`。
- Verification run:
  - `bash harness/init.sh`（开工 baseline，通过 `git diff --check`、`npm run build`、`npm run test:agent-benchmark`）
  - 静态 slide 校验：10 个 slide、2 张本地图片均存在、无重复 slide id、包含键盘翻页和移动端媒体查询。
- Evidence:
  - 详细来源链接已写入调研文档 §16。
  - 推荐第一轮产品主题为“小宝今日观察：AI 中枢 + 家庭交接 + 成长最新值”。
- Known risks:
  - 本轮没有真机安装国内外竞品，证据主要来自公开 App Store、官网、帮助中心、隐私政策和仓库代码。
  - in-app Browser 拒绝直接打开 `file://` 本地 HTML（URL 安全策略），因此 slide 未做浏览器截图验证；已完成静态资源和结构校验。

### Session 2026-06-01 Merge Growth MVP To Main

- Goal: 将远端分支 `claude/jovial-knuth-c5b390` 合并到最新 `main` 并推送远端。
- Completed:
  - 先将本地 `main` 快进到 `origin/main` 最新 9 个提交。
  - 使用 `--no-ff --no-commit` 合并远端成长记录分支，解决 `docs/agent-benchmark-results.md`、`frontend/src/styles/mobile-app.css`、`harness/claude-progress.md` 三处冲突。
  - 样式冲突保留最新视觉刷新空态插画样式，并合入成长记录 MVP 表单/历史样式。
- Verification run:
  - `bash harness/init.sh`
  - `npm run verify:frontend`
  - `mvn -f backend/pom.xml test`
- Evidence:
  - Harness init passed with production frontend build and Agent benchmark.
  - Frontend verification passed across desktop and six mobile viewports.
  - Backend Maven suite passed with 222 tests, 0 failures, 1 skipped.
- Known risks:
  - 本次只做代码分支集成和本地验证，未部署 Aliyun，也未改生产数据。

### Session 2026-05-31 Growth Measurement MVP Simplification

- Goal: 按 review 建议把成长指标功能收敛成简单可交付的 MVP，并补齐性别、出生体重、出生身长的全链路 UI/状态/持久化验证。
- Completed:
  - 移除 premature 的成长曲线组件、内置 WS/T 423 参考表和未验证的数据抽取说明，避免用复杂参考曲线掩盖当前简单记录需求。
  - 保留并验证资料页中的性别、出生体重、出生身长字段，以及成长页中的身高/体重/头围手动记录、备注和历史列表。
  - 给成长记录输入增加上下限校验，并让后端共享状态按 `growthMeasurement.date` 排序。
  - 扩展前端 smoke：进入成长页、确认历史数据、拒绝 `999cm` 异常身高、记录 `68.2cm` 和备注，并断言页面不再渲染成长曲线。
  - 重新同步 Capacitor 资源，并确认 iOS/Android debug 客户端包都能构建。
- Verification run:
  - `bash harness/init.sh`
  - `npm run build && npm run smoke:frontend`
  - `npm run verify:frontend`
  - `mvn -f backend/pom.xml test`
  - `git diff --check`
  - `npm run mobile:sync`
  - `npm run build:ios:debug`
  - `npm run build:android:debug`
- Evidence:
  - Frontend verification passed across desktop and six mobile viewports.
  - Backend Maven suite passed with 204 tests, 0 failures.
  - Harness init passed with whitespace check, production frontend build, and Agent benchmark with 23 tests.
  - iOS debug build succeeded for iPhone 17 simulator.
  - Android debug APK built at `android/app/build/outputs/apk/debug/app-debug.apk`.
- Known risks:
  - 百分位、WHO/WS 参考曲线、早产校正、AI 解读和提醒仍是 future scope；本轮有意不把这些复杂逻辑塞进 MVP。

### Session 2026-05-26 Codex Placeholder Illustration Integration

- Goal: 接手 `docs/codex-todo-2026-05-26-placeholder-images.md`，为 Visual Refresh Phase 2 的 3 个占位点生成真实插画并替换前端 `Placeholder`。
- Completed:
  - 生成并落地 3 张暖色绘本风透明 PNG 插画：
    - `frontend/src/assets/illustrations/hero-records-today.png`（1024x576，记录页今日发现顶部 hero）
    - `frontend/src/assets/illustrations/empty-ledger.png`（320x240，账本明细空态）
    - `frontend/src/assets/illustrations/empty-reminders.png`（400x300，提醒全空态）
  - `DailySummaryView.tsx`、`LedgerView.tsx`、`App.tsx` 均由 `<Placeholder>` 替换为真实 `<img>` 资产引用；`Placeholder.tsx` 保留备用。
  - 补充图片样式：`daily-summary__hero` 固定 16:9、宽度 100%、object-fit contain；空态插画统一 block + contain；提醒空态插画保留最大宽度。
- Verification run:
  - `bash harness/init.sh`（开始前 baseline：`git diff --check`、`npm run build`、`npm run test:agent-benchmark` 通过）
  - `npm run build`
  - `npm run verify:frontend`
  - `node scripts/probe-daily-summary-view.mjs`
- Evidence:
  - `npm run verify:frontend` 通过 desktop + 6 mobile viewport。
  - `node scripts/probe-daily-summary-view.mjs` 生成 21 张截图；`iphone-13-390x844-1-records-today.png` 顶部显示真实 hero 插画，`iphone-13-390x844-7-reminders.png` 显示真实提醒空态插画。
- Known risks:
  - 账本明细空态插画已接入并通过 build/smoke，但现有专项 probe 没有自动切到账本明细空态截图；后续若改账本空态，可补一条专用视觉 probe。

### Session 2026-05-26 Visual Refresh Phase 2

- Goal: 给 4 个关键插画位置和 1 个加载状态加占位，让 codex 之后可以生成实际图片填充；DailySummaryView 生成 AI 时显示 shimmer skeleton 避免空白。详见 `docs/superpowers/specs/2026-05-26-visual-refresh-plan.md` §Phase 2。
- Completed:
  - 新增 `frontend/src/components/Placeholder.tsx`：友好暖色调占位框，data-placeholder + data-placeholder-spec 属性供 codex 检索，role=img + aria-label="..（占位图）"，支持 kind / aspect / width / height / caption / spec props。
  - 新增 `frontend/src/components/Skeleton.tsx`：宽高/圆角/inline 可配，shimmer 动画 1400ms 循环，prefers-reduced-motion 兜底。
  - 新增 `frontend/src/styles/placeholder.css`：占位虚线边 + 斜纹背景 + lucide ImageIcon 中心 hint + 暖色 caption；shimmer keyframe 用渐变 background-position 移动。
  - 插入 3 个占位（原 spec 4-5 个，但 records/album 空态已有 PNG storybook icon，跳过避免重复）：
    - `hero-records-today`（16:9 banner，DailySummaryView 顶部）
    - `empty-ledger`（160x120，LedgerView 明细空态替换 lucide ReceiptText 通用 icon）
    - `empty-reminders`（200x150，提醒 Tab 4 group 全空时新增显示）
  - DailySummaryView 加 `loading?: boolean` prop。loading=true && !summary → 显示 3 块 Skeleton 模拟 4 模块布局；loading=true && summary → 仍正常渲染不打断；loading=false && !summary → 维持原 null 行为。
  - App.tsx 把 `isGeneratingDailySummary` 传给 DailySummaryView 作为 loading；用户点"生成今日小结"时 shimmer 接替空白。
  - OTA `0.1.0-20260526131339` 上传 OSS（checksum `007a0a1b67dfb0f855e41227c3efcad90898c905a0579074180c795d93776c6e`），manifest 同步 ECS，云端 health=ok。
- Verification run:
  - `npm run build` 多次
  - `npm run verify:frontend` → 7 viewport PASS（hero placeholder + reminders empty placeholder + ledger empty placeholder 均不破坏 layout）
  - `node scripts/probe-daily-summary-view.mjs` → 12 截图确认 hero 出现在 DailySummaryView 顶部、reminders 空态 placeholder + 引导文案显示
  - OTA build → OSS 上传 → ECS manifest 同步 → cloud health 与 OTA check 验证
- Evidence:
  - Records-today 截图：顶部 16:9 暖色虚线框 + ImageIcon + "月龄相关温馨场景" caption，与下方 4 模块自然融合
  - Reminders 截图：4 group 全空时显示 200x150 placeholder + "还没有任何提醒。从上面点一个常用模板开始吧。"
  - Smoke 7 viewport 无 overflow；probe 12 截图无视觉异常
  - 云端 OTA check 返回 `version=0.1.0-20260526131339 message=视觉刷新 Phase 2 占位图+骨架屏`
- Known limitations:
  - **Shimmer skeleton 实际效果未截图验证**：probe fixture 始终有 dailySummary，触发不了 loading=true 路径。需真机点"生成今日小结"按钮观察 shimmer。
  - **Ledger empty placeholder 在明细 tab**：probe 拍的是默认本月 tab，明细 tab 空态 placeholder 未截图。结构正确（build pass）但未视觉验证。
- 待 codex 生成图片（按 data-placeholder kind 检索）：
  - `hero-records-today`：月龄相关温馨场景（如喂奶/哄睡/抓拍），16:9，暖色 pastel
  - `empty-ledger`：钱包或购物袋插画，160x120，暖色
  - `empty-reminders`：铃铛或月历插画，200x150，暖色

### Session 2026-05-26 Visual Refresh Phase 1

- Goal: 把全局视觉从"信息密集"快速变得"轻松活泼"，CSS-only + emoji + 全局动效，零业务改动，立即上线。详见 `docs/superpowers/specs/2026-05-26-visual-refresh-plan.md` §3。
- Completed:
  - DailySummaryView 6 类 finding label 加 emoji 前缀（🤝/🔗/💰/📈/📷/🧠）；4 个 section h3 加装饰 emoji（👶/✨/👀/📝）；facts 从「；」拼接改为 `<ul>` 每条一行。
  - 新建 `frontend/src/styles/motion.css`：`.fade-in` / `.fade-in-up` / `.stagger`（前 6 个子元素逐 40ms 延迟入场）/ `.tab-content-enter`；带 `prefers-reduced-motion` 兜底。
  - 新建 `frontend/src/styles/buttons-tap.css`：全局 `button:active` scale(0.97)；hover 暖色阴影；finding action 增强；带 reduced motion 兜底。
  - DailySummaryView 根 section 加 `stagger`，4 个 inner sections 加 `fade-in-up` —— 首次进入页面 6 个块依次入场。
  - LedgerView root section、App.tsx 6 个 tab section 加 `tab-content-enter`（首次进入动画，tab 切换不重触发因为 sections 始终挂载——已记 known limitation）。
  - 聊天 Tab 5 个 quick pill 加 emoji（🍼/🔔/⭐/💰/🤖），移除冗余 `<img className="quick-icon-img">`，避免 icon + emoji 双图标拥挤。
  - iPhone SE (375px) padding 修复：`@media (max-width: 380px)` 缩 quick-row gap 与 button padding，emoji pill 适配最窄机型。
  - OTA `0.1.0-20260526125222` 已上传 OSS（checksum `b20e600d5c56039ed3d31b6708f135e8ad60c82c160bb8f3d211d88abed0ac7f`），manifest 同步到 ECS，云端 health=ok。
- Verification run:
  - `npm run build`（多次，最终 711ms）
  - `npm run verify:frontend` → 7 viewport PASS（中间一次 iPhone SE pill 溢出被 padding 修复后再次 PASS）
  - `node scripts/probe-daily-summary-view.mjs` → 12 截图（3 viewport × 4 场景）确认 emoji + 入场动画 + tap 反馈视觉无回退
  - OTA build → OSS 上传（需 `JAVA_HOME=Android Studio JDK` + PATH 前置）→ ECS manifest 同步 → cloud health 与 OTA check 验证
- Evidence:
  - DailySummaryView 截图：4 模块均带 emoji 装饰、6 类 finding tag 前缀 emoji 可见、facts 分行渲染
  - 聊天 Tab 截图：5 个 pill 全部 emoji 化、风格统一
  - Smoke 7 viewport 无 overflow 报警；probe 12 截图无视觉异常
  - 云端 OTA check 返回 `version=0.1.0-20260526125222 message=视觉刷新 Phase 1`，签名 OSS URL 下发
- Known risks / limitations:
  - **Tab 切换动画失效**：6 个 tab section 是 always-mounted（CSS display 切换），`tab-content-enter` 只在首次进入页面时跑一次，tab 切换不重新触发。要修需 `key={activeMobileTab}` 强制 remount（会丢内部状态）或 useEffect+class toggle。本期接受 limitation。
  - 真机 reduced-motion 行为未验证（macOS 浏览器测试 prefers-reduced-motion 通常默认 no-preference）。
  - Phase 1 完全没动业务逻辑、后端、数据模型，回滚仅需 revert 几个 commit。
- Phase 2/3/4 留待：
  - Phase 2：5 个关键插画占位 + skeleton loading（codex 生成图片填充）
  - Phase 3：DailySummaryView「宝宝今天」升级为 stat cards + mini sparklines
  - Phase 4：月龄主题 / 节日彩蛋 / 暗色模式

### Session 2026-05-26 Cross-Domain Daily Summary AI

- Goal: 把现有 deterministic 每日小结升级为跨域 AI 信息发现型「今日发现」。仅本地落地代码与文档，不部署，云端部署留待手动决定。
- Completed:
  - 新增 `FindingDto` / `FindingRelated` / `FindingAction` 三个 DTO record，扩展 `DailySummaryDto` 加 `findings` 字段 + 向后兼容 compact constructor。
  - 新增 `DailySummaryPrompts`（system prompt + 6 类 finding type + JSON schema）、`DailySummaryAiClient` functional interface + `DefaultDailySummaryAiClient`（DeepSeek V4 Pro，30s timeout，markdown fence 剥离）。
  - 新增 `DailySummaryFindingValidator`：6 类 type 白名单、10 个禁词（应该/建议/异常 等）、id 存在性校验、action target 格式校验、文本 ≤60 字。7 个单测全部 TDD 覆盖。
  - `CareLogRecordService.getRecentDaysAggregate(familyId, days)` 滑动均值 + `ExpenseItemRecordService.getRecentSimilarExpenses(familyId, productName, months)` fuzzy match，均含 3 个 SpringBootTest 单测。
  - `DailySummaryService.buildSummary()` 串入 AI：稀疏数据 (<3 records) 跳过 AI 调用、JSON 解析失败兜底 deterministic、`sharedSummary()` 持久化 findings 到 family-shared payload。3 个 service-level 集成单测 (mock AI client + mock CurrentUser + mock ProTrialService)。
  - 验证阶段 Pro 围墙暂全员开放：`ProTrialService.isProEnabled` 永远返回 true、`requireProCaregiver` 改为 caregiver-only check；原逻辑保留为 `@SuppressWarnings("unused")` 私有方法。
  - Agent benchmark 加 2 case：信息发现型 6 类 finding 全通过验证器 + 模型异常时 fallback 到空 findings。
  - 前端 `types.ts` 加 `Finding/FindingRelated/FindingAction/FindingType`，`appStateDomain.ts` normalizer 补 findings 默认空数组。
  - 新建 `frontend/src/views/DailySummaryView.tsx`（4 模块 + 6 类 finding 渲染 + action 跳转）+ `frontend/src/utils/dailySummary.ts`（`parseActionTarget`, `FINDING_TYPE_LABEL/COLOR`）+ `frontend/src/styles/daily-summary.css`。
  - `App.tsx` 挂载 `<DailySummaryView />` 在「记录」Tab today 页顶部，`handleFindingActionClick` 处理 ledger/album/milestone/reminder 跳转（milestone 同时切到「我的」Tab，否则 view 不渲染）。「申请 Pro 内测」按钮以 `{false && (...)}` 隐藏。
  - smoke fixture 注入 3 类 sample findings；新建 `scripts/probe-daily-summary-view.mjs` 跨 3 viewport 拍 DailySummaryView + Pro 按钮隐藏 + action 跳转截图。
  - 落地 spec `docs/superpowers/specs/2026-05-26-cross-domain-daily-summary-design.md` + plan `docs/superpowers/plans/2026-05-26-cross-domain-daily-summary.md`。
  - 共 20 个 session commits（含 2 个 Task 8 中途修复 + 1 个 milestone tab 跳转 bug 修复，由 probe 视觉验证抓到）。
- Verification run:
  - `bash harness/init.sh`
  - `mvn test`（IDEA bundled mvn + Android Studio JDK）
  - `npm run test:agent-benchmark`
  - `npm run verify:frontend`
  - `node scripts/probe-daily-summary-view.mjs`（DailySummaryView 跨视口截图 + action 点击流程）
- Evidence:
  - Backend `mvn test`: 222 tests，0 新失败（1 pre-existing `AppStateControllerTests.sharedRecordsReturnContributorAndHydrateExpenseAttachments` 不相关，1 skipped 是本次 Task 9 主动 `@Disabled` 的 Pro gating 测试）。
  - `npm run test:agent-benchmark`: PASS，25 tests（23 原有 + 2 新增）。
  - `npm run verify:frontend`: PASS，desktop + 6 mobile viewports。
  - Probe 截图 12 张（3 viewports × 4 场景），DailySummaryView 4 模块正确渲染、6 类 finding tag 颜色区分、`去账本` action 切到账本 Tab、`标记里程碑` action 切到「我的」Tab 并打开 MilestonesView、「我的」Tab 无 Pro 申请按钮。
- Known risks:
  - 未跑真模型 E2E：所有 backend AI 测试用 mock client；真 DeepSeek 输出质量需上线后用真家庭数据验证。
  - `familyMemberIds` / `familyMemoryIds` / `listFamilyMemory` 当前返回空集合，所以 `memory_recall` / 跨成员关联类 finding 会被 validator 拦截。后续可增强 finding 召回。
  - 缓存语义：`DailySummaryService.read()` 保持 read-only（cache miss 返回 null），只有显式 `generate()` 才调 AI 模型，避免每次刷新页面烧 token。
- Deploy:
  - OTA `0.1.0-20260526122526` 已上传 OSS（checksum `0d7a1c5778448445e6e29d1c2d5b6090aaf501867d98e60435a83db2ef3c0682`），manifest 已同步到 ECS，云端 `/api/health` 返回 `ok`。
  - 部署命令：`SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 SYNC_MOBILE_UPDATE_MANIFEST_ONLY=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/bytedance/.ssh/ai_baby_aliyun npm run deploy:aliyun`，本地 mvn 需 `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home` + IDEA bundled mvn。
  - 真实家庭数据 + DeepSeek 模型质量需用户手动触发"生成今日小结"后观察。
### Session 2026-05-16 Voice Hold Pointer Drift Fix

- Goal: 修复语音按钮按住后手指稍微移动就断开的问题，让移动端按住说话只在松手、取消或页面失焦时结束。
- Completed:
  - 移除语音按住按钮的 `pointerleave` 停止录音逻辑，避免手指自然滑出按钮边界时提前断开。
  - 增加按压会话追踪，并用 window 级 `pointerup` / `pointercancel` / `blur` 兜底收尾；即使 WebView 拒绝 `setPointerCapture`，也能保持按住状态稳定。
  - 重新同步 iOS/Android web 资源，并确认 iOS debug build 通过，方便继续打 iOS 包。
  - 发布 OTA `0.1.0-20260516223427`，消息 `修复语音按住移动中断`，并部署到 Aliyun。
- Verification run:
  - `bash harness/init.sh`
  - `npm run build`
  - `npm run verify:frontend`
  - Local Playwright pointer-drift probe for voice hold.
  - `npm run mobile:sync`
  - `npm run build:ios:debug`
  - `MOBILE_UPDATE_MESSAGE='修复语音按住移动中断' MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
  - `MOBILE_UPDATE_OSS_SSH_TARGET=ai-baby-aliyun SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun scripts/upload-mobile-update-oss.sh`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 SYNC_MOBILE_UPDATE_MANIFEST_ONLY=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - Cloud `/api/health`, OTA check, signed OSS checksum probe, and up-to-date probe.
- Evidence:
  - Frontend verification passed across desktop and six mobile viewports.
  - Local pointer-drift probe stayed in `connecting` after `pointerleave`, then returned to `idle` after `pointerup`.
  - `npm run mobile:sync` passed and copied the updated web assets into iOS/Android projects.
  - `npm run build:ios:debug` succeeded for iPhone 17 simulator.
  - Cloud health returned `ok`.
  - OTA check returns version `0.1.0-20260516223427`; downloaded bundle size was `2641156` bytes and SHA-256 matched manifest checksum `c2bb9c56a60b404f2a8ed967996697c2b02fe2da52cb0ee08f70a34e4c9f6592`.
  - Up-to-date probe using `currentBundleVersion=0.1.0-20260516223427` returned `updateAvailable=false`.
- Known risks:
  - The automated pointer probe mocks browser media/ASR and validates the frontend gesture lifecycle. Real iOS microphone permission state still needs normal device-level validation during packaging or TestFlight install.

### Session 2026-05-16 Chat Attachment Tray Layout

- Goal: 修复聊天输入区多图附件上传时过度拥挤的问题，让 8 张图片场景下附件清单可收起/展开，并顺手优化删除叉叉按钮的样式和对齐。
- Completed:
  - 将 composer 顶部的横向硬挤附件条改成附件摘要层：超过 2 个素材且无上传中任务时默认收起，只展示数量、类型摘要、上限状态和少量缩略预览。
  - 展开后显示固定高度的 2 列附件清单，超过高度内部滚动，不再把模型选择、工具按钮和输入框挤乱。
  - 删除按钮改为 28px 圆形轻按钮，和 30px 缩略图垂直对齐，避免默认方块按钮破坏视觉。
  - 上传中的素材仍保持展开，让用户能看到进度；上传完成后可自动进入可收起状态。
  - 发布 OTA `0.1.0-20260516220400`，消息 `优化多图附件上传层样式`，并部署到 Aliyun。
- Verification run:
  - `bash harness/init.sh`
  - `npm run build`
  - `npm run verify:frontend`
  - Playwright local 8-image attachment tray probe with collapsed and expanded screenshots under `.verification/frontend-smoke/`.
  - `git diff --check`
  - `MOBILE_UPDATE_MESSAGE='优化多图附件上传层样式' MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
  - `MOBILE_UPDATE_OSS_SSH_TARGET=ai-baby-aliyun SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun scripts/upload-mobile-update-oss.sh`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 SYNC_MOBILE_UPDATE_MANIFEST_ONLY=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - Cloud `/api/health`, OTA check, signed OSS checksum probe, and up-to-date probe.
- Evidence:
  - Frontend verification passed across desktop and six mobile viewports.
  - Local 8-image tray probe on 390x844 reported collapsed height 181px, expanded list height 134px, 8 rendered items, and no horizontal overflow.
  - Cloud health returned `ok`.
  - OTA check returns version `0.1.0-20260516220400`; downloaded bundle size was `2640958` bytes and SHA-256 matched manifest checksum `7b504315d9aa9db266035dcd6636d4509120be6b0e990baccd49253502e340f6`.
  - Up-to-date probe using `currentBundleVersion=0.1.0-20260516220400` returned `updateAvailable=false`.
- Known risks:
  - This is a web/OTA layout change only; no native build was run because no Capacitor/native files changed.

### Session 2026-05-16 Agent Skill Runtime Contract And Previous Image Retry

- Goal: 回应“不要靠前端正则判断刚才图片”的架构要求，把 Agent 能力统一到“模型选择 skill、后端 runtime 执行 skill 并做结构化兜底”的策略，并修复上一轮支出图片重试路径。
- Completed:
  - 新增 OpenSpec change `standardize-agent-skill-runtime-contract`，沉淀 Agent skill runtime contract、上一轮媒体引用、支出识别路径和开发验证要求。
  - `AgentPlanner` 支持输出 `skillRequests`，并在 prompt 中要求上一轮/当前支出图片记录请求选择 `expense-recognition` execute。
  - `SkillRouter` 优先执行 planner 选择的 allowlisted executable skill，保留后端 deterministic fallback 作为安全兜底。
  - 前端删除“刚才/上面/之前...花费...再记录”正则转发上一轮附件逻辑；前端只提交当前附件和 recentMessages 附件元数据。
  - `AgentRuntime` 在 `expense-recognition` 被选中且当前请求无图片字节时，按 familyId 从后端附件存储加载最近消息中的视觉附件再执行 skill。
  - `AttachmentStorageService` 增加按附件 id + familyId 读取 dataUrl 的 runtime 入口，避免跨家庭读取。
  - 支出识别分类变成非阻断字段：`月子鞋/月子服` 推断为 `clothing`，`摇奶器/恒温壶/暖奶器/奶瓶/洗衣机` 等推断为 `daily`，不确定用 `other`。
  - skill 未产出完整候选时，runtime 生成 skill-sourced clarification，防止最终模型绕过 skill 平行制造账本候选。
  - 更新 `docs/agent-detailed-design.md` 说明 planner -> skill runtime -> effect/persistence 的统一策略。
  - 发布 OTA `0.1.0-20260516203136`，消息 `统一Agent Skill Runtime并修复支出重试`，并部署后端到 Aliyun。
- Verification run:
  - `bash harness/init.sh`
  - `mvn -f backend/pom.xml -Dtest=AgentPlannerTests,SkillRouterTests,AgentRuntimeTests,ExpenseRecognitionSkillTests,AgentBenchmarkTests test`
  - `openspec validate standardize-agent-skill-runtime-contract --strict`
  - `npm run test:agent-benchmark`
  - `npm run build`
  - `npm run verify:frontend`
  - `mvn -f backend/pom.xml test`
  - `MOBILE_UPDATE_MESSAGE='统一Agent Skill Runtime并修复支出重试' MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
  - `MOBILE_UPDATE_OSS_SSH_TARGET=ai-baby-aliyun SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun scripts/upload-mobile-update-oss.sh`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 SYNC_MOBILE_UPDATE_MANIFEST_ONLY=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - Cloud `/api/health`, OTA check, signed OSS checksum probe, and up-to-date probe.
- Evidence:
  - Targeted backend tests passed: 60 tests, 0 failures.
  - Full backend tests passed: 179 tests, 0 failures.
  - Agent benchmark passed: 23 tests, 0 failures, including previous-image retry without frontend attachment forwarding and category-only non-blocking coverage.
  - Frontend smoke passed across desktop and six mobile viewports.
  - OpenSpec change `standardize-agent-skill-runtime-contract` is valid and all tasks are complete.
  - Cloud health returned `ok`.
  - Cloud OTA check returns version `0.1.0-20260516203136`; downloaded bundle size was `2640023` bytes and SHA-256 matched manifest checksum `6a2ca6559f1441ad8444de3e084b2fe0c802abb97a289fa4d2a559644862bcfc`.
  - Up-to-date probe using `currentBundleVersion=0.1.0-20260516203136` returned `updateAvailable=false`.
- Known risks:
  - Planner model selection is still probabilistic. Backend fallback covers common previous-image retry wording when recent visual metadata exists, but exotic references may still need future benchmark expansion.
  - Real recognition quality still depends on whether the referenced screenshots remain accessible and contain readable actual payment evidence.

### Session 2026-05-16 Cloud AI Temporary Unavailable Root Cause Fix

- Goal: 排查云端为什么在 13777892890 多图支出识别后提示“AI服务暂时不可用”，并修复真实线上故障点。
- Completed:
  - 查云端日志确认 2026-05-16 19:52:16 的失败不是模型厂商、API Key、额度或上传问题；上传链路和 `/api/health` 都正常。
  - 根因定位为新加的支出自动入账持久化在 `agent-stream-*` 异步线程里调用 `CurrentUser.requirePrincipal()`，线程内没有请求登录上下文，抛出 `AUTH_REQUIRED`，随后被前端展示成通用“AI服务暂时不可用”。
  - 为 `AppStateService.persistAgentExpenseCandidates` 增加显式 `familyId/userId` 入口。
  - 修改 Agent 同步与流式路径，在已知 `AuthPrincipal` 的位置把 `familyId/userId` 传入支出识别持久化，避免异步线程再依赖 thread-local 登录上下文。
  - 增加 `AgentRuntimeTests.expenseRecognitionPersistenceUsesExplicitPrincipalForAsyncStreams`，保护该异步保存回归。
  - 已用 `SYNC_DATA=0` 后端-only 方式部署到 Aliyun；未发布 OTA，因为前端 bundle 没变。
- Verification run:
  - `bash harness/init.sh`
  - `mvn -f backend/pom.xml -Dtest=AgentRuntimeTests,AppStateControllerTests,AgentBenchmarkTests test`
  - `npm run test:agent-benchmark`
  - `SYNC_DATA=0 ECS_HOST=120.55.188.242 SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - Cloud `/api/health`
  - Cloud journal probe for `AUTH_REQUIRED` / `Agent stream failed before model stream`
- Evidence:
  - Harness smoke passed before the fix: `git diff --check`, `npm run build`, and `npm run test:agent-benchmark`.
  - Targeted backend tests passed: 65 tests, 0 failures.
  - Agent benchmark passed: 21 tests, 0 failures.
  - Cloud health returned `ok` after deploy.
  - Cloud log shows the original failure at `2026-05-16T19:52:16+08:00`: `Agent stream failed before model stream ... cause=AUTH_REQUIRED`.
  - Cloud log shows new backend started at `2026-05-16T19:57:44+08:00`; no `AUTH_REQUIRED` / `Agent stream failed before model stream` entries appeared after that timestamp in the verification window.
- Known risks:
  - This fix removes the confirmed async-auth failure. A live user retry is still the best end-to-end proof for the exact 8-image conversation path because the real model call depends on current provider response and image legibility.

### Session 2026-05-16 Expense Agent Auto Save Interaction Contract

- Goal: Implement the grilled interaction contract for expense recognition: complete recognized expenses should be saved directly when the user asks to record them, duplicate confirms must be idempotent, category uncertainty must not block recording, and final AI copy must reflect actual saved/duplicate/needs-input state instead of asking again.
- Completed:
  - Added an OpenSpec change at `openspec/changes/improve-expense-agent-recording-flow` covering the new expense Agent recording contract.
  - Added `ExpensePersistenceResult` and backend persistence flow for saved, duplicate, needs-input, and read-only recognized expense candidates.
  - Auto-save complete expense-recognition candidates when the user has clear recording intent; preserve recognition-only requests as read-only.
  - Added stable expense dedupe keys from date, amount, normalized title/merchant, and attachment ids; pending-effect confirmation now uses the same dedupe path so two confirm cards or double confirms cannot insert duplicate expense rows.
  - Extended expense category inference for `月子鞋/月子服` and feeding appliance terms such as `摇奶器/恒温壶/奶瓶/消毒器/温奶器`, with `other` fallback instead of category confirmation.
  - Fed persistence facts into final Agent composition/postprocessing so saved rows show as saved, duplicates are summarized, and stale “确认金额后再记账” copy is replaced.
  - Added a deterministic fallback response when expense persistence already happened but the final model reply fails, so the user still sees saved/duplicate/needs-input facts instead of a generic AI failure.
  - Updated frontend chat handling so auto-saved expenses refresh local ledger state without creating a pending confirmation card, and confirmation buttons enter a `保存中` disabled state to prevent repeated taps.
  - Left existing production duplicate rows untouched per user direction; users can delete unwanted duplicates manually from ledger details.
  - Published backend code plus OTA `0.1.0-20260516194139` with message `优化支出识别自动入账`.
- Verification run:
  - `mvn -f backend/pom.xml -Dtest=AgentBenchmarkTests,AgentRuntimeTests,EffectPolicyTests,AppStateControllerTests,ExpenseRecognitionSkillTests test`
  - `npm run test:agent-benchmark`
  - `npm run build`
  - `npm run verify:frontend`
  - `openspec status --change improve-expense-agent-recording-flow`
  - `openspec validate improve-expense-agent-recording-flow --strict`
  - `MOBILE_UPDATE_MESSAGE='优化支出识别自动入账' MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
  - `MOBILE_UPDATE_OSS_SSH_TARGET=ai-baby-aliyun SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun scripts/upload-mobile-update-oss.sh`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 SYNC_MOBILE_UPDATE_MANIFEST_ONLY=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - `SYNC_DATA=0 ECS_HOST=120.55.188.242 SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - Cloud `/api/health`, OTA check, OSS signed URL download checksum probe, and up-to-date probe.
- Evidence:
  - Targeted backend tests passed: 95 tests, 0 failures.
  - Agent benchmark passed: 21 tests, 0 failures, including `benchmarkSavedExpenseRecognitionDoesNotBecomeConfirmAgainAsk`.
  - Frontend smoke passed across desktop and six mobile viewports.
  - OpenSpec change `improve-expense-agent-recording-flow` is valid and has all artifacts complete.
  - Cloud health returned `ok`.
  - Cloud OTA check returns version `0.1.0-20260516194139`; downloaded bundle size was `2640408` bytes and SHA-256 matched manifest checksum `2999bfa53dc6806f5262b9fcadd39aefeb4406e6055c876552d0b75bb16c08d2`.
  - Up-to-date probe using `currentBundleVersion=0.1.0-20260516194139` returned `updateAvailable=false`.
  - Backend-only redeploy after fallback handling returned cloud health `ok`; OTA up-to-date probe still returned `updateAvailable=false`.
- Known risks:
  - Existing production duplicate expense rows were intentionally not cleaned up.

### Session 2026-05-16 Expense Ledger Id Collision Fix

- Goal: Investigate user `13777892890`'s latest Agent expense recording flow, explain why the prior hospitalization expense was overwritten, and ship guards against repeat ledger overwrites.
- Completed:
  - Inspected production chat, Agent trace, skill trace, pending-effect confirmation requests, and expense rows for family `family-eb3f4751-2df9-46b4-920e-6634c4013d50`.
  - Confirmed the 2026-05-16 17:20 expense image run produced 4 complete expense-recognition candidates, but the final composer also returned the same 4 model expenses, creating 8 pending expense items.
  - Confirmed the previous hospitalization expense was recoverable from 2026-05-12 chat payloads as `芊宝出生住院生产花费` amount `8887.24`, but it is no longer present in `expense_item` because pending expense payloads with fallback ids like `expense-0` were confirmed with `saveOrUpdate`.
  - Fixed frontend expense normalization to generate durable unique ids instead of `expense-${index}` for AI pending expense payloads.
  - Fixed backend pending-effect confirmation to regenerate old fallback ids like `expense-0` and to canonicalize payload `id` to the actual persisted record id.
  - Fixed `EffectPolicy` so executable `expense-recognition` candidates suppress duplicate model expense candidates.
  - Fixed Agent reply postprocessing so an amount question is not appended when the model text already asks for the actual amount.
  - Published backend code plus OTA `0.1.0-20260516173716` with message `修复账本覆盖和重复支出`.
  - After explicit user approval to repair production data, restored the overwritten 2026-04-19 hospitalization expense to `expense_item` as `expense-restored-hospital-mp2lqef1`, preserving the original note and image attachment reference `attachment-mp2lomag-chc0xt`.
- Verification run:
  - `mvn -Dtest=AgentRuntimeTests,EffectPolicyTests,AppStateControllerTests test`
  - `mvn test`
  - `npm run test:agent-benchmark`
  - `npm run verify:frontend`
  - `git diff --check`
  - `MOBILE_UPDATE_MESSAGE='修复账本覆盖和重复支出' MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
  - `MOBILE_UPDATE_OSS_SSH_TARGET=ai-baby-aliyun SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun scripts/upload-mobile-update-oss.sh`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 SYNC_MOBILE_UPDATE_MANIFEST_ONLY=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - Cloud `/api/health`, OTA check, OSS signed URL download checksum probe, and up-to-date probe.
- Evidence:
  - Targeted backend tests passed: 65 tests, 0 failures.
  - Full backend tests passed: 164 tests, 0 failures.
  - Agent benchmark passed: 20 tests, 0 failures.
  - Frontend smoke passed across desktop and six mobile viewports.
  - Cloud health returned `ok`.
  - Cloud OTA check returns version `0.1.0-20260516173716`; downloaded bundle size was `2640325` bytes and SHA-256 matched manifest checksum `c8440860c0dc6a45c20b61737a647efd77a89a6e21d3fca3ad941adcfa4ad329`.
  - Production DB backup was created at `/var/lib/ai-baby-growth-companion/baby-companion.sqlite.before-hospital-restore-20260516094541` before restoring the hospitalization expense.
  - Production `expense_item` now contains `expense-restored-hospital-mp2lqef1` with title `芊宝出生住院生产花费`, amount `8887.24`, date `2026-04-19`, note `总消费额34189.43元，医保报销25302.19元，自费合计8887.24元，其中包含伙食费405元、温馨陪伴费1680元`, and `attachmentIds[0]=attachment-mp2lomag-chc0xt`.
  - Production `attachment` still contains `attachment-mp2lomag-chc0xt` with image metadata, `/api/uploads/attachment-mp2lomag-chc0xt`, and thumbnail path `/api/uploads/attachment-mp2lomag-chc0xt/thumbnail`.
- Known risks:
  - The 2026-05-16 duplicate four expense rows created by the same bug were not deleted in this session; deleting duplicates is a destructive data change and should be done only with explicit user confirmation.

### Session 2026-05-16 Executable Expense Recognition Skill Worker

- Goal: Implement OpenSpec change `add-expense-recognition-skill-worker` so expense screenshot recognition becomes an executable, traceable skill instead of scattered prompt/runtime/postprocess behavior.
- Completed:
  - Added `agent_run` and `skill_run` SQLite tables, MyBatis entities/mappers/services, and `AgentTraceService` with trace payload scrubbing so image `dataUrl`, video bytes, and base64 payloads are not persisted.
  - Added explicit skill modes (`execute`, `disclose`, `guard`), `SkillPlan`, `SkillRouter`, and routing for current expense images plus forwarded previous-image retry attachments.
  - Added model profile configuration for planner, final composer, and expense recognition; expense recognition has independent model, max tokens, temperature, batch size, and retry fields.
  - Added `ExpenseRecognitionSkill` as the first executable skill worker. It runs no-tools, low-temperature visual extraction, batches multi-image requests, forbids web/reference-price lookup, returns structured pending `expenseItem` candidates only when required fields are present, and returns stage-specific Chinese failure/clarification copy otherwise.
  - Integrated the skill into `AgentRuntime` before final composition, injected skill results into the final composer context, kept non-expense visual analysis on the old path, preserved public Agent API compatibility, and recorded agent/skill traces.
  - Updated `EffectPolicy` so complete expense skill candidates are first-class candidates and are not overridden by text-only rule asks; final copy still suppresses redundant “实际花了多少钱” questions when a pending expense already has amount.
  - Deployed backend-only update to Aliyun with `SYNC_DATA=0`; no OTA was published because no frontend bundle assets changed.
- Verification run:
  - `bash harness/init.sh`
  - `mvn -DskipTests compile`
  - `mvn -Dtest=SkillRouterTests,ExpenseRecognitionSkillTests,AgentTraceServiceTests,AgentRuntimeTests,EffectPolicyTests,AgentBenchmarkTests test`
  - `mvn test`
  - `npm run test:agent-benchmark`
  - `npm run verify:frontend`
  - `openspec validate add-expense-recognition-skill-worker`
  - `git diff --check`
  - `SYNC_DATA=0 ECS_HOST=120.55.188.242 SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - Cloud `/api/health`
  - Production SQLite table probe for `agent_run` / `skill_run`
- Evidence:
  - Targeted backend tests passed: 69 tests, 0 failures.
  - Full backend tests passed: 161 tests, 0 failures.
  - Agent benchmark passed: 20 tests, 0 failures, with new coverage for one-image expense skill draft, 8-image batching without web search, previous-image retry routing, and no redundant amount ask.
  - Frontend smoke passed across desktop and six mobile viewports.
  - OpenSpec validation passed for `add-expense-recognition-skill-worker`.
  - Cloud health returned `ok`.
  - Production DB `/var/lib/ai-baby-growth-companion/baby-companion.sqlite` contains `agent_run` and `skill_run`.
- Known risks:
  - Real recognition quality still depends on image legibility and model output; the skill now returns stage-specific failure or clarification instead of pretending an unreadable image is a normal missing-amount text request.
  - The first implementation executes expense image batches sequentially. This is simpler and safer for provider load, but a later latency pass can evaluate bounded parallelism.

### Session 2026-05-16 Previous Expense Retry And Postprocess Copy

- Goal: Fix user `13777892890`'s follow-up request to "record the above expenses again" and stop rule postprocessing from wiping out useful model text.
- Completed:
  - Confirmed production data showed the latest parent message had no new attachments and the AI reply was generated by a rule `ask` decision for a missing expense amount.
  - Added frontend retry forwarding: when the user references prior expense images (`刚才/上面/之前...花费...再记录`), the chat request reuses the most recent visual attachments for Agent analysis without showing duplicate attachments on the new message.
  - Adjusted expense effect policy so previous-expense retry wording does not become a brand-new missing-amount ask before the model can use prior images or context.
  - Changed Agent text postprocessing to preserve model text and append clarification questions when needed, instead of replacing the whole reply; existing boundary copy is also preserved when the model already explains the limitation.
  - Updated the Agent prompt to treat previous-expense retry wording as a contextual retry, not a new incomplete expense.
  - Published backend code plus OTA `0.1.0-20260516152314`.
- Verification run:
  - `mvn -q -Dtest=AgentRuntimeTests test`
  - `npm run test:agent-benchmark`
  - `npm run verify:frontend`
  - `MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
  - `MOBILE_UPDATE_OSS_SSH_TARGET=ai-baby-aliyun scripts/upload-mobile-update-oss.sh`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 SYNC_MOBILE_UPDATE_MANIFEST_ONLY=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - Cloud `/api/health`, OTA check, and OSS signed URL download checksum probe.
  - `bash harness/init.sh`
- Evidence:
  - `AgentRuntimeTests` now covers preserving model text when a rule clarification is added and deferring rule amount asks for previous expense image retries.
  - Agent benchmark passed and refreshed `docs/agent-benchmark-results.md`.
  - Frontend smoke passed across desktop and six mobile viewports.
  - Cloud health returned `ok`.
  - Cloud OTA check returns version `0.1.0-20260516152314` with signed OSS URL for `/baby-companion/mobile-updates/app-0.1.0-20260516152314.zip`.
  - Downloaded bundle size was `2640317` bytes and SHA-256 matched manifest checksum `455a69da31438dc9f37aa6866ab7e8574d668b7b4540ee6e061ef15c41502d44`.
  - Final harness init passed after the release.
- Known risks:
  - A retry can only succeed when the referenced prior attachments remain accessible and the images contain readable real payment information; otherwise the Agent should now explain the missing evidence instead of pretending it is a new expense with no amount.

### Session 2026-05-16 Batched Multi Image Agent Analysis

- Goal: Replace the previous timeout-only mitigation with real automatic multi-image batching for AI visual analysis.
- Completed:
  - Added backend automatic visual batching: when a request has more than 4 visual inputs, the Agent runs separate non-stream model OCR/visual-summary calls in batches of up to 4, then feeds those summaries into the final response request without re-attaching all images.
  - Added per-batch SSE progress text such as `正在分批分析 8 张图片`, `正在分析第 1/2 批图片`, and `正在整理图片分析结果`.
  - Preserved the 4-or-fewer path as a single visual request to avoid making small requests slower.
  - Added usage tracking label support for `agent_visual_analysis`.
  - Updated timeout copy to say the Agent already attempted batching before asking the user to reduce or split images.
  - Published backend code plus OTA `0.1.0-20260516145942` with message `多图AI自动分批分析`.
- Verification run:
  - `bash harness/init.sh`
  - `npm run build`
  - `mvn -Dtest=AgentRuntimeTests test`
  - `mvn test -q`
  - `npm run verify:frontend`
  - `npm run test:agent-benchmark`
  - `MOBILE_UPDATE_MESSAGE='多图AI自动分批分析' MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
  - `MOBILE_UPDATE_OSS_SSH_TARGET=ai-baby-aliyun scripts/upload-mobile-update-oss.sh`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 SYNC_MOBILE_UPDATE_MANIFEST_ONLY=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - Cloud `/api/health`, OTA check, OSS signed URL download, checksum probe, and up-to-date probe.
- Evidence:
  - `AgentRuntimeTests` now covers splitting 8 visual inputs into 2 batches of 4, while keeping 4 visual inputs unbatched.
  - Backend full Maven tests passed.
  - Frontend smoke passed across desktop and six mobile viewports.
  - Agent benchmark passed and kept the expense-image no-web-search case green.
  - Cloud health returned `ok`.
  - Cloud OTA check returns version `0.1.0-20260516145942`, signed OSS host `ai-baby-growth-companion.oss-cn-hangzhou.aliyuncs.com`, and object path `/baby-companion/mobile-updates/app-0.1.0-20260516145942.zip`.
  - Downloaded bundle size was `2639905` bytes and SHA-256 matched manifest checksum `9f4e5454bd1d9c5e842a69e8981f975b5e757a7d5b339a0678b36a45815d9a98`.
  - Up-to-date probe using `currentBundleVersion=0.1.0-20260516145942` returned `updateAvailable=false`.
- Known risks:
  - Batched visual analysis is sequential in this release to avoid overloading provider concurrency; it improves reliability and transparency, but the next performance pass can evaluate limited parallelism if latency remains high.

### Session 2026-05-16 Multi Image Agent Availability

- Goal: Investigate user `13777892890`'s latest 8-image expense recognition failure and remove misleading in-chat status copy while improving AI vision availability.
- Completed:
  - Checked production logs for `13777892890` and confirmed the 8 image uploads completed successfully; the failure was a Doubao model stream timeout while analyzing image input, not upload failure.
  - Confirmed the UI stayed on `查找相关记录` because no later SSE status was emitted before the long model stream call.
  - Added backend model-work status events so clients see `正在分析 N 张图片` / `正在生成回复`; kept a compatible `retrieving_context` update so older clients still see truthful text.
  - Added frontend stream status handling for `analyzing_media` and `generating`, with chips `分析中` / `生成中`.
  - Added frontend image downscaling for the AI vision copy before sending attachments to the model, while preserving the original uploaded attachments in storage.
  - Raised Doubao read timeout default from `60s` to `120s` and replaced raw timeout errors with actionable image-analysis timeout copy.
  - Published backend code plus OTA `0.1.0-20260516144004` with message `优化多图AI分析提示和可用性`.
- Verification run:
  - `bash harness/init.sh`
  - `npm run build`
  - `mvn -Dtest=AgentRuntimeTests test`
  - `mvn test -q`
  - `npm run verify:frontend`
  - `npm run test:agent-benchmark`
  - `MOBILE_UPDATE_MESSAGE='优化多图AI分析提示和可用性' MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
  - `MOBILE_UPDATE_OSS_SSH_TARGET=ai-baby-aliyun scripts/upload-mobile-update-oss.sh`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 SYNC_MOBILE_UPDATE_MANIFEST_ONLY=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - Cloud `/api/health`, OTA check, OSS signed URL download, checksum probe, and up-to-date probe.
- Evidence:
  - Production log chain showed 8 upload presign/complete pairs succeeded, then `Agent model stream failed ... provider=DOUBAO ... cause=request timed out`.
  - Backend full Maven tests passed.
  - Frontend smoke passed across desktop and six mobile viewports.
  - Agent benchmark passed and kept the expense-image no-web-search case green.
  - Cloud health returned `ok`.
  - Cloud OTA check returns version `0.1.0-20260516144004`, signed OSS host `ai-baby-growth-companion.oss-cn-hangzhou.aliyuncs.com`, and object path `/baby-companion/mobile-updates/app-0.1.0-20260516144004.zip`.
  - Downloaded bundle size was `2639867` bytes and SHA-256 matched manifest checksum `c677fb3cd5fcc5eac4eeae5492f15113670b528335cad9dc06cb0618c0b433bf`.
  - Up-to-date probe using `currentBundleVersion=0.1.0-20260516144004` returned `updateAvailable=false`.
- Known risks:
  - Real 8-image OCR quality still depends on the model and image legibility; the fix reduces payload size and timeout risk but does not guarantee every low-quality receipt or screenshot can be read.

### Session 2026-05-16 Expense Fix Cloud And OTA Release

- Goal: Review the cross-session OTA upload/download path changes, then commit, push, and release the current backend plus a fresh OTA bundle.
- Completed:
  - Checked the OTA path chain: `build-mobile-update.sh` writes the local bundle/manifest, `upload-mobile-update-oss.sh` uploads the zip to OSS and rewrites manifest with `ossObjectKey`, `deploy-aliyun-ecs.sh` can sync only `manifest.json`, and `MobileUpdateService` signs a fresh OSS URL from `ossObjectKey`.
  - Confirmed the current cloud service has `APP_STORAGE_MODE=oss`, OSS endpoint/bucket/prefix configured, and the existing production manifest already uses `baby-companion/mobile-updates/...`.
  - Built fresh OTA version `0.1.0-20260516140358` with message `修复多图记账并优化OTA下载`.
  - Uploaded `app-0.1.0-20260516140358.zip` to OSS under `baby-companion/mobile-updates/` and deployed backend code plus manifest-only OTA metadata to Aliyun `120.55.188.242:8300` without syncing production data.
- Verification run:
  - `bash harness/init.sh`
  - `mvn test -q`
  - `npm run verify:frontend`
  - `MOBILE_UPDATE_MESSAGE='修复多图记账并优化OTA下载' MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
  - `MOBILE_UPDATE_OSS_SSH_TARGET=ai-baby-aliyun scripts/upload-mobile-update-oss.sh`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 SYNC_MOBILE_UPDATE_MANIFEST_ONLY=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - Cloud `/api/health`, OTA check, OSS signed URL download, checksum probe, and up-to-date probe.
- Evidence:
  - Backend full Maven tests passed.
  - Frontend smoke passed across desktop and six mobile viewports.
  - Cloud health returned `ok`.
  - Cloud OTA check returns version `0.1.0-20260516140358`, signed OSS host `ai-baby-growth-companion.oss-cn-hangzhou.aliyuncs.com`, and object path `/baby-companion/mobile-updates/app-0.1.0-20260516140358.zip`.
  - Downloaded bundle size was `2638963` bytes and SHA-256 matched manifest checksum `4a98ea216826e56cdde2115d8a721b9a6fb8b7a9463d73ed319fbaf9b093dde2`.
  - Up-to-date probe for current bundle `0.1.0-20260516140358` returned `updateAvailable=false`.
- Known risks:
  - The OTA URL is a signed temporary OSS URL; clients should download soon after each check, and later checks will receive a fresh URL.

### Session 2026-05-16 OTA Bundle OSS Download Optimization

- Goal: Fix slow OTA bundle downloads by reducing mobile OTA bundle size and serving bundles from OSS instead of ECS public bandwidth.
- Completed:
  - Added a mobile-only frontend entry (`frontend/src/main.mobile.tsx`) and Vite mobile entry transform so `build:mobile:update` excludes website-only `/official` code and large landing assets.
  - Updated `scripts/build-mobile-update.sh` to set `VITE_BUILD_TARGET=mobile` and support explicit external bundle URL/base configuration.
  - Added `scripts/upload-mobile-update-oss.sh` to upload the generated OTA zip to Aliyun OSS using the existing OSS SDK dependency and rewrite the manifest with an `ossObjectKey`.
  - Updated `MobileUpdateService` so manifests with an OSS object key return a fresh signed OSS download URL during `/api/mobile-updates/check`.
  - Updated deployment flow with `SYNC_MOBILE_UPDATE_MANIFEST_ONLY=1` for OSS-hosted OTA bundles.
  - Built and published OTA `0.1.0-20260516134621` with message `优化OTA下载速度`.
  - Uploaded `app-0.1.0-20260516134621.zip` to OSS under `baby-companion/mobile-updates/` and synced only the manifest to Aliyun ECS.
- Verification run:
  - `MOBILE_UPDATE_MESSAGE='优化OTA下载速度' MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
  - `MOBILE_UPDATE_OSS_SSH_TARGET=ai-baby-aliyun scripts/upload-mobile-update-oss.sh`
  - `mvn -Dtest=MobileUpdateControllerTests test`
  - `npm run verify:frontend`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 SYNC_MOBILE_UPDATE_MANIFEST_ONLY=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - Cloud `/api/health`, OTA check, OSS bundle download, checksum probe, and up-to-date probe
  - `mvn test`
  - `git diff --check`
- Evidence:
  - Mobile OTA zip reduced from `6088639` bytes to `2638968` bytes; the mobile bundle no longer includes `hero-companion` or `splash-mark`.
  - Cloud OTA check returns version `0.1.0-20260516134621` with a signed OSS URL.
  - OSS download probe returned `200`, downloaded `2638968` bytes in `0.291882s`, and SHA-256 matched manifest checksum `e8c4b04e614e4ac25b93ea4a8546de7cb96b5af3b161e026697be0097c883a4a`.
  - Previous ECS bundle path for `6088639` bytes took `48.134758s` locally; server-local `127.0.0.1` was fast, confirming the old bottleneck was ECS public bandwidth plus bundle size.
  - Backend full Maven test passed: 141 tests, 0 failures.
  - Frontend smoke passed across desktop plus iPhone SE, iPhone 13, iPhone Pro Max, Android compact, Android Pixel, and Android large viewports.
  - Cloud up-to-date check for current bundle `0.1.0-20260516134621` returned `updateAvailable=false`.
- Known risks:
  - OSS signed URLs currently use the existing OSS signed URL TTL, so clients should start the download soon after each OTA check; future checks receive a fresh URL.
  - One large in-app image (`alarm-scene`, about 1.6MB) remains in the mobile bundle and can be compressed in a later asset pass.

### Session 2026-05-16 Pro AI Usage Display

- Goal: Let users see family AI token usage in the app and expose a family-scoped usage API.
- Completed:
  - Added `GET /api/pro/usage` to return current-family AI usage for a requested day window.
  - Added family-scoped usage aggregation by total, feature, and model using existing `ai_usage_log` records.
  - Added the Pro profile card AI usage panel with recent token total, call count, input/output split, top feature chips, model note, and refresh action.
  - Added frontend smoke mock data for `/api/pro/usage`.
  - Deployed the backend code-only update to Aliyun and published OTA `0.1.0-20260516125242`.
- Verification run:
  - `bash harness/init.sh`
  - `mvn -Dtest=ProTrialControllerTests test`
  - `mvn test`
  - `npm run build`
  - `npm run verify:frontend`
  - `git diff --check`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - Cloud `/api/health`, unauthenticated `/api/pro/usage`, OTA check, and OTA bundle HEAD probes
- Evidence:
  - Backend full Maven test passed: 135 tests, 0 failures.
  - Frontend smoke passed across desktop plus iPhone SE, iPhone 13, iPhone Pro Max, Android compact, Android Pixel, and Android large viewports.
  - Cloud health returned `ok`.
  - Cloud unauthenticated `/api/pro/usage` returned `401`, confirming the route is present and protected.
  - OTA check returns version `0.1.0-20260516125242` with message `新增 AI 用量统计`.
  - Bundle `app-0.1.0-20260516125242.zip` returned HTTP 200 with `Content-Length: 6088639`.
- Known risks:
  - Some streaming provider calls still do not return token usage, so the panel separately notes unmetered stream calls when they exist.
  - Live authenticated `/api/pro/usage` was covered by backend tests, but not probed against a production user token in this session.

### Session 2026-05-16 Reminder Icon Polish

- Goal: Make reminder task icons clearer and less visually harsh on the reminders page.
- Completed:
  - Changed reminder list icons from strong filled color blocks to soft outlined badges in the warm theme.
  - Increased reminder card icon size slightly for better legibility.
- Verification run:
  - `npm run verify:frontend`
  - `git diff --check`
  - `MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 MOBILE_UPDATE_MESSAGE='优化提醒待办图标显示' npm run build:mobile:update`
  - Manual `rsync` of `backend/data/mobile-updates/` to `/var/lib/ai-baby-growth-companion/mobile-updates/`
  - Cloud OTA check and bundle HEAD request
- Evidence:
  - Frontend build passed.
  - Frontend smoke passed across desktop plus iPhone SE, iPhone 13, iPhone Pro Max, Android compact, Android Pixel, and Android large viewports.
  - OTA version `0.1.0-20260516123512` is available from `http://120.55.188.242:8300/api/mobile-updates/check`.
  - Bundle `app-0.1.0-20260516123512.zip` returned HTTP 200 with `Content-Length: 6087325`.
- Known risks:
  - Visual taste still needs confirmation on the user's real device because the smoke screenshots do not contain the exact production reminder content shown in the user screenshot.

### Session 2026-05-16 KISS Structure Refactor

- Goal: Reduce frontend/backend structural debt while preserving existing business behavior.
- Completed:
  - Extracted frontend option/config constants from `App.tsx` into `frontend/src/appOptions.ts`.
  - Extracted the reusable `StorySelect` control from `App.tsx` into `frontend/src/components/StorySelect.tsx`.
  - Split StorySelect base styles from `styles.css` into `frontend/src/styles/story-select.css`.
  - Extracted Agent prompt text from `AgentRuntime` into `AgentPrompts`.
  - Extracted attachment MIME, dataURL, size-limit, and kind-normalization rules from `AttachmentStorageService` into `AttachmentUploadRules`.
  - Split `frontend/src/styles.css` into ordered stylesheet modules under `frontend/src/styles/`, leaving `styles.css` as the import hub.
  - Moved app state normalization, reminder/date parsing, legacy local-state, and profile helper functions from `App.tsx` into `frontend/src/appStateDomain.ts`.
  - Extracted `StorybookScene` and `AlbumVideoThumbnail` from `App.tsx` into focused component files.
  - Kept the prior state hydration KISS cleanup in `AppStateService` and related controller test alignment.
- Verification run:
  - `bash harness/init.sh`
  - `npm run build`
  - `mvn test`
  - `npm run verify:frontend`
  - `git diff --check`
- Evidence:
  - Harness smoke passed before the additional refactor.
  - Frontend build passed after component/config extraction.
  - Frontend build passed after the stylesheet/domain/component split.
  - Backend full Maven test passed: 134 tests, 0 failures.
  - Frontend smoke passed across desktop plus iPhone SE, iPhone 13, iPhone Pro Max, Android compact, Android Pixel, and Android large viewports.
- Known risks:
  - This was intentionally a low-risk structural split; `App.tsx`, `styles.css`, `AgentRuntime`, and `AttachmentStorageService` are smaller but still large enough to justify future domain-by-domain extraction after behavior-specific coverage is in place.

### Session 2026-05-14 OTA Timeout Diagnosis

- Goal: Diagnose why the mobile OTA update failed in the installed app and patch the updater timeout path.
- Completed:
  - Verified the cloud OTA check endpoint returns an update for `0.1.0-20260514185558`.
  - Verified the cloud bundle endpoint returns `200`, `Content-Length: 6086147`, and the downloaded zip checksum matches the manifest.
  - Confirmed the zip archive is valid with `unzip -t`.
  - Checked cloud logs and found mobile bundle downloads completed with `200` but took about 25 seconds.
  - Identified the likely failure: Capgo Capacitor Updater defaults `responseTimeout` to 20 seconds, so the installed native plugin can time out before the slow bundle download finishes.
  - Raised Capacitor Updater `responseTimeout` to 120 seconds and improved user-facing OTA failure copy for timeout/checksum/unzip cases.
  - Synced native projects and rebuilt Android/iOS debug targets.
  - Published a fresh OTA bundle `0.1.0-20260514190632`.
- Verification run:
  - Cloud `POST /api/mobile-updates/check`
  - Cloud `HEAD /api/mobile-updates/bundles/app-0.1.0-20260514185558.zip`
  - Local download + `shasum -a 256` + `unzip -t`
  - `npm run mobile:sync`
  - `VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:android:debug`
  - `VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:ios:debug`
  - `MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 SKIP_BACKEND_BUILD=1 ECS_HOST=120.55.188.242 SSH_KEY=<configured-key> npm run deploy:aliyun`
  - Cloud `POST /api/mobile-updates/check`
- Evidence:
  - Manifest checksum `9438f6c348102ae41824c752edcc6b8bff4afb1d14a7280241201bcfb594e1c5` matched the downloaded `0.1.0-20260514185558` zip.
  - `unzip -t` reported no archive errors.
  - Cloud logs showed `GET /api/mobile-updates/bundles/app-0.1.0-20260514185558.zip status=200 durationMs=24981` and another successful download around 25 seconds.
  - Android debug APK built at `android/app/build/outputs/apk/debug/app-debug.apk`.
  - iOS simulator build completed with `BUILD SUCCEEDED`.
  - Cloud OTA check now returns version `0.1.0-20260514190632`.
- Known risks:
  - The timeout fix changes native plugin configuration, so already-installed old packages still need a new native install before OTA becomes reliable on slow downloads.
  - Real-device OTA should be re-tested after reinstalling the new native package.

### Session 2026-05-14 Official Site Port 80 Deployment

- Goal: Publish the current official website build to Aliyun `120.55.188.242` on port `80` without touching production data.
- Completed:
  - Ran the standard harness smoke gate before deployment.
  - Rebuilt the frontend with `VITE_AGENT_API_BASE_URL=` so browser API calls use same-origin `/api` instead of a local development host.
  - Uploaded the `dist/` build to the ECS and served it from `/var/www/xiaobaoji`.
  - Installed and enabled Nginx on the ECS.
  - Configured Nginx to listen on port `80`, serve the SPA with fallback to `index.html`, cache `/assets/`, and reverse-proxy `/api/` to `127.0.0.1:8300`.
  - Ran the frontend smoke gate, then rebuilt and republished the same-origin production bundle.
- Verification run:
  - `bash harness/init.sh`
  - `npm run verify:frontend`
  - `VITE_AGENT_API_BASE_URL= npm run build`
  - `rg "localhost:8080|120\\.55\\.188\\.242:8300|/api/health" dist -n || true`
  - Remote `nginx -t`
  - Remote `curl -fsSI http://127.0.0.1/official`
  - Remote `curl -fsS http://127.0.0.1/api/health`
  - Local `curl -fsSI http://120.55.188.242/official`
  - Local `curl -fsS http://120.55.188.242/api/health`
  - Playwright smoke against `http://120.55.188.242/official`
- Evidence:
  - Harness smoke passed.
  - Frontend smoke passed across desktop and configured mobile viewports.
  - Production frontend build passed and did not contain `localhost:8080`.
  - Nginx syntax check passed and service is active.
  - ECS listeners include `0.0.0.0:80`, `[::]:80`, and backend `*:8300`.
  - Public `http://120.55.188.242/official` returned `200 OK`.
  - Public `http://120.55.188.242/api/health` returned `ok`.
  - Playwright verified title `小宝记官网`, H1 `小宝记`, and mobile scroll changed from `0` to `900`; screenshot saved under `.verification/official-site/cloud-official-mobile.png`.
- Known risks:
  - Download QR links are still placeholders until real iOS and Android package URLs are provided.

### Session 2026-05-14 Pro Trial Daily Summary OpenSpec Implementation

- Goal: Implement the OpenSpec change `add-pro-trial-daily-summary` for Pro trial application, family-scoped Pro status, AI usage logging, Pro daily summary, conservative missing-item prompts, and account-level daily summary reminders.
- Completed:
  - Added OpenSpec artifacts under `openspec/changes/add-pro-trial-daily-summary/` and marked implementation tasks through verification.
  - Added SQLite persistence for `pro_trial_application`, `pro_trial_entitlement`, `ai_usage_log`, `daily_summary`, and `daily_summary_setting`.
  - Added backend Pro APIs under `/api/pro/*` and surfaced Pro state, current daily summary, and daily summary settings in `/api/app/state`.
  - Added AI usage logging across backend model invocation paths and daily summary generation.
  - Added deterministic daily summary generation from family-shared data only, with account-private reminders/pending items shown only as current-account prompts and not persisted into the family summary payload.
  - Added frontend Pro entry points in the Record Today page, My page, and visual AI trigger path; non-Pro visual AI triggers now submit/show Pro trial flow without calling the high-cost model.
  - Added account-level daily summary reminder settings, mobile local notification scheduling, and notification click navigation to the Record Today page.
  - Added backend Pro controller tests and Agent benchmark boundary cases for gentle missing-item copy and private-content exclusion.
  - Deployed the code-only backend update to Aliyun `120.55.188.242:8300` with `SYNC_DATA=0`, preserving cloud SQLite data and uploaded files.
  - Marked the OpenSpec implementation task list complete through commit/push handoff.
- Verification run:
  - `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" "/Applications/IntelliJ IDEA.app/Contents/plugins/maven/lib/maven3/bin/mvn" -Dtest=ProTrialControllerTests test -q`
  - `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" "/Applications/IntelliJ IDEA.app/Contents/plugins/maven/lib/maven3/bin/mvn" test -q`
  - `npm run test:agent-benchmark`
  - `npm run build`
  - `npm run verify:frontend`
  - `npm run mobile:sync`
  - `npm run build:android:debug`
  - `npm run build:ios:debug`
  - `bash harness/init.sh`
  - `SYNC_DATA=0 ECS_HOST=120.55.188.242 SSH_KEY=<configured-key> npm run deploy:aliyun`
  - `curl -fsS http://120.55.188.242:8300/api/health`
- Evidence:
  - Backend full Maven test passed.
  - `docs/agent-benchmark-results.md` reports PASS, 15 tests, 0 failures.
  - Frontend smoke passed across desktop and configured mobile viewports.
  - Android debug APK built at `android/app/build/outputs/apk/debug/app-debug.apk`.
  - iOS simulator build completed with `BUILD SUCCEEDED`.
  - Cloud health returned `ok` after deployment.
- Known risks:
  - Daily summary generation is currently deterministic rule-based rather than a paid model call; usage is still logged as `daily_summary` for cost pipeline compatibility.
  - Daily summary reminder delivery was build-verified only; real-device notification behavior should be validated on Android/iOS before inviting beta families.
  - OpenSpec change is implemented but not archived.

### Session 2026-05-14 Frontend Directory Release Flow Check

- Goal: Verify the current release flow after moving frontend source/config into `frontend/`, without changing cloud production state.
- Completed:
  - Confirmed the standard harness smoke gate still works from the repository root.
  - Built the web app through the new `frontend/vite.config.ts` path.
  - Built an OTA bundle with `MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300` and `VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300`.
  - Built Android debug APK with cloud API URL.
  - Built iOS simulator debug app with cloud API URL.
  - Confirmed the current cloud health endpoint returns `ok`.
- Verification run:
  - `git diff --check`
  - `bash harness/init.sh`
  - `npm run verify:frontend`
  - `MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
  - `VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:android:debug`
  - `VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:ios:debug`
  - `curl -fsS http://120.55.188.242:8300/api/health`
- Evidence:
  - Harness smoke passed, including frontend build and Agent benchmark.
  - Frontend verification passed across configured mobile/desktop viewports.
  - OTA bundle generated as `0.1.0-20260514151614`.
  - Android debug APK built at `android/app/build/outputs/apk/debug/app-debug.apk`.
  - iOS simulator build completed with `BUILD SUCCEEDED`.
  - Cloud health returned `ok`.
- Known risks:
  - Cloud deployment was intentionally not executed in this check because the deploy script has no dry-run mode and would restart the live service.

### Session 2026-05-14 OTA Progress Display

- Goal: Make OTA download progress truthful instead of showing a fake `0%` state until completion.
- Completed:
  - OTA download UI now starts in an indeterminate “下载中” state until the native updater emits a real positive percent.
  - Native download events are logged with their raw payload and parsed progress to help diagnose platform-specific progress behavior.
  - Frontend smoke now covers mobile update notice rendering for indeterminate and determinate progress.
  - Reminder sheet bottom spacing was widened slightly after the frontend gate exposed a 360px safe-area edge miss.
- Verification run:
  - `npm run build`
  - `npm run verify:frontend`
- Evidence:
  - `npm run build` passed.
  - `npm run verify:frontend` passed across desktop and six mobile viewports, including OTA progress notice smoke coverage.
- Known risks:
  - If the native updater only emits `0` and `100` on a platform/update path, the UI will honestly show an indeterminate download state and then completion; it will not invent intermediate percentages.

### Session 2026-05-13 Harness Baseline

- Goal: Build a repo-local harness based on the Learn Harness Engineering template, with only `AGENTS.md` at root and all new harness files under `harness/`.
- Completed:
  - Upgraded root `AGENTS.md` into the standard agent entrypoint.
  - Added harness files for feature tracking, progress, init, quality, cleanup, handoff, and evaluator rubric.
  - Kept existing frontend verification instructions and linked them into the harness rules.
- Verification run:
  - `bash harness/init.sh`
- Evidence:
  - Passed `git diff --check`.
  - Passed `npm run build`.
  - Passed `npm run test:agent-benchmark` with 13 tests, 0 failures, result written to `docs/agent-benchmark-results.md`.
- Known risks:
  - Existing uncommitted product changes predate this harness task and must not be reverted by the harness work.
- Next best action:
  - For the next feature, choose scope from `harness/feature_list.json` or add a new feature entry before implementation.

### Session 2026-05-15 Shared Contributor And Ledger Attachments

- Goal: Show a unified contributor label for records, ledger entries, and album media; hydrate and preview ledger attachments; verify the existing cloud expense `8887.24` for user `18915618653`.
- Completed:
  - Added runtime `recordedBy` metadata for family-shared state rows and care-log timeline events, using the family member role as the user-facing label.
  - Hydrated `attachmentId` and `attachmentIds` references into full attachment metadata so ledger entries can show clickable image/video/audio attachments.
  - Added frontend display for `记录人` in records, ledger, and album, plus ledger attachment preview buttons.
  - Preserved original creator attribution when existing shared rows are updated.
  - Confirmed cloud user `18915618653` belongs to family `family-eb3f4751-2df9-46b4-920e-6634c4013d50`; expense `expense-1` amount `8887.24` already has attachment `attachment-mp2lomag-chc0xt`, so no production DB mutation was needed.
  - Deployed code and OTA assets to Aliyun `120.55.188.242` with production data sync disabled.
- Verification run:
  - `npm run build`
  - `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" "/Applications/IntelliJ IDEA.app/Contents/plugins/maven/lib/maven3/bin/mvn" -q -f backend/pom.xml -Dtest=AppStateControllerTests test`
  - `npm run verify:frontend`
  - `MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/bytedance/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - `npm run test:cloud-e2e`
  - `bash harness/init.sh`
- Evidence:
  - Backend targeted test passed with contributor and expense attachment hydration coverage.
  - Frontend verification passed across desktop and configured mobile viewports.
  - Cloud health returned `ok` after deployment.
  - Cloud E2E passed 10/10 cases, including timeline `记录人`, ledger CRUD with attachment preview, album view, reminder flow, and real Agent text flow.
  - Final harness init passed with whitespace check, frontend build, and Agent benchmark.
  - Detailed iteration note is saved at `docs/record-contributor-attachment-e2e-plan.md`; E2E result is saved at `docs/automation-test-results.md`.
- Known risks:
  - The cloud `8887.24` expense fix depends on the existing linked attachment record remaining available in object/local storage; this run verified the DB relationship and new metadata hydration path, not manual visual review of the original receipt content.

### Session 2026-05-15 Album Gallery Metadata Placement

- Goal: Keep album gallery tiles visually clean and move title/date/category/recorded-by details into the click-through preview detail panel.
- Completed:
  - Removed the title and recorded-by block from album gallery tiles.
  - Added `记录人` to the album preview detail panel alongside date and category.
  - Published OTA bundle `0.1.0-20260515153705` to Aliyun `120.55.188.242`.
- Verification run:
  - `bash harness/init.sh`
  - `npm run verify:frontend`
  - `MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 SKIP_BACKEND_BUILD=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/bytedance/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - Cloud `POST /api/mobile-updates/check`
- Evidence:
  - Frontend smoke passed across desktop and configured mobile viewports.
  - Cloud update check returns version `0.1.0-20260515153705`.
  - Cloud health returned `ok`.

### Session 2026-05-16 Expense Image Chat Reliability

- Goal: Fix user `13777892890` chat expense-recognition issues: multi-image sends were capped too low, expense screenshot recognition triggered meaningless web search, and recognized amounts could still be followed by an amount clarification.
- Completed:
  - Raised chat visual attachment handling from 4 to 8 to match backend request validation, including model visual input forwarding, and added a clear notice when a browser selection exceeds the chat cap.
  - Suppressed `web_search` planning/tool routing for order, receipt, invoice, payment, or expense image recognition tasks while preserving web search for policy and reference-price questions.
  - Changed expense effect resolution so complete model-recognized expenses override the rule extractor's missing-amount question, and normalized final copy when a pending expense draft already exists.
  - Added planner, effect-policy, runtime, and benchmark tests for the expense image path.
- Verification run:
  - `mvn -q -Dtest=AgentPlannerTests,EffectPolicyTests,AgentRuntimeTests,AgentBenchmarkTests test`
  - `npm run test:agent-benchmark`
  - `npm run verify:frontend`
- Evidence:
  - Targeted backend tests passed with new coverage for no expense-image web search and no redundant amount question.
  - Agent benchmark passed and refreshed `docs/agent-benchmark-results.md`.
  - Frontend verification passed across desktop and six mobile viewports, with screenshots under `.verification/frontend-smoke/`.
- Known risks:
  - Chat still intentionally caps one message at 8 visual attachments because backend validation and model input forwarding are aligned to 8; selecting more than 8 now surfaces an explicit notice instead of silently dropping extras.

### Session 2026-05-16 Agent Stream Timeout And Progress Detail

- Goal: Explain and fix why user `13777892890` saw `AI 流式响应缺少最终结果` after an 8-image expense retry, and make long-running backend work visible as concrete frontend progress.
- Completed:
  - Confirmed the failed stream timed out before the expense-recognition skill completed: 8 prior screenshots were processed as 2 sequential vision batches, the skill took about 171 seconds, while the previous SSE budget was about 165 seconds.
  - Changed stream timeout budgeting to account for planner time, expense-recognition batch count, final response generation, and a 12 minute upper cap for visual requests.
  - Added cancellation checks before expense persistence and final delivery so a timed-out/disconnected stream does not continue into user-visible side effects.
  - Changed stream trace completion to mark success only after the `final` SSE event is sent; failed final delivery is now recorded as a failed agent run.
  - Added structured progress events for planning, context preparation, media preparation, each expense-recognition batch, 支出结果整理, 账本保存, and final response generation.
  - Updated the chat UI to render backend progress as activity rows with running/completed/failed states instead of showing only a vague status line.
  - Deployed backend and OTA assets to Aliyun `120.55.188.242` with production data sync disabled.
- Verification run:
  - `mvn -f backend/pom.xml -Dtest=AgentRuntimeTests test`
  - `npm run build`
  - `npm run test:agent-benchmark`
  - `npm run verify:frontend`
  - `git diff --check`
  - `MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun npm run deploy:aliyun`
- Evidence:
  - `AgentRuntimeTests` passed with 23 tests, including new coverage that an 8-image previous-message retry expands stream timeout beyond the old 165 second budget while text-only requests keep the legacy budget.
  - Agent benchmark passed with 23 tests, 0 failures, and refreshed `docs/agent-benchmark-results.md`.
  - Frontend verification passed across desktop and six mobile viewports, with screenshots under `.verification/frontend-smoke/`.
  - Cloud `/api/health` returned `ok`.
  - OTA check returned version `0.1.0-20260516205323`, and the downloaded bundle checksum matched `6e95d4eb7de4776d9782648940d83f63b9d1ea62524925f4a718b1f1f968ec14`.
- Known risks:
  - This fixes timeout budgeting, cancellation, and progress visibility. It does not delete the production rows that were saved after the earlier frontend error; production data cleanup still needs explicit user confirmation of exact rows.

### Session 2026-05-16 Previous Image Retry Latency Follow-Up

- Goal: Explain and reduce why a follow-up message asking to recognize previously uploaded images was much slower than sending images directly in the same message.
- Completed:
  - Confirmed user `13777892890` latest trace `agent-1ff31579-9370-4820-ba58-be2bfa6ed1fa` started at 20:58:48, expense recognition completed at 21:01:51, and final agent response completed at 21:02:27.
  - Confirmed the two expense-recognition batches took about 86 seconds and 93 seconds respectively; the UI appeared stuck on the second batch because each batch was a blocking vision-model call with no inner progress.
  - Found the direct-image path was faster because the frontend sends agent-optimized compressed images, while previous-image retry reloaded persisted attachment originals from storage.
  - Changed historical attachment hydration for Agent input to generate an agent-sized JPEG data URL with max edge 1800px, instead of sending the original stored image bytes to the vision model.
  - Changed expense-recognition multi-batch execution to run batches concurrently using the agent executor, while preserving ordered result aggregation.
  - Changed expense persistence intent to trust planner output when it has `intent=record`, `topic=expense`, and `expense-recognition` execute mode, so ASR typos like `画飞记录一` do not block the recognized expense flow.
  - Deployed backend-only update to Aliyun `120.55.188.242` with production data sync disabled.
- Verification run:
  - `mvn -f backend/pom.xml -Dtest=AgentRuntimeTests,ExpenseRecognitionSkillTests test`
  - `npm run test:agent-benchmark`
  - `mvn -f backend/pom.xml test`
  - `git diff --check`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=0 ECS_HOST=120.55.188.242 SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun npm run deploy:aliyun`
- Evidence:
  - Targeted runtime and expense skill tests passed with 29 tests, including concurrent batch execution and planner-record intent surviving ASR typo coverage.
  - Full backend test suite passed with 183 tests, 0 failures.
  - Agent benchmark passed with 23 tests, 0 failures, and refreshed `docs/agent-benchmark-results.md`.
  - Cloud `/api/health` returned `ok` after backend-only deploy.
- Known risks:
  - Historical screenshot OCR now uses a compressed 1800px JPEG instead of the original file; this is intended to match the direct-send path and should preserve enough resolution for order screenshots, but extremely tiny text could still depend on upstream model quality.

## Operational Notes

- Use `npm run test:agent-benchmark` for Agent behavior changes.
- Use `npm run verify:frontend` for UI or layout changes.
- Use `npm run mobile:sync` plus platform debug builds for native-risk changes.
- Use `SYNC_DATA=0 ECS_HOST=120.55.188.242 npm run deploy:aliyun` for code-only cloud updates unless the user explicitly requests data sync or reset.
