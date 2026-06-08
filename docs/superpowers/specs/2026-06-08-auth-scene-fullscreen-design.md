# 全屏灵动开屏 / 同意 / 登录页 Spec v1

- 创建日期：2026-06-08
- 状态：前端 UI 改进 spec，进入 implementation plan 前需评审
- 适用范围：首登同意页（ConsentGate）、登录态（auth-panel：加载中/登录/引导）的视觉外观
- 不改动：同意/登录/引导的业务逻辑（勾选、隐私协议、登录表单、退出登录等）、主应用界面

## 0. 背景与目标

当前同意页和登录页都是「中间一块卡片 + 平背景」，略显单调。用户希望更**灵动**、尽量**全屏**。已确认方向：**纯 CSS 全屏灵动背景 + 毛玻璃表单**，范围覆盖**同意页 + 所有登录态**。不使用生成图（codex 生图本轮不需要）。

## 1. 现状（事实依据）

- 同意页：`frontend/src/components/ConsentGate.tsx` —— `.consent-gate-backdrop`（全屏遮罩）> `.consent-gate-card`（居中卡片：badge、文案、内测说明、隐私/协议链接、监护人勾选、同意并继续）。样式在 `frontend/src/styles/consent.css`（约 226 行）。
- 登录态：`frontend/src/App.tsx` 约 6310–6465。结构为 `<main className="app-shell auth-shell"><section className="auth-panel"><StorybookScene/>…</section></main>`，三态：
  - `authStatus === "checking"`：加载中（"正在确认登录状态…"）。
  - `authStatus === "unauthenticated"`：登录（手机号 + 邀请码 + 角色/权限 + 登录）。
  - 引导态：`.auth-panel.onboarding-panel`。
- 已有装饰组件：`frontend/src/components/StorybookScene.tsx`（`.storybook-scene`：太阳/云/星星/宝宝形象 `companion.png`），目前渲染在 `.auth-panel` 内部。
- `.auth-panel` 样式分散在 `mobile-app.css`（144、185、198、203）与 `warm-theme.css`（101、107(::before)、135(.storybook-scene)、589、1202+ 媒体查询）。
- **冒烟测试依赖**：`scripts/frontend-smoke.mjs` 未登录态会 `waitForSelector(".auth-panel")`。→ **必须保留 `.auth-panel` 类名**。

## 2. 共享组件 `AuthScene`

新建 `frontend/src/components/AuthScene.tsx`（DRY：同意页与所有登录态共用），渲染一个全屏场景容器 + 居中内容槽：

```
<div className="auth-scene">
  <div className="auth-scene-bg" aria-hidden>   // 全屏 aurora 渐变 + 漂浮柔光斑 + storybook 点缀
     …blobs / stars / 宝宝形象(companion.png)…
  </div>
  <div className="auth-scene-content">{children}</div>  // 居中，放毛玻璃面板
</div>
```

- **全屏暖色 aurora**：奶油/暖绿柔和渐变铺满视口（含安全区 `env(safe-area-inset-*)`），缓慢流动。
- **漂浮柔光形状**：2–3 个大柔光圆斑（径向渐变 + `filter: blur`）缓慢飘移，是"灵动"主来源。
- **故事书点缀**：复用 `companion.png`，宝宝形象轻浮动、几颗星星微闪（复用/迁移 storybook 元素的精神）；点缀克制，不喧宾夺主。
- **内容槽**：垂直水平居中，留安全区内边距；窄屏近全宽（留边距），宽屏有舒适 max-width。
- **动效**：全部 CSS `@keyframes`；`@media (prefers-reduced-motion: reduce)` 关闭动效，静态依然好看。
- 纯 CSS，无新图片资源（仅复用既有 `companion.png`）。

## 3. 同意页（ConsentGate）

- 用 `<AuthScene>` 包裹内容；`.consent-gate-card` 重做为**毛玻璃面板**（半透明背景 + `backdrop-filter: blur` + 柔边 + 柔和阴影），浮在全屏场景上。
- 勾选、隐私/协议入口、同意并继续等逻辑与 DOM 结构保持不变（仅外观/包裹层调整）。

## 4. 登录 / 加载 / 引导态（auth-panel）

- 三态各自用 `<AuthScene>` 包裹其 `.auth-panel`；**保留 `.auth-panel` 类名**。
- `.auth-panel` 重做为与同意页同款**毛玻璃面板**。
- 移除 `.auth-panel` 内联的 `<StorybookScene/>`（背景统一由 AuthScene 提供）。`StorybookScene.tsx` 若不再被引用可保留文件或并入 AuthScene（实现时决定，避免悬空引用）。
- 表单、字段、按钮、退出登录等逻辑不动。

## 5. 旧样式收拾

- 梳理 `mobile-app.css` 与 `warm-theme.css` 中的 `.auth-panel`/`.storybook-scene`/`.auth-panel::before` 规则：与新全屏 + 毛玻璃方案对齐，移除/覆盖会打架的旧装饰（如把装饰限制在中间块的定位）。
- 不做与本目标无关的重构。

## 6. 测试与验收

- **build**：`npm run build` 通过（类型检查 + 打包）。
- **冒烟**：`npm run smoke:frontend` 通过（仍能在未登录态等到 `.auth-panel`）。
- **真机/截图自查**：
  - 同意页与登录页背景**全屏铺满**、有暖色 aurora + 轻微漂浮动效；
  - 表单/卡片为**毛玻璃面板**居中浮于其上；
  - 加载中 / 登录 / 引导三态风格一致；
  - `prefers-reduced-motion` 下动效关闭、静态正常；
  - 各屏尺寸（含刘海安全区）布局正常、无溢出。

## 7. 不在本期范围（YAGNI）

- codex 生成插画 / 任何新图片资源（本轮纯 CSS）。
- 视频预览、相册等其它界面。
- 同意/登录/引导的文案与业务流程改动。
