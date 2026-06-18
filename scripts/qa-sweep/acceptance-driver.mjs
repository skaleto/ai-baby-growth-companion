#!/usr/bin/env node
// 验收驱动:种子 × 视口 真实跑 app,落 artifact + 跑断言,出摘要。先 npm run build。
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { SEEDS } from "./seed-matrix.mjs";
import { ASSERTIONS } from "./assertions.mjs";
import { rootDir, VIEWPORTS, startPreview, waitForServer, installMocks, captureArtifacts } from "./harness.mjs";

const port = Number(process.env.QA_SWEEP_PORT || 4360);
const baseUrl = `http://127.0.0.1:${port}`;
// 断言只在一个代表性手机视口跑一次(避免 4×4 重复);其余视口只取截图给视觉层。
const ASSERT_VIEWPORT = "iphone-13-390x844";
const TABS = ["记录", "相册", "账本", "我的"];

const srv = startPreview(port);
let browser; const findings = []; const errors = [];
try {
  await waitForServer(baseUrl);
  browser = await chromium.launch();
  for (const seed of SEEDS) {
    for (const vp of VIEWPORTS) {
      const ctx = await driveOne(seed, vp);
      if (vp.name === ASSERT_VIEWPORT) {
        try { findings.push(...(await ASSERTIONS[seed.label](ctx.page, ctx.mock))); }
        catch (e) { errors.push(`${seed.label} 断言异常: ${e.message}`); }
      }
      await ctx.context.close();
    }
  }
} finally {
  if (browser) await browser.close();
  await srv.stop();
}

const failed = findings.filter((f) => !f.ok);
const summary = { generatedAt: new Date().toISOString(), seeds: SEEDS.map((s) => s.label), viewports: VIEWPORTS.map((v) => v.name), total: findings.length, failed: failed.length, findings, errors };
const outDir = path.join(rootDir, ".verification/acceptance");
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "sweep-summary.json"), JSON.stringify(summary, null, 2) + "\n");

console.log(`\n验收巡检 driver:${SEEDS.length} 种子 × ${VIEWPORTS.length} 视口`);
console.log("─".repeat(56));
for (const f of findings) console.log(`  ${f.ok ? "✔" : "✗"} [${f.seed}] ${f.check}${f.ok ? "" : "  → " + f.detail}`);
if (errors.length) { console.log("\n驱动异常:"); errors.forEach((e) => console.log("  ! " + e)); }
console.log(`\n断言 ${findings.length} 条,失败 ${failed.length};摘要 + 截图语料见 .verification/acceptance/`);
process.exitCode = failed.length || errors.length ? 1 : 0;

async function driveOne(seed, vp) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.mobile ? 2 : 1, isMobile: vp.mobile, hasTouch: vp.mobile });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const mock = await installMocks(page, seed);
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("main.app-shell", { timeout: 15000 });
  await page.waitForTimeout(300);
  // 导航主屏各取一张截图(对话 tab 只读种子没有,容错)
  for (const tab of TABS) {
    try { await page.getByRole("button", { name: tab }).last().click(); await page.waitForTimeout(200); } catch {}
    await captureArtifacts(page, seed.label, `${vp.name}__${tab}`, mock).catch(() => {});
  }
  return { context, page, mock };
}
