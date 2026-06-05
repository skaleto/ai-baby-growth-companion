# 视觉刷新与活泼化（Visual Refresh）

- 创建日期：2026-05-26
- 状态：Phase 1 进行中
- 范围：全局视觉层改动，分 4 阶段交付；本次先做 Phase 1（CSS-only 快速胜利）
- 触发：用户反馈「记录页全是文字看起来太累」、希望加占位图 + 动效、整体轻松活泼

## 1. 全局观察

基于 probe 截图（6 个主 Tab × iPhone 13）实地观察：

| Tab | 文字密度 | 图/插画 | 动效 | 主要问题 |
|---|---|---|---|---|
| 聊天 | 中 | baby avatar | 无 | 中间大片空白；5 个快捷 pill 无 icon |
| **记录 today（DailySummaryView）** | **极高** | **无** | **无** | **4 个 section card 全文字、无数据可视化** |
| 账本 | 中（空态低） | 无 | 无 | 分类无 icon、无 mini chart |
| 相册 | 中 | 空态有插画 | 无 | 分类 tab 无 icon |
| 提醒 | 中 | 简笔 icon | 无 | 4 个状态分组全文字、无空态插画 |
| 我的 | 低（已最好） | baby avatar | 无 | 装饰相对完整 |

**全局共性问题**
1. 几乎无动效 —— 所有内容瞬现，无 fade/slide/skeleton/微反馈
2. 插画极度稀缺 —— 仅 2 张 baby avatar + 1 张相册空态植物
3. emoji/icon 使用不一致 —— 提醒页有，DailySummaryView 没有，聊天快捷 pill 没有
4. 空状态体验单薄 —— 除相册外其他空态是冷冰冰文字

**强项（保留）**
- 暖色调系统统一（米黄、暖绿、暖橙）
- 卡片化布局规整
- 字体清晰
- DailySummaryView finding tag 已有颜色区分

## 2. 4 阶段计划

### Phase 1 —— 快速胜利（CSS-only，1-2 天，风险低）✅ 本次执行

只动 CSS + 在已有 JSX 加 emoji/className，零结构改动，零业务逻辑。立即可上线。

详细任务见 §3。

### Phase 2 —— 插画占位 + 骨架屏（2-3 天，风险低-中）

标记 5 个关键插画位 + 加 loading skeleton。每个位置用占位 SVG + data-attribute 标记规格，codex 后续生成实图替换。

候选位置：
| 位置 | 用途 | 尺寸 | 标记 |
|---|---|---|---|
| 记录 today 顶部 hero | 月龄相关温馨场景 | 16:9 banner | `data-placeholder="hero-records-today"` |
| DailySummaryView 4 section 头部 | 小图标（数据/发现/提醒/漏项） | 48x48 | `data-placeholder="section-icon-{kind}"` |
| 记录空态 | 鼓励补录暖图 | 200x160 | `data-placeholder="empty-records"` |
| 账本空态 | 钱包/购物袋 | 200x160 | `data-placeholder="empty-ledger"` |
| 提醒空态 | 铃铛/月历 | 200x160 | `data-placeholder="empty-reminders"` |

配套：careLog/账本/相册加载时 skeleton；DailySummaryView 生成 AI 时 shimmer。

### Phase 3 —— 数据可视化（3-5 天，风险中）

DailySummaryView「宝宝今天」从拼接文字升级为 stats cards + mini sparklines；careLog timeline 加 visual cues。

| 改动 | 效果 |
|---|---|
| 3 张 stat cards（奶量 / 睡眠 / 喂养次数），大数字 + 趋势箭头 | 一眼数据 |
| trend_anomaly finding 旁配 mini sparkline | 量化感 |
| careLog timeline 事件加圆点 + 颜色 + emoji | 视觉化 |
| 账本「本月分类占比」加 horizontal bar chart 入场动画 | 活化现有数据 |

### Phase 4 —— 视觉系统（长期，本次不做）

- 月龄主题（孕期 / 0-3 月 / 4-6 月 / 7-12 月，每个阶段主色 + 配套插画）
- 季节/节日彩蛋
- 全局插画一致性规范
- 暗色模式

## 3. Phase 1 详细任务清单

### 3.1 DailySummaryView 内容活化

**文件**：`frontend/src/utils/dailySummary.ts`、`frontend/src/views/DailySummaryView.tsx`、`frontend/src/styles/daily-summary.css`

- `FINDING_TYPE_LABEL` 每个 label 前缀加 emoji：
  - `family_action_continuity`: `🤝 家庭接力`
  - `cross_domain_link`: `🔗 跨域关联`
  - `expense_price_compare`: `💰 价格对比`
  - `trend_anomaly`: `📈 趋势观察`
  - `media_milestone_candidate`: `📷 里程碑候选`
  - `memory_recall`: `🧠 记忆触发`
- 4 个 section h3 旁加装饰 emoji：
  - 「宝宝今天」`👶`
  - 「你可能没注意到」`✨`
  - 「需要你看一眼」`👀`
  - 「漏掉了吗」`📝`
- 「宝宝今天」facts 渲染：把现在的 `facts.join("；")` 改成每条独立一行，前缀 `·`，行间距更宽
- finding text 前缀的 type tag 加圆角、轻微阴影提升视觉层次

### 3.2 全局动效系统

**文件**：新建 `frontend/src/styles/motion.css`、`frontend/src/styles.css` 加 import

- 定义 `.fade-in-up`：opacity 0→1 + translateY(8px→0)，200ms ease-out
- 定义 `.fade-in`：opacity 0→1，180ms ease-out
- 定义 `.stagger > *`：子元素逐个延迟 30ms 入场（前 6 个，第 7 个起统一无 delay 避免长列表卡顿）
- 定义 `.tab-content-enter`：tab 切换时 220ms fade-cross
- 在 DailySummaryView 的 `.daily-summary` 外层加 `stagger`，每个 `.daily-summary__section` 加 `fade-in-up`
- 在 LedgerView、MilestonesView 的卡片加同样 classes

### 3.3 按钮 tap 反馈

**文件**：`frontend/src/styles/buttons.css`（或新建）

- 全局 `button:active`：scale(0.97) + 100ms transition
- 主按钮加暖色阴影 hover/active
- finding action 按钮加 hover 状态

### 3.4 聊天快捷 pill emoji

**文件**：`frontend/src/App.tsx`（聊天 Tab 顶部 quick pills 区）

- 喂奶 → 🍼 喂奶
- 提醒 → 🔔 提醒
- 里程碑 → ⭐ 里程碑
- 记账 → 💰 记账
- 问问 AI → 🤖 问问 AI

### 3.5 Tab 切换 transition

**文件**：`frontend/src/styles.css` 或 `app-base.css`

- `.app-shell main > section` 加 cross-fade 入场（200ms）
- 关键：避免 layout shift —— 用 opacity 而非 display

### 3.6 验证 + 发布

- `npm run build`
- `npm run verify:frontend`（看 7 viewport 截图是否有破坏）
- `node scripts/probe-daily-summary-view.mjs`（拍 12 张验证视觉效果）
- 必要时调整 CSS
- `npm run build:mobile:update` + OSS 上传 + Aliyun 部署（manifest only）

## 4. 不做清单（防 scope creep）

- ❌ 任何业务逻辑改动
- ❌ 任何后端改动
- ❌ 任何新功能
- ❌ Phase 2/3/4 的内容
- ❌ 重做 IA（保留 6 Tab）
- ❌ App.tsx 拆分（虽然它依然 8000+ 行）

## 5. Phase 1 时间预估

| 阶段 | 时间 |
|---|---|
| DailySummaryView emoji + facts 改写 | 30 分钟 |
| 全局动效 CSS | 1 小时 |
| 按钮 tap 反馈 | 30 分钟 |
| 聊天快捷 pill emoji | 15 分钟 |
| Tab 切换 transition | 30 分钟 |
| 验证 + probe 截图核对 | 30 分钟 |
| 发布（OTA + Aliyun） | 20 分钟 |
| **合计** | **约 3.5 小时** |

## 6. 验收标准

- [ ] DailySummaryView 6 类 finding tag 前缀 emoji 全部出现
- [ ] 4 个 section h3 旁有装饰 emoji
- [ ] facts 分行渲染，间距舒服
- [ ] 卡片入场 fade-up 动效在 probe 截图（动态测试不易，但 build 后人眼可见）
- [ ] 按钮 tap 时有 scale 反馈
- [ ] 聊天 5 个快捷 pill 全部带 emoji
- [ ] verify:frontend 7 viewport 全过
- [ ] probe 12 截图无新增 overflow / 渲染异常
- [ ] OTA 发布成功，云端 health=ok
