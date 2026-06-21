# 高级感视觉打磨(#37)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把小宝记卡片 + 按钮升级成「暖晨光(C1)」光感深度体系,全局统一、分层克制、零掉帧,门面卡加 Codex 产的主题 SVG 点睛。

**Architecture:** 纯 CSS 一层叠加——新建 `frontend/src/styles/premium-depth.css`,在 `styles.css` 最后 import(覆盖一切),用一套 token(圆角/阴影分层/暖表面/高光边/径向光晕/按钮)按"门面/标准/列表/弹窗"四层套到现有 class 选择器;门面卡的主题装饰用 `::before` 内联 SVG data-URI(Codex 产多版,控制者收敛)。零 TSX 改动、零后端、走 OTA。

**Tech Stack:** 纯 CSS(`radial-gradient`/`linear-gradient`/纯色 `box-shadow`/`::before` data-URI)+ Node 断言测试 + 已有 `qa:visual` 视觉基线闸门。

**硬约束(贯穿全程):** 绝对禁止 `backdrop-filter` / `filter: blur`(横滑逐帧重绘掉帧,见 `pswp-album.css` 16–18 + 提交 `352c016`)。深度只用渐变 + 纯色 `box-shadow`(`box-shadow` 的模糊半径不在禁列,现状 `--shadow-soft` 即是)。门面 SVG 只矢量、低透明度(≤.15)、`pointer-events:none`。

**已知风险(实现时盯):** `warm-theme.css` 等用单类选择器设了卡片底色/阴影;`premium-depth.css` 最后 import、同特异度→后者胜。若某卡有更高特异度旧规则(如 `.records-screen .summary-card`)没被覆盖,把对应选择器特异度对齐即可(`qa:visual` 会暴露"没变的卡")。

---

## File Structure

- **Create** `frontend/src/styles/premium-depth.css` —— 本特性全部样式(token + 四层卡片 + 按钮 + 门面光晕 + 门面 SVG 点睛)。单一职责、最后加载、易复核易回退。
- **Modify** `frontend/src/styles.css` —— 末尾追加 `@import "./styles/premium-depth.css";`(必须最后)。
- **Create** `scripts/test-premium-depth.mjs` —— 断言 CSS 定义了必需 token、5 张门面卡各设了品类 `--glow`、且 premium-depth.css 是 `styles.css` 最后一个 import。
- **Modify** `package.json` —— 加 `test:premium-depth` 脚本,并接入 `verify:frontend` 链。

不动任何 `.tsx`。门面 SVG 以 data-URI 内嵌进 CSS,无新增资源文件、无组件改动。

---

## Task 1: 基线快照 + token 地基 + 测试 + 接线

**Files:**
- Create: `frontend/src/styles/premium-depth.css`
- Modify: `frontend/src/styles.css`(末尾加 import)
- Create: `scripts/test-premium-depth.mjs`
- Modify: `package.json`

- [ ] **Step 1: 先签「改造前」视觉基线**(关键:让后续 `qa:visual` 的 diff 正好等于我们这次的改动)

Run:
```bash
npm run build && npm run qa:sweep && npm run qa:baseline:accept
```
Expected:`qa:sweep` 断言 9/9 ✔;`qa:baseline:accept` 打印「已签基线:64 张」。这版基线 = 改造前的老样子。

- [ ] **Step 2: 写失败测试**

Create `scripts/test-premium-depth.mjs`:
```javascript
#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../frontend/src/styles/premium-depth.css", import.meta.url), "utf8");
const styles = readFileSync(new URL("../frontend/src/styles.css", import.meta.url), "utf8");

// 1) 必需 token 都定义了
for (const t of ["--r-chip","--r-card","--r-hero","--elev-list","--elev-card","--elev-hero","--elev-btn","--edge-light","--surface-card","--surface-hero","--glow","--btn-primary-bg","--btn-primary-edge"]) {
  assert.ok(css.includes(t + ":"), `premium-depth.css 应定义 ${t}`);
}

// 2) 5 张门面卡各自设了品类 --glow(Task 4 满足;此处先放宽到"至少 feeding 定义",Task 4 收紧)
assert.ok(/\.feeding-alarm-card[^{]*\{[^}]*--glow\s*:/.test(css), ".feeding-alarm-card 应设置自己的 --glow");

// 3) premium-depth.css 必须是最后一个 @import(覆盖一切)
const imports = [...styles.matchAll(/@import\s+["']([^"']+)["']/g)].map((m) => m[1]);
assert.equal(imports[imports.length - 1], "./styles/premium-depth.css", "premium-depth.css 必须是 styles.css 最后一个 @import");

console.log("premium-depth tokens tests passed");
```

- [ ] **Step 3: 跑测试确认失败**

Run: `node scripts/test-premium-depth.mjs`
Expected:FAIL —— `ENOENT ... premium-depth.css`(文件还没建)。

- [ ] **Step 4: 建 premium-depth.css(只放 :root token)**

Create `frontend/src/styles/premium-depth.css`:
```css
/* 高级感视觉打磨(#37)暖晨光 C1 全局深度体系。最后加载、覆盖一切。
   性能红线:零 backdrop-filter / blur;深度只用渐变 + 纯色 box-shadow。 */
:root {
  /* 圆角层级 */
  --r-chip: 12px;
  --r-card: 16px;
  --r-hero: 20px;
  --r-modal: 22px;

  /* 阴影分层(暖棕,与现状 --shadow-soft 同源,分三档强度) */
  --elev-list: 0 4px 12px rgba(106, 78, 48, .05);
  --elev-card: 0 10px 26px rgba(106, 78, 48, .08), 0 3px 8px rgba(106, 78, 48, .05);
  --elev-hero: 0 18px 40px rgba(106, 78, 48, .12), 0 5px 14px rgba(106, 78, 48, .06);
  --elev-btn: 0 8px 18px rgba(55, 123, 100, .30);

  /* 顶部高光边 + 底部暖边(立体感来源,纯 inset 阴影) */
  --edge-light: inset 0 1px 0 rgba(255, 255, 255, .7), inset 0 -1px 0 rgba(234, 223, 208, .55);

  /* 暖色表面渐变 */
  --surface-card: linear-gradient(145deg, #fffaf1 0%, #fffaf1 52%, #f7ecd9 100%);
  --surface-hero: linear-gradient(145deg, #fffdf8 0%, #fffaf1 54%, #f6ead7 100%);

  /* 径向光晕:门面卡用,默认琥珀,品类色由各卡覆盖(Task 4) */
  --glow: radial-gradient(150px 105px at 82% 8%, rgba(223, 169, 71, .22), rgba(236, 143, 125, .10) 48%, transparent 72%);

  /* 按钮系统 */
  --btn-primary-bg: linear-gradient(135deg, #7bb295 0%, #3d8268 72%);
  --btn-primary-edge: inset 0 1px 0 rgba(255, 255, 255, .35);
}

/* 临时让 Step 2 测试的 feeding --glow 断言通过;Task 4 会换成正式门面规则 */
.feeding-alarm-card { --glow: radial-gradient(150px 105px at 82% 8%, rgba(223, 169, 71, .22), rgba(236, 143, 125, .10) 48%, transparent 72%); }
```

- [ ] **Step 5: 末尾加 import**

Modify `frontend/src/styles.css` —— 在最后一行 `@import "./styles/auth-scene.css";` **之后**追加:
```css
@import "./styles/premium-depth.css";
```

- [ ] **Step 6: 测试 + 构建通过**

Run: `node scripts/test-premium-depth.mjs && npm run build`
Expected:`premium-depth tokens tests passed`;`vite build` 成功(`✓ built`)。

- [ ] **Step 7: 接入 package.json + 提交**

Modify `package.json` scripts:加一行
```json
    "test:premium-depth": "node scripts/test-premium-depth.mjs",
```
放在 `"test:qa-image-hash"` 那一行旁边。并把 `verify:frontend` 链里加上 `&& npm run test:premium-depth`(放在 `npm run build` 之前)。

Commit:
```bash
git add frontend/src/styles/premium-depth.css frontend/src/styles.css scripts/test-premium-depth.mjs package.json
git commit -m "feat(#37): 暖晨光 token 地基 + premium-depth.css 接线 + 断言测试"
```

---

## Task 2: 标准层 + 列表层卡片 + 次级按钮

**Files:**
- Modify: `frontend/src/styles/premium-depth.css`(追加)

- [ ] **Step 1: 追加标准层 + 列表层 + 次级按钮规则**

在 `premium-depth.css` 末尾追加:
```css
/* ===== 标准层卡片:渐变 + 高光边 + --elev-card ===== */
.summary-card,
.ledger-card,
.ledger-summary-card,
.calendar-card,
.trend-card,
.album-overview-card,
.app-profile-card,
.profile-detail-card,
.profile-form,
.reminder-group,
.ledger-manual-cta {
  border-radius: var(--r-card);
  background: var(--surface-card);
  box-shadow: var(--edge-light), var(--elev-card);
  border: 1px solid rgba(234, 223, 208, .9);
}

/* ===== 列表层卡片:只给微深度 + 顶部高光,不换底色(密集列表保持克制) ===== */
.record-event-card,
.day-timeline-card,
.expense-item,
.expense-row {
  border-radius: var(--r-card);
  box-shadow: var(--edge-light), var(--elev-list);
}

/* ===== 次级按钮:升级圆角 + 微深度,保留原浅底/描边气质 ===== */
.screen-action-button {
  border-radius: var(--r-chip);
  box-shadow: var(--edge-light), var(--elev-list);
}
```

- [ ] **Step 2: 构建 + 看变更集**

Run:
```bash
npm run build && npm run qa:sweep && npm run qa:visual
```
Expected:`qa:visual` 打印 diff,`changed` 含账本/相册总览/资料/趋势/提醒等标准卡 + 记录/明细列表卡;`送 LLM …N 张`。变更集 PNG 在 `.verification/acceptance/_changed/`。

- [ ] **Step 3: 人工眼过变更集**

Run: `open .verification/acceptance/_changed/`(或直接看目录里 PNG)
确认:标准卡有了暖渐变 + 柔阴影 + 顶部高光的"立体奶油"感;列表卡更利落但没变脏;无对比度/可读性退化。若某卡没变化 → 特异度问题,给该选择器对齐特异度(见计划顶部"已知风险")。

- [ ] **Step 4: 提交**
```bash
git add frontend/src/styles/premium-depth.css
git commit -m "feat(#37): 标准层 + 列表层卡片 + 次级按钮的光感深度"
```

---

## Task 3: 主按钮系统

**Files:**
- Modify: `frontend/src/styles/premium-depth.css`(追加)

- [ ] **Step 1: 追加主按钮规则**

在 `premium-depth.css` 末尾追加(选择器照 `warm-theme.css` 572–583 现有主按钮族):
```css
/* ===== 主按钮:鼠尾草立体渐变 + 内高光 + 柔阴影 ===== */
.send-button,
.auth-form > button,
.onboarding-actions button,
.empty-state button,
.profile-edit-button,
.save-profile-button,
.pending-effect-actions button,
.inline-edit-button,
.care-log-form button {
  border-radius: var(--r-chip);
  background: var(--btn-primary-bg);
  box-shadow: var(--btn-primary-edge), var(--elev-btn);
  border: 1px solid #3d8268;
  color: #fffaf1;
}
```

- [ ] **Step 2: 构建 + 变更集 + 眼过**

Run: `npm run build && npm run qa:sweep && npm run qa:visual`
Expected:diff 含含主按钮的屏(我的/记录/账本表单等)。`open .verification/acceptance/_changed/` 确认主按钮更立体、白字对比足够、`:active` 缩放仍在(`buttons-tap.css` 全局 tap 不受影响)。

- [ ] **Step 3: 提交**
```bash
git add frontend/src/styles/premium-depth.css
git commit -m "feat(#37): 主按钮立体渐变系统"
```

---

## Task 4: 门面层 + 品类光色

**Files:**
- Modify: `frontend/src/styles/premium-depth.css`(替换 Task 1 的临时 feeding 规则)
- Modify: `scripts/test-premium-depth.mjs`(收紧到 5 张门面卡)

- [ ] **Step 1: 收紧测试到 5 张门面卡**

把 `scripts/test-premium-depth.mjs` 里第 2) 段那一行 feeding 断言,替换为对 5 张卡的循环:
```javascript
// 2) 5 张门面卡各自设了品类 --glow
for (const h of [".feeding-alarm-card",".sleep-entry-card",".growth-entry-card",".vaccine-card",".ledger-ai-entry-card"]) {
  const re = new RegExp(h.replace(/[.\-]/g, "\\$&") + "[^,{][^{]*\\{[^}]*--glow\\s*:");
  assert.ok(re.test(css), `${h} 应设置自己的品类 --glow`);
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node scripts/test-premium-depth.mjs`
Expected:FAIL —— `.sleep-entry-card 应设置自己的品类 --glow`(目前只有 feeding 的临时规则)。

- [ ] **Step 3: 用正式门面规则替换 Task 1 的临时 feeding 行**

把 premium-depth.css 里 Task 1 末尾那行注释「临时让 Step 2 测试…」+ 紧跟的 `.feeding-alarm-card { --glow: …; }` 整体删掉,改追加:
```css
/* ===== 门面层:全套 C1(暖表面 + 光晕 + 高光边 + --elev-hero + 大圆角) ===== */
.feeding-alarm-card,
.sleep-entry-card,
.growth-entry-card,
.vaccine-card,
.ledger-ai-entry-card {
  position: relative;
  border-radius: var(--r-hero);
  background: var(--glow), var(--surface-hero);
  box-shadow: var(--edge-light), var(--elev-hero);
  border: 1px solid rgba(234, 223, 208, .85);
}
/* 品类光色(随域) */
.feeding-alarm-card   { --glow: radial-gradient(150px 105px at 82% 8%, rgba(223, 169, 71, .22), rgba(236, 143, 125, .10) 48%, transparent 72%); } /* 喂养=琥珀 */
.sleep-entry-card     { --glow: radial-gradient(150px 105px at 82% 8%, rgba(106, 164, 217, .20), rgba(117, 168, 142, .08) 48%, transparent 72%); } /* 睡眠=天蓝 */
.growth-entry-card    { --glow: radial-gradient(150px 105px at 82% 8%, rgba(236, 143, 125, .20), rgba(223, 169, 71, .08) 48%, transparent 72%); } /* 成长=珊瑚 */
.vaccine-card         { --glow: radial-gradient(150px 105px at 82% 8%, rgba(216, 120, 149, .18), rgba(236, 143, 125, .08) 48%, transparent 72%); } /* 疫苗=玫瑰 */
.ledger-ai-entry-card { --glow: radial-gradient(150px 105px at 82% 8%, rgba(223, 169, 71, .20), rgba(236, 143, 125, .08) 48%, transparent 72%); } /* 账本=琥珀 */
```

- [ ] **Step 4: 测试 + 构建通过**

Run: `node scripts/test-premium-depth.mjs && npm run build`
Expected:`premium-depth tokens tests passed`;build 成功。

- [ ] **Step 5: 变更集 + 眼过门面卡**

Run: `npm run qa:sweep && npm run qa:visual`
然后 `open .verification/acceptance/_changed/`。确认:喂奶闹钟/哄睡/成长/疫苗/账本入口卡有了对应品类的右上柔光晕 + 更深圆角阴影,且光晕没盖住内容文字(`background` 层在内容之下)。注意 `.vaccine-card` 可能不在 4 种子语料里(疫苗入口位置)——若没截到,真机单独看。

- [ ] **Step 6: 提交**
```bash
git add frontend/src/styles/premium-depth.css scripts/test-premium-depth.mjs
git commit -m "feat(#37): 门面层全套 C1 + 五域品类光色"
```

---

## Task 5: 门面卡主题 SVG 点睛(控制者主导 · Codex 产多版)

> **执行说明:此任务是控制者主导的创作步骤,不要交给机械 implementer 盲做。** 由控制者拉 Codex 为每个门面域产多版主题矢量,筛选收敛后嵌成 data-URI。implementer 仅在拿到最终 data-URI 后做机械接线。

**Files:**
- Modify: `frontend/src/styles/premium-depth.css`(追加 `::before` 点睛)

- [ ] **Step 1: 先确认门面卡没占用 ::before**

Run:
```bash
grep -nE "\.(feeding-alarm-card|sleep-entry-card|growth-entry-card|vaccine-card|ledger-ai-entry-card)::(before|after)" frontend/src/styles/*.css
```
Expected:若有命中,改用未占用的伪元素(`::after`)或调整;若无命中,用 `::before`。

- [ ] **Step 2: 控制者拉 Codex 产多版主题 SVG**

控制者用 `codex exec`(canonical:`codex exec --skip-git-repo-check --ephemeral -c service_tier="fast"`)为每域产 2–3 版极简单色矢量(喂奶=奶瓶微光,哄睡=月+星,成长=幼苗/刻度,疫苗=盾/护,账本=小票/币),约束:单色 `currentColor`/可低透明、≤ 1KB、无 `<style>`、viewBox 紧贴、纯 `path/circle`。控制者筛选 1 版/域。

- [ ] **Step 3: 嵌成 data-URI ::before(用每域筛定的 SVG)**

在 premium-depth.css 末尾追加(下面的 `data:image/svg+xml,...` 用 Step 2 收敛后的真实 SVG 经 URL 编码替换;每域一条;`color` 用品类色驱动 `currentColor`):
```css
/* ===== 门面卡主题点睛:右上角单色矢量,极低透明,不挡内容 ===== */
.feeding-alarm-card::before,
.sleep-entry-card::before,
.growth-entry-card::before,
.vaccine-card::before,
.ledger-ai-entry-card::before {
  content: "";
  position: absolute;
  top: 8px;
  right: 10px;
  width: 64px;
  height: 64px;
  background-repeat: no-repeat;
  background-position: top right;
  background-size: contain;
  opacity: .14;
  pointer-events: none;
  z-index: 0;
}
.feeding-alarm-card::before   { color: #dfa947; background-image: url("data:image/svg+xml,REPLACE_FEEDING"); }
.sleep-entry-card::before     { color: #6aa4d9; background-image: url("data:image/svg+xml,REPLACE_SLEEP"); }
.growth-entry-card::before    { color: #ec8f7d; background-image: url("data:image/svg+xml,REPLACE_GROWTH"); }
.vaccine-card::before         { color: #d87895; background-image: url("data:image/svg+xml,REPLACE_VACCINE"); }
.ledger-ai-entry-card::before { color: #dfa947; background-image: url("data:image/svg+xml,REPLACE_LEDGER"); }
```
注:SVG 里用 `fill='currentColor'`,`background-image` 的 SVG data-URI 不继承 `color`,所以编码时直接把品类 hex 写进 SVG 的 `fill`(把上面 `color:` 当文档备注/可删),或用 `mask` 方案让 `currentColor` 生效。implementer 二选一,以 `qa:visual` 眼过结果为准。

- [ ] **Step 4: 构建 + 变更集 + 眼过 + 确认不挡内容**

Run: `npm run build && npm run qa:sweep && npm run qa:visual`
`open .verification/acceptance/_changed/` 确认点睛图在右上、极淡、不压字、跟卡内已有图标不打架。若哪域显脏/抢眼,降 `opacity` 或换 Step 2 的另一版。

- [ ] **Step 5: 提交**
```bash
git add frontend/src/styles/premium-depth.css
git commit -m "feat(#37): 门面卡主题 SVG 点睛(Codex 产多版,控制者收敛)"
```

---

## Task 6: 全链路验收 + 收尾

**Files:**(无新增,跑验证)

- [ ] **Step 1: 全量前端验证**

Run: `npm run test:premium-depth && npm run build && npm run verify:frontend`
Expected:premium-depth 测试过;build 过;`verify:frontend` 全绿(确认没碰坏既有功能/DOM smoke/视觉 smoke)。贴真实输出。

- [ ] **Step 2: 视觉基线终审(只看我们改了什么)**

Run: `npm run qa:sweep && npm run qa:visual`
把 `.verification/acceptance/_changed/` 整目录眼过一遍 + 让 `qa:visual` 的 LLM 复审跑完。逐张确认是「变高级」而非「变丑/掉帧/对比度不足」。记下任何 major,回对应 Task 修。

- [ ] **Step 3: 性能红线自查**

Run: `grep -rn "backdrop-filter" frontend/src/styles/premium-depth.css`
Expected:**零命中**(本特性绝不引入 backdrop-filter)。再真机/模拟低端安卓过一遍四屏滚动 + 相册横滑,确认无新增掉帧。

- [ ] **Step 4: 收尾**

确认工作树干净、`feat/premium-card-polish` 全部提交。交由 `superpowers:finishing-a-development-branch`(或本会话等价收尾)决定合并/OTA 发布。
> 提醒:本特性走 OTA,发布前照 OTA 硬规矩(注入 `VITE_AGENT_API_BASE_URL`、版本单调、OSS-first)。是否发布问用户。

---

## Self-Review

- **Spec 覆盖**:token 体系(T1)✓;四层分层规则——标准/列表(T2)、按钮(T3)、门面+品类光(T4)、弹窗维持现状(不动即满足)✓;品类色编码(T4 五域 --glow)✓;应用映射真实 class(T2/T3/T4 选择器)✓;门面 SVG 点睛(T5,Codex 产多版控制者收敛)✓;性能红线零 backdrop-filter(T6 Step3 grep 守)✓;qa:visual 验收(T1 签基线 + 每任务 diff + T6 终审)✓;纯前端 OTA 零后端(全程)✓。
- **占位扫描**:除 T5 的 `REPLACE_*`(明确标注为 Codex 产出后替换的真实 SVG、属控制者主导步骤,非偷懒占位)外无 TBD;token 值、选择器、测试代码、命令全具体。
- **类型/命名一致**:token 名(`--r-* --elev-* --surface-* --glow --edge-light --btn-primary-*`)在 T1 定义、T2–T4 一致引用;测试在 T1 建、T4 收紧到同 5 个门面 class 选择器;门面 class 名与摸排一致(`.feeding-alarm-card/.sleep-entry-card/.growth-entry-card/.vaccine-card/.ledger-ai-entry-card`)。
