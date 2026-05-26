# Codex 待办：3 张插画 + 替换占位

- 创建日期：2026-05-26
- 目的：替换 `Placeholder` 组件为真实插画图片
- 上下文：小宝记 App 视觉刷新 Phase 2 已在前端预留 3 个占位，每个占位带 `data-placeholder` 属性，等你生成插画并完成替换

## 项目上下文

「小宝记」是孕期到 1 岁的 AI 育儿陪伴 App，移动端为主，React + Capacitor 架构。整体视觉走**暖色系 / 柔和 / 友好**路线，已使用的色板：

- 主背景米黄：`#fff8ee` / `#fef5e7`
- 暖绿主色：`#527064` / `#8ac4a8`
- 暖橙强调：`#e8a45e` / `#d88276`
- 棕色文字：`#a08a6d` / `#8b8075` / `#333`
- 既有插画风格参考：`frontend/src/assets/storybook-icons/companion.png`（吉祥物宝宝头像，圆润、柔和、暖色 pastel）

**风格关键词**：温馨、柔和、圆润、暖色 pastel、扁平插画或半立体、避免冷色/锐利线条/写实/复杂细节。

## 资产规范

- **格式**：PNG（带透明背景）或 WebP
- **倍率**：建议 2x（实际显示尺寸的双倍像素）方便高 DPI 屏幕清晰
- **目录**：新建 `frontend/src/assets/illustrations/`，文件名与 placeholder kind 对应
- **命名**：kebab-case，例：`hero-records-today.png`

## 3 张插画任务

### 1. `hero-records-today` —— 记录页顶部 banner

| 项 | 值 |
|---|---|
| 文件路径 | `frontend/src/assets/illustrations/hero-records-today.png` |
| 实际显示尺寸 | 16:9 比例，全宽（撑满 DailySummaryView 容器宽度，约 358px @ 390px 视口） |
| 推荐生成像素 | 1024 × 576（2x 适配） |
| 当前占位 caption | "月龄相关温馨场景" |
| 当前 spec hint | "A warm gentle illustration of a baby/family scene matching the baby's current month-age. Soft pastel palette consistent with app's warm theme." |

**画面建议**：以宝宝 + 一位家长（妈妈或爸爸）为主体的温馨场景，例如：

- 妈妈抱着宝宝坐在窗边，窗外柔和阳光
- 爸爸/妈妈与宝宝玩耍（爬行、扶站、伸手抓物等成长瞬间）
- 一家三口坐在地垫上的温馨日常

**风格要求**：
- 暖色 pastel（米黄、暖橙、淡绿、淡蓝点缀）
- 半立体或扁平插画，圆润无锐角
- 不要文字 / 不要 logo / 不要写实人脸细节
- 留 6-12% 上下边距，避免主体太满
- 透明背景，让 App 的米黄底色透出

**位置代码**：`frontend/src/views/DailySummaryView.tsx` 第 25 行附近，目前是：
```tsx
<Placeholder
  kind="hero-records-today"
  aspect="16/9"
  caption="月龄相关温馨场景"
  spec="..."
  className="daily-summary__hero fade-in-up"
/>
```

### 2. `empty-ledger` —— 账本明细空态插画

| 项 | 值 |
|---|---|
| 文件路径 | `frontend/src/assets/illustrations/empty-ledger.png` |
| 实际显示尺寸 | 160 × 120 |
| 推荐生成像素 | 320 × 240（2x） |
| 当前占位 caption | "钱包/购物袋" |
| 当前 spec hint | "A friendly illustration of a wallet or shopping bag to represent expense tracking. Match warm earth palette." |

**画面建议**：

- 一个可爱的小钱包（鼓鼓的、暖橙色调），或
- 一只装着奶粉罐 / 尿不湿包的购物袋（暖绿/暖橙），或
- 一个装着几枚硬币的存钱罐

**风格要求**：
- 单一主体，背景透明
- 暖色 pastel，圆润扁平
- 不要文字 / 不要金额数字 / 不要"￥"符号（避免重复 App 已有的金额显示）

**位置代码**：`frontend/src/views/LedgerView.tsx` 第 374 行附近，目前是：
```tsx
<Placeholder
  kind="empty-ledger"
  width={160}
  height={120}
  caption="钱包/购物袋"
  spec="..."
  className="empty-state-illustration"
/>
```

### 3. `empty-reminders` —— 提醒页全空态插画

| 项 | 值 |
|---|---|
| 文件路径 | `frontend/src/assets/illustrations/empty-reminders.png` |
| 实际显示尺寸 | 200 × 150 |
| 推荐生成像素 | 400 × 300（2x） |
| 当前占位 caption | "铃铛 / 月历插画" |
| 当前 spec hint | "A cheerful illustration of a soft bell or warm calendar to convey reminders. Match warm earth palette." |

**画面建议**：

- 一只柔和的小铃铛（暖橙色，圆润，微微倾斜像在轻响）
- 或一本翻开的小月历（标了几个圆圈日期，暖色调）
- 或一个温馨的便签纸夹

**风格要求**：
- 单一主体，背景透明
- 暖色 pastel，圆润扁平
- 不要文字 / 不要具体日期
- 视觉感受要 "温和提醒"，不能 "紧迫报警"

**位置代码**：`frontend/src/App.tsx` 第 7548 行附近，目前是：
```tsx
<Placeholder
  kind="empty-reminders"
  width={200}
  height={150}
  caption="铃铛 / 月历插画"
  spec="..."
/>
```

## 整合步骤（每张图生成完成后）

每张图按相同套路替换：

### Step A. 在源文件顶部加 import

例如 `DailySummaryView.tsx`：
```tsx
import heroRecordsToday from "../assets/illustrations/hero-records-today.png";
```

`LedgerView.tsx`：
```tsx
import emptyLedgerImg from "../assets/illustrations/empty-ledger.png";
```

`App.tsx`：
```tsx
import emptyRemindersImg from "./assets/illustrations/empty-reminders.png";
```

### Step B. 替换 `<Placeholder>` 为 `<img>`

`DailySummaryView.tsx`：
```tsx
// 替换前
<Placeholder kind="hero-records-today" aspect="16/9" ... />

// 替换后
<img
  src={heroRecordsToday}
  alt="今日发现"
  className="daily-summary__hero fade-in-up"
  style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", borderRadius: 12 }}
/>
```

`LedgerView.tsx`：
```tsx
// 替换前
<Placeholder kind="empty-ledger" width={160} height={120} ... />

// 替换后
<img
  src={emptyLedgerImg}
  alt="还没有支出记录"
  className="empty-state-illustration"
  width={160}
  height={120}
/>
```

`App.tsx`：
```tsx
// 替换前
<Placeholder kind="empty-reminders" width={200} height={150} ... />

// 替换后
<img
  src={emptyRemindersImg}
  alt="还没有任何提醒"
  width={200}
  height={150}
/>
```

### Step C. 清理无用 import

替换完 3 处后，搜确认 `Placeholder` 没有其他用法：
```bash
grep -rn '<Placeholder' /Users/bytedance/Documents/ai-baby-growth-companion/frontend/src/
```

- 如果其他地方还用 → 保留 `Placeholder` 组件 + import
- 如果只有这 3 处都换掉了 → 可以删除以下 import 行：
  - `DailySummaryView.tsx`: `import { Placeholder } from "../components/Placeholder";`
  - `LedgerView.tsx`: `import { Placeholder } from "../components/Placeholder";`
  - `App.tsx`: `import { Placeholder } from "./components/Placeholder";`
  - 但**不要**删 `frontend/src/components/Placeholder.tsx` 本身（保留备用）

## 验证步骤

替换完后，依次跑：

```bash
cd /Users/bytedance/Documents/ai-baby-growth-companion
npm run build                # TypeScript + Vite 编译
npm run verify:frontend      # 7 viewport smoke
node scripts/probe-daily-summary-view.mjs    # 12 截图验证 DailySummaryView + Tab
```

人眼检查：
- `.verification/daily-summary-probe/iphone-13-390x844-1-records-today.png` 顶部应该出现真实 hero 插画（不是虚线占位框）
- `.verification/daily-summary-probe/iphone-13-390x844-7-reminders.png` 应该出现真实 reminders 插画
- 账本明细 tab 需要手动改一下 probe 脚本进 details 看（或真机看）

## 发布

替换完成后：

```bash
# Build OTA bundle
MOBILE_UPDATE_MESSAGE='Phase 2 占位换成真实插画' \
  MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 \
  VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 \
  npm run build:mobile:update

# Upload to OSS (需要 PATH 里有 JDK 17)
unset HTTP_PROXY HTTPS_PROXY
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"
ECS_HOST=120.55.188.242 \
  SSH_KEY=/Users/bytedance/.ssh/ai_baby_aliyun \
  bash scripts/upload-mobile-update-oss.sh

# Sync manifest to ECS (不动 production 数据 + 跳过 backend rebuild)
SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 SYNC_MOBILE_UPDATE_MANIFEST_ONLY=1 SKIP_BACKEND_BUILD=1 \
  ECS_HOST=120.55.188.242 SSH_KEY=/Users/bytedance/.ssh/ai_baby_aliyun \
  npm run deploy:aliyun

# Verify cloud
curl -sS http://120.55.188.242:8300/api/health  # 期待 "ok"
curl -sS -X POST http://120.55.188.242:8300/api/mobile-updates/check \
  -H 'Content-Type: application/json' \
  -d '{"platform":"ios","currentBundleVersion":"0.1.0"}'   # 期待返回新版本
```

## Commit 风格

按项目惯例：

```bash
git add frontend/src/assets/illustrations/ frontend/src/views/DailySummaryView.tsx frontend/src/views/LedgerView.tsx frontend/src/App.tsx
git commit -m "ui(p2): replace placeholders with real illustrations (hero/ledger/reminders)"
```

**不要**加 `Co-Authored-By` trailer，**不要**加 "Generated with Claude" 之类的 footer，单行 conventional commit 即可。

## 不要做的事

- ❌ 改业务逻辑、API 调用、数据模型
- ❌ 改其他 Tab 的视觉（聊天 / 我的 / 相册），只做这 3 处
- ❌ 加文字到插画里（App 自己有文字）
- ❌ 删 `frontend/src/components/Placeholder.tsx` 本体（留作未来扩展）
- ❌ 同步 production 数据（部署必须 SYNC_DATA=0）

## 验收标准

- [ ] 3 张图片文件存在于 `frontend/src/assets/illustrations/`
- [ ] 3 个源文件 `<Placeholder>` 改成 `<img>`，import 正确
- [ ] `npm run build` 通过
- [ ] `npm run verify:frontend` 7 viewport 通过
- [ ] `probe-daily-summary-view.mjs` 12 截图人眼检查无破坏，hero/reminders 显示真实插画
- [ ] OTA 发布成功，云端 health=ok，OTA check 返回新版本
- [ ] Commit 单条 conventional 风格，无 Claude attribution
