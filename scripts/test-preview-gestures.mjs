#!/usr/bin/env node
// DOM 级预览集成回归测试(真实浏览器 + 真实组件,PhotoSwipe 版)。
// 手势物理(跟手/惯性/缩放)由 PhotoSwipe 库承担,这里验证集成层:
// 反复开关不卡死、翻页与标题一致、慢网即点开不卡死、reload 后已浏览图零网络(缓存)。
// 用法:node scripts/test-preview-gestures.mjs(要求 dist 已构建,与 smoke 相同前提)

import assert from "node:assert/strict";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const port = Number(process.env.PREVIEW_GESTURE_PORT || 4319);
const host = "127.0.0.1";
const baseUrl = `http://${host}:${port}`;

// 1x1 红色 PNG(相册图片字节)
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
  "base64",
);

const albumItems = ["第一张照片", "第二张照片", "第三张照片", "第四张照片", "第五张照片"].map((title, i) => ({
  id: `gesture-album-${i + 1}`,
  kind: "media",
  title,
  date: "2026-06-0" + (i + 1),
  occurredAt: `2026-06-0${i + 1}T08:00:00.000Z`,
  category: "daily",
  tags: [],
  attachmentId: `gesture-att-${i + 1}`,
  attachment: {
    id: `gesture-att-${i + 1}`,
    name: `photo-${i + 1}.png`,
    kind: "image",
    url: `/api/uploads/gesture-att-${i + 1}`,
    mimeType: "image/png",
    width: 1,
    height: 1,
    createdAt: `2026-06-0${i + 1}T08:00:00.000Z`,
  },
  source: "manual",
  recordedBy: { label: "妈妈", roleName: "妈妈" },
}));

// 无尺寸的横版老照片(SVG 1600x800):用于断言「不会被错当正方形显示」。
albumItems.push({
  id: "gesture-album-wide",
  kind: "media",
  title: "横图无尺寸",
  date: "2026-05-30",
  occurredAt: "2026-05-30T08:00:00.000Z",
  category: "daily",
  tags: [],
  attachmentId: "gesture-att-wide",
  attachment: {
    id: "gesture-att-wide",
    name: "wide.svg",
    kind: "image",
    url: "/api/uploads/gesture-att-wide",
    mimeType: "image/svg+xml",
    createdAt: "2026-05-30T08:00:00.000Z",
  },
  source: "manual",
  recordedBy: { label: "妈妈", roleName: "妈妈" },
});

albumItems.push({
  id: "gesture-album-video",
  kind: "media",
  title: "测试视频",
  date: "2026-05-31",
  occurredAt: "2026-05-31T08:00:00.000Z",
  category: "daily",
  tags: [],
  attachmentId: "gesture-att-video",
  attachment: {
    id: "gesture-att-video",
    name: "clip.mp4",
    kind: "video",
    url: "/api/uploads/gesture-att-video",
    mimeType: "video/mp4",
    createdAt: "2026-05-31T08:00:00.000Z",
  },
  source: "manual",
  recordedBy: { label: "妈妈", roleName: "妈妈" },
});

const WIDE_SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="800"><rect width="1600" height="800" fill="#3a7"/></svg>',
);

const appState = {
  profile: { nickname: "小宝", birthDate: "2026-02-01", caregivers: ["妈妈"] },
  messages: [], growthEvents: [], growthMeasurements: [], careLogs: [],
  reminders: [], memories: [], pendingEffects: [], expenses: [],
  albumItems,
  conversationSummary: null,
  thinkingEnabled: false,
  selectedModel: "auto",
  proTrial: { enabled: true, entitlement: { enabled: true }, application: null, freeMonthlyQuota: 10, freeCallsRemaining: null },
};

function startServer() {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const child = spawn(npx, ["vite", "preview", "--config", "frontend/vite.config.ts", "--host", host, "--port", String(port), "--strictPort"], {
    cwd: rootDir, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, BROWSER: "none" },
  });
  return {
    stop: () => new Promise((r) => { if (child.exitCode !== null) return r(); child.once("exit", r); child.kill("SIGTERM"); setTimeout(() => child.exitCode === null && child.kill("SIGKILL"), 3000).unref(); }),
  };
}

async function waitFor(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const res = await fetch(url); if (res.ok || res.status === 404) return; } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`server not ready: ${url}`);
}

let uploadDelayMs = 0;
let uploadHits = 0;
const uploadHitsByPath = new Map();
const setUploadDelay = (ms) => { uploadDelayMs = ms; };
const getUploadHits = () => uploadHits;
const snapshotHits = () => new Map(uploadHitsByPath);

async function installMocks(page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("baby-companion-auth-token", "gesture-test-token");
    window.localStorage.setItem("baby-companion-consent-v1", JSON.stringify(true));
    window.__COUNT_ALBUM_RENDERS = true;
    window.__PSWP_TEST_HOOK = true;
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS", "content-type": "application/json" };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers, body: "" });
    if (url.pathname.startsWith("/api/uploads/")) {
      uploadHits += 1;
      uploadHitsByPath.set(url.pathname, (uploadHitsByPath.get(url.pathname) || 0) + 1);
      if (uploadDelayMs) await new Promise((r) => setTimeout(r, uploadDelayMs));
      if (url.pathname.includes("gesture-att-wide")) {
        return route.fulfill({ status: 200, headers: { ...headers, "content-type": "image/svg+xml" }, body: WIDE_SVG });
      }
      if (url.pathname.includes("gesture-att-video")) {
        return route.fulfill({ status: 200, headers: { ...headers, "content-type": "video/mp4" }, body: "" });
      }
      return route.fulfill({ status: 200, headers: { ...headers, "content-type": "image/png" }, body: PNG_BYTES });
    }
    if (url.pathname === "/api/auth/me") {
      return route.fulfill({ status: 200, headers, body: JSON.stringify({
        user: { id: "u1", phone: "13800000000", createdAt: "2026-05-01T00:00:00.000Z" },
        family: { id: "f1", name: "小宝家" }, member: { roleName: "妈妈", caregiver: true },
        authenticated: true, onboardingRequired: false }) });
    }
    if (url.pathname === "/api/app/state") {
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ empty: false, state: appState }) });
    }
    if (url.pathname === "/api/pro/usage") {
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ days: 30, requestCount: 0, successfulRequestCount: 0, meteredRequestCount: 0, unmeteredRequestCount: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, byFeature: [], byModel: [] }) });
    }
    if (url.pathname === "/api/auth/family/members") {
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ members: [
        { userId: "u1", roleName: "妈妈", caregiver: true, maskedPhone: "138****0000", joinedAt: "2026-05-01T00:00:00.000Z" },
      ] }) });
    }
    // 与 smoke 相同的兜底:带 state,避免未知端点解析出 undefined 字段。
    return route.fulfill({ status: 200, headers, body: JSON.stringify({ ok: true, empty: false, state: appState }) });
  });
}

const previewTitle = (page) => page.locator(".pswp-album-info strong").first();
// 箭头按钮已按产品决定移除(触屏滑动翻页);测试经 __PSWP_TEST_HOOK 直接驱动实例翻页。
const pswpNext = (page) => page.evaluate(() => window.__pswpLightbox?.pswp?.next());
const pswpPrev = (page) => page.evaluate(() => window.__pswpLightbox?.pswp?.prev());

async function openFirstTile(page) {
  await page.locator(".album-photo-thumb").first().click();
  await page.locator(".pswp").waitFor({ state: "visible", timeout: 4000 });
}

async function closePreview(page) {
  // 自定义关闭按钮(默认 .pswp__button--close 已隐藏)。
  await page.locator(".pswp__button--album-close").click({ timeout: 2500 });
  await page.locator(".pswp").waitFor({ state: "detached", timeout: 3500 });
}

const server = startServer();
let browser;
try {
  await waitFor(baseUrl);
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(4000);
  page.on("pageerror", (e) => console.log("[pageerror]", e.message.slice(0, 300)));
  page.on("console", (m) => { if (m.type() === "error") console.log("[console.error]", m.text().slice(0, 240)); });
  // 「编辑」走 window.prompt:测试里一律取消(返回 null → editAlbumItem 早退,不改状态)。
  page.on("dialog", (d) => { void d.dismiss().catch(() => undefined); });
  await installMocks(page);
  await page.goto(baseUrl, { waitUntil: "networkidle" });

  const vtSupported = await page.evaluate(() => typeof document.startViewTransition === "function");
  console.log(`[env] View Transitions supported in this browser: ${vtSupported}`);

  // 进相册 tab(与 smoke 相同:页面存在多个同名按钮,取 tab 栏的最后一个)
  await page.getByRole("button", { name: "相册" }).last().click();
  await page.locator(".album-photo-thumb").first().waitFor({ state: "visible", timeout: 6000 });

  // ---- A. 反复点开/关闭 8 次:每次都必须在时限内可交互,绝不卡死 ----
  for (let i = 0; i < 8; i++) {
    await openFirstTile(page);
    await closePreview(page);
  }
  console.log("[A] open/close x8: no deadlock, always interactive ✔");

  // ---- B. 连续快速翻页 3 次(动画余韵中接连出手):每次恰好前进一张,标题同步 ----
  await openFirstTile(page);
  assert.match(await previewTitle(page).innerText(), /第五张照片/, "相册倒序:打开第一个 tile 应是最新的第 5 张");
  for (let i = 0; i < 3; i++) {
    await pswpNext(page);
    await new Promise((r) => setTimeout(r, 150)); // 不等动画走完就下一次
  }
  await new Promise((r) => setTimeout(r, 500));
  const afterFast = await previewTitle(page).innerText();
  assert.match(afterFast, /第二张照片/, `连续翻页 3 次应恰好前进 3 张(5→2),实际「${afterFast}」`);
  console.log("[B] 3 rapid next => exactly +3 pages, title in sync ✔");

  // ---- D. 反向翻页恰好回到上一张 ----
  await pswpPrev(page);
  await new Promise((r) => setTimeout(r, 500));
  const afterBack = await previewTitle(page).innerText();
  assert.match(afterBack, /第三张照片/, `反向翻页应回到第 3 张,实际「${afterBack}」`);
  console.log("[D] prev => back exactly one page ✔");

  // ---- E. 收尾:关闭仍可交互 ----
  await closePreview(page);
  console.log("[E] final close: interactive ✔");

  // ---- J. 顶栏:自定义干净关闭按钮在位、自带塑料关闭隐藏;⋯ 菜单点开才出编辑/删除 ----
  await openFirstTile(page);
  // 自定义关闭可见、自带关闭隐藏(塑料图标问题)
  assert.equal(await page.locator(".pswp__button--album-close").isVisible(), true, "自定义关闭按钮应可见");
  const defaultCloseBox = await page.locator(".pswp__button--close").boundingBox();
  assert.equal(defaultCloseBox, null, "自带(塑料)关闭按钮应隐藏(display:none → 无盒模型)");
  // 初始:popover 必须隐藏(灰框常驻 bug 的回归断言)
  assert.equal(await page.locator(".pswp-album-popover").isVisible(), false, "菜单弹层初始必须隐藏(不得灰框常驻)");
  // 点 ⋯ → 弹层出现,含「编辑」「删除」
  await page.locator(".pswp__button--album-menu").click({ timeout: 2000 });
  await page.locator(".pswp-album-popover.is-open").waitFor({ state: "visible", timeout: 2000 });
  assert.equal(await page.locator(".pswp-album-popover button", { hasText: "编辑" }).isVisible(), true, "弹层应有「编辑」");
  assert.equal(await page.locator(".pswp-album-popover button", { hasText: "删除" }).isVisible(), true, "弹层应有「删除」");
  // 再点 ⋯ → 收起(切换可用)
  await page.locator(".pswp__button--album-menu").click({ timeout: 2000 });
  assert.equal(await page.locator(".pswp-album-popover").isVisible(), false, "再次点击应收起弹层");
  // 点「编辑」→ 预览必须保持打开(深色弹窗直接盖在预览上,绝不「自动返回瀑布页」),
  // 同时证明内层按钮点击生效(非内嵌 button 死区)。
  await page.locator(".pswp__button--album-menu").click({ timeout: 2000 });
  await page.locator(".pswp-album-popover.is-open").waitFor({ state: "visible", timeout: 2000 });
  await page.locator(".pswp-album-popover button", { hasText: "编辑" }).click({ timeout: 2000 });
  const admCancel = page.locator(".adm-dialog-button", { hasText: "取消" });
  await admCancel.waitFor({ state: "visible", timeout: 3000 });
  assert.equal(await page.locator(".pswp").count(), 1, "编辑弹窗打开时预览必须保持打开(不得自动返回瀑布页)");
  assert.equal(await page.locator(".adm-dialog-body.app-dialog-dark").count(), 1, "预览内的弹窗必须用深色变体(黑底详情页配白弹窗突兀)");
  await admCancel.click({ timeout: 2000 });
  await admCancel.waitFor({ state: "detached", timeout: 3000 });
  assert.equal(await page.locator(".pswp").count(), 1, "取消编辑后必须仍停留在预览内");
  await closePreview(page);
  console.log("[J] clean close button + ⋯ menu edit keeps preview open w/ dark dialog ✔");

  // 瀑布页长按气泡已彻底移除(编辑/删除仅保留在详情页 ⋯ 菜单,见 [J])——长按不再有任何动作。
  {
    const thumbBox = await page.locator(".album-photo-thumb").first().boundingBox();
    const cx = thumbBox.x + thumbBox.width / 2;
    const cy = thumbBox.y + thumbBox.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await new Promise((r) => setTimeout(r, 700)); // 远超旧 480ms 长按阈值,仍按住
    assert.equal(await page.locator(".album-tile-menu").count(), 0, "瀑布页长按不得再浮出任何气泡(特性已移除)");
    // 移开再松手:避免原地松手被判定为一次点击而打开预览,保持 [K] 的干净起点。
    await page.mouse.move(cx, cy + 220);
    await page.mouse.up();
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(await page.locator(".pswp").count(), 0, "长按后不应有任何预览残留");
    console.log("[P] masonry long-press is inert (no bubble) ✔");
  }

  // ---- K. 相邻图无缝贴合:slide 间距必须 == 视口宽(spacing:0),不得有黑边间隔 ----
  await openFirstTile(page);
  await pswpNext(page); // 让三个 holder 都就位
  await new Promise((r) => setTimeout(r, 500));
  // 读内联 style.transform(setTransform 对 display:none 的侧边 holder 也会写),避免 computed 取不到。
  const holderX = await page.$$eval(".pswp__item", (els) =>
    els.map((el) => { const m = /translate3d\(\s*(-?[\d.]+)px/.exec(el.style.transform || ""); return m ? parseFloat(m[1]) : null; })
       .filter((v) => v !== null).sort((a, b) => a - b));
  const gaps = holderX.slice(1).map((v, i) => Math.round(v - holderX[i])).filter((d) => d > 1);
  const minGap = gaps.length ? Math.min(...gaps) : -1;
  // 视口 390:spacing 0 → 间距 390;旧默认 spacing 0.1 → 429(那条黑边)。
  assert.equal(minGap, 390, `相邻 slide 间距应等于视口宽 390(无缝),实际 ${minGap}(429=默认黑边间隔, holderX=${JSON.stringify(holderX)})`);
  console.log(`[K] adjacent slides are seamless (gap=${minGap}px == viewport, no black bar) ✔`);
  await closePreview(page);

  // ---- H. 无尺寸老照片:显示比例必须跟随真实图(1600x800 ≈ 2:1),不得变正方形 ----
  await page.getByRole("button", { name: "预览 横图无尺寸" }).click();
  await page.locator(".pswp").waitFor({ state: "visible", timeout: 4000 });
  await new Promise((r) => setTimeout(r, 900)); // 等 loadComplete 尺寸精修
  assert.equal(await page.locator(".pswp-video-bar.is-video").count(), 0, "图片 slide 不应显示视频控制条");
  const box = await page.locator(".pswp__item:not([aria-hidden='true']) .pswp__img").first().boundingBox();
  assert.ok(box, "横图的 .pswp__img 应可见");
  const displayRatio = box.width / box.height;
  assert.ok(displayRatio > 1.6, `无尺寸横图显示比例应≈2:1,实际 ${displayRatio.toFixed(2)}(≈1 即被错当正方形)`);
  console.log(`[H] dimension-less wide photo renders at true ratio (${displayRatio.toFixed(2)}) ✔`);
  await closePreview(page);

  // ---- I. 视频 slide:占位层必须撤掉(黑屏回归)、video 元素就位且铺开 ----
  await page.getByRole("button", { name: "预览 测试视频" }).click();
  await page.locator(".pswp").waitFor({ state: "visible", timeout: 4000 });
  await page.locator(".pswp__item:not([aria-hidden='true']) video.pswp-video").waitFor({ state: "visible", timeout: 3000 });
  const vbox = await page.locator(".pswp__item:not([aria-hidden='true']) video.pswp-video").boundingBox();
  assert.ok(vbox && vbox.width >= 300, `视频应铺满宽度(≥300px),实际 ${vbox?.width}`);
  const placeholders = await page.locator(".pswp__item:not([aria-hidden='true']) .pswp__img--placeholder").count();
  assert.equal(placeholders, 0, "视频 slide 的占位层必须被移除(否则盖住视频=黑屏)");
  // 控制条挂 pswp UI 层(教训:slide 内控件与手势层抢触摸)——视频页必须可见,含播放/进度控件。
  await page.locator(".pswp-video-bar.is-video").waitFor({ state: "visible", timeout: 3000 });
  assert.ok(await page.locator(".pswp-video-bar .pswp-vb-center").isVisible(), "暂停态应显示居中播放按钮");
  // 左下角切换键两态常驻(播放=暂停键/暂停=继续播放键),不许整个按钮消失导致滑轨跳长。
  assert.ok(await page.locator(".pswp-video-bar .pswp-vb-toggle").isVisible(), "左下角播放/暂停切换键必须两态常驻");
  assert.ok(await page.locator(".pswp-video-bar .pswp-vb-progress").isVisible(), "视频控制条应有进度条");
  // 「视频页滑不动」回归:触摸必须能穿过 <video> 到达 pswp 手势层。
  const videoPE = await page.locator(".pswp__item:not([aria-hidden='true']) video.pswp-video").evaluate((el) => getComputedStyle(el).pointerEvents);
  assert.equal(videoPE, "none", "video 元素必须 pointer-events:none(WebView 会吃掉落在视频上的触摸=滑不动页)");
  console.log("[I] video slide: placeholder removed, video laid out, UI-layer control bar visible ✔");
  await closePreview(page);

  // ---- Q. 视频 slide 真·横滑必须翻页(回归:pswp 给注册 UI 元素加 .pswp__hide-on-close 并在
  //        .pswp--ui-visible 下强制 pointer-events:auto〔0,2,0〕,盖过视频条单类 none,让 inset:0
  //        的全屏条吞掉每次横滑 → 视频页滑不动。此前只有程序翻页〔pswp.next()〕测试,漏掉真滑。 ----
  await page.getByRole("button", { name: "预览 测试视频" }).click();
  await page.locator(".pswp").waitFor({ state: "visible", timeout: 4000 });
  await page.locator(".pswp__item:not([aria-hidden='true']) video.pswp-video").waitFor({ state: "visible", timeout: 3000 });
  await page.locator(".pswp-video-bar.is-video").waitFor({ state: "visible", timeout: 3000 });
  // 复现「自动播放被拦→停在暂停态、中央 ▶ 常驻」的真机情形,这正是最易被吞滑动的状态。
  await page.evaluate(() => { const v = window.__pswpLightbox?.pswp?.currSlide?.content?.element?.querySelector?.("video"); if (v) v.pause(); });
  await new Promise((r) => setTimeout(r, 400)); // 等开场动画结束、.pswp--ui-visible 与内容布局就位
  // 中央那个点必须穿过视频条落到 slide 内容(条若可点=吞滑动)。
  const hit = await page.evaluate(() => { const el = document.elementFromPoint(195, 420); return { ok: !!el?.closest(".pswp-video-shell"), tag: el ? `${el.tagName}.${el.className || ""}`.slice(0, 70) : "null" }; });
  assert.ok(hit.ok, `视频条必须 pointer-events:none——中央点应命中 slide 内容而非全屏条本身(否则吞横滑);实际命中 ${hit.tag}`);
  const vIdxBefore = await page.evaluate(() => window.__pswpLightbox.pswp.currIndex);
  // 真·拖拽(向右=prev;视频非最新张,prev 必有邻居),而非 pswp.prev() 程序翻页。
  await page.mouse.move(150, 420);
  await page.mouse.down();
  for (let x = 150; x <= 330; x += 12) { await page.mouse.move(x, 420); await new Promise((r) => setTimeout(r, 8)); }
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 500));
  const vIdxAfter = await page.evaluate(() => window.__pswpLightbox.pswp.currIndex);
  assert.notEqual(vIdxAfter, vIdxBefore, `视频页中央真·横滑必须翻页(${vIdxBefore}->${vIdxAfter} 未动=「视频页滑不动」BUG 回归)`);
  console.log("[Q] real drag across video slide changes page (full-screen bar no longer eats swipes) ✔");
  await closePreview(page);

  // ---- L. 预加载的相邻视频绝不自播:无 autoplay、保持暂停(后台漏音回归) ----
  // 横图(05-30)的相邻 slide 是测试视频(05-31):打开横图,PhotoSwipe 会预加载视频内容。
  await page.getByRole("button", { name: "预览 横图无尺寸" }).click();
  await page.locator(".pswp").waitFor({ state: "visible", timeout: 4000 });
  await new Promise((r) => setTimeout(r, 800)); // 等相邻 slide 预加载完成
  const preloadState = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".pswp video")).map((v) => ({ autoplay: v.autoplay, paused: v.paused })));
  for (const v of preloadState) {
    assert.equal(v.autoplay, false, "预览视频元素绝不允许带 autoplay(预加载的相邻视频会带声自播)");
    assert.equal(v.paused, true, "未激活的预加载视频必须处于暂停态");
  }
  // 划到视频再划走:被划过的视频也必须停。
  await pswpPrev(page); // 到视频
  await new Promise((r) => setTimeout(r, 400));
  await pswpNext(page); // 划走
  await new Promise((r) => setTimeout(r, 500));
  const passedByState = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".pswp video")).map((v) => v.paused));
  assert.ok(passedByState.every(Boolean), "刚划过去的视频必须已暂停(不得后台出声)");
  console.log(`[L] preloaded/passed-by videos never autoplay, all paused (${preloadState.length} probed) ✔`);
  await closePreview(page);

  // ---- F. 慢网络下「瀑布流未渲染好就点开」:绝不卡死(线上卡死复现路径) ----
  setUploadDelay(700);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "相册" }).last().click();
  await page.locator(".album-photo-thumb").first().waitFor({ state: "visible", timeout: 6000 });
  for (let i = 0; i < 6; i++) {
    // 不等任何图片加载完成,立即点开
    await page.locator(".album-photo-thumb").first().click();
    await page.locator(".pswp").waitFor({ state: "visible", timeout: 4000 });
    await closePreview(page);
  }
  console.log("[F] open-before-masonry-ready x6 under slow network: no deadlock ✔");

  // ---- G. 「杀进程后缓存生效」:浏览过的图 reload 后零网络请求 ----
  setUploadDelay(0);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "相册" }).last().click();
  await page.locator(".album-photo-thumb").first().waitFor({ state: "visible", timeout: 6000 });
  await new Promise((r) => setTimeout(r, 1800)); // 等全网格图加载并后台落库(IndexedDB)
  const hitsSnapshot = snapshotHits();
  await page.reload({ waitUntil: "domcontentloaded" }); // ≈ 杀进程重进(IndexedDB 持久,内存清空)
  await page.getByRole("button", { name: "相册" }).last().click();
  await page.locator(".album-photo-thumb").first().waitFor({ state: "visible", timeout: 6000 });
  await new Promise((r) => setTimeout(r, 2000)); // 网格渲染 + IDB 命中窗口
  const imageDeltas = [];
  for (const [path, count] of uploadHitsByPath) {
    const delta = count - (hitsSnapshot.get(path) || 0);
    // 视频流按设计不预缓存(播放≥3s 才落库),网格 <video> 重新拉流是预期行为,豁免。
    if (delta > 0 && !path.includes("video")) imageDeltas.push(`${path} +${delta}`);
  }
  assert.equal(imageDeltas.length, 0, `重进后已缓存的图片不应发网络请求,实际:${imageDeltas.join(", ")}`);
  console.log("[G] after reload, previously viewed IMAGES load with ZERO network requests (video stream exempt by design) ✔");

  // ---- M. AlbumScreen memo 守护:相册已挂载时,在记录页打字 30 字,AlbumScreen 渲染数必须为 0 ----
  await page.getByRole("button", { name: "记录" }).last().click();
  await page.locator(".records-screen").waitFor({ state: "visible", timeout: 6000 });
  await page.getByRole("button", { name: "记账" }).click();
  const mComposer = page.locator(".records-assistant-composer textarea").first();
  await mComposer.waitFor({ state: "visible", timeout: 8000 });
  await mComposer.fill("");
  await mComposer.click();
  const rendersBefore = await page.evaluate(() => window.__albumRenders || 0);
  await page.keyboard.type("宝宝今天第一次翻身啦真是太棒了宝宝今天第一次翻身啦真是太棒了", { delay: 0 });
  await new Promise((r) => setTimeout(r, 300));
  const rendersAfter = await page.evaluate(() => window.__albumRenders || 0);
  assert.equal(rendersAfter - rendersBefore, 0,
    `打字期间 AlbumScreen 渲染了 ${rendersAfter - rendersBefore} 次(memo 失效:某个 props 引用不稳定)`);
  console.log("[M] AlbumScreen renders 0 times during 30-char typing (memo holds) ✔");

  console.log("preview gesture DOM simulation tests passed");
} finally {
  if (browser) await browser.close().catch(() => undefined);
  await server.stop();
}
