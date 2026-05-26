#!/usr/bin/env node
// One-off probe to capture DailySummaryView screenshots on records/today page.
// Reuses scripts/frontend-smoke.mjs mock state by importing/copying core setup,
// then drives the page to the records tab and screenshots.
//
// Run: node scripts/probe-daily-summary-view.mjs
// Output: .verification/daily-summary-probe/<viewport>.png

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const port = Number(process.env.PROBE_PORT || 4174);
const host = "127.0.0.1";
const baseUrl = `http://${host}:${port}`;
const artifactDir = path.resolve(rootDir, ".verification/daily-summary-probe");

const viewports = [
  { name: "iphone-13-390x844", width: 390, height: 844, mobile: true },
  { name: "iphone-pro-max-430x932", width: 430, height: 932, mobile: true },
  { name: "desktop", width: 1280, height: 900, mobile: false },
];

// Import smokeState by reading the file (avoiding ES module export changes)
async function loadSmokeState() {
  const mod = await import(path.join(rootDir, "scripts/frontend-smoke.mjs")).catch(() => null);
  // Fallback: smokeState is module-private; copy a minimal fixture from inline
  // To stay simple, we re-define a tiny state with daily summary findings
  return {
    profile: {
      nickname: "小宝",
      stage: "born",
      birthDate: "2025-08-15",
      region: "上海",
      feedingPlan: "混合喂养",
      allergies: ["暂未发现"],
      caregivers: [{ relation: "妈妈" }, { relation: "爸爸" }],
    },
    growthEvents: [],
    careLogs: [],
    albumItems: [],
    expenses: [],
    reminders: [],
    memories: [],
    pendingEffects: [],
    messages: [],
    dailySummary: {
      id: "probe-daily-summary",
      date: new Date().toISOString().slice(0, 10),
      text: "小宝今天总体发展良好，全天进食和睡眠正常。",
      facts: [
        "今天共喝奶 6 次，约 660ml",
        "午睡 1.5 小时，夜间睡眠 11 小时",
      ],
      observations: [
        "白天精神状态很好，与家人互动频繁。",
        "晚 8 点洗澡提醒还没标完成。",
      ],
      missingItems: [
        { id: "missing-poop", scope: "family", category: "poop", title: "便便记录", message: "今天还没记便便和体温，需要补一下吗？", actionLabel: "补一下" },
      ],
      accountMissingItems: [],
      findings: [
        {
          type: "family_action_continuity",
          text: "下午 3 点你出门后，妈妈用白噪音哄睡了 25 分钟",
          related: { careLogEventIds: [], growthEventIds: [], albumItemIds: [], expenseIds: [], reminderIds: [], memberIds: [], memoryIds: [], comparedTo: [] },
          action: null,
        },
        {
          type: "expense_price_compare",
          text: "今天买的飞鹤 1 段，比上月单价贵了 ¥12",
          related: { careLogEventIds: [], growthEventIds: [], albumItemIds: [], expenseIds: ["exp-sample-1"], reminderIds: [], memberIds: [], memoryIds: [], comparedTo: ["exp-sample-2"] },
          action: { label: "去账本", target: "ledger:exp-sample-1" },
        },
        {
          type: "media_milestone_candidate",
          text: "妈妈发的这张照片里，他可能第一次扶站",
          related: { careLogEventIds: [], growthEventIds: [], albumItemIds: ["alb-sample-1"], expenseIds: [], reminderIds: [], memberIds: [], memoryIds: [], comparedTo: [] },
          action: { label: "标记里程碑", target: "milestone:first_stand" },
        },
        {
          type: "trend_anomaly",
          text: "本周奶量平均比上周低 25%（仅观察）",
          related: { careLogEventIds: [], growthEventIds: [], albumItemIds: [], expenseIds: [], reminderIds: [], memberIds: [], memoryIds: [], comparedTo: [] },
          action: null,
        },
      ],
      generatedAt: new Date().toISOString(),
      generatedByUserId: "smoke-user",
      sourceFingerprint: "probe",
      stale: false,
    },
    dailySummarySettings: { enabled: true, hour: 21, minute: 30 },
    proTrial: { enabled: true, applicationStatus: "approved", applicationId: "smoke-app-1", appliedAt: "2026-05-12T00:00:00.000Z" },
  };
}

async function startPreviewServer() {
  const child = spawn("npx", ["vite", "preview", "--config", "frontend/vite.config.ts", "--host", host, "--port", String(port), "--strictPort"], {
    cwd: rootDir,
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("preview server start timeout")), 15000);
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      if (text.includes(`${host}:${port}`)) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.on("error", reject);
  });
  return child;
}

async function main() {
  await mkdir(artifactDir, { recursive: true });
  const state = await loadSmokeState();

  const server = await startPreviewServer();
  try {
    const browser = await chromium.launch();
    try {
      for (const vp of viewports) {
        const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, deviceScaleFactor: vp.mobile ? 2 : 1 });
        const page = await ctx.newPage();

        await page.addInitScript(() => {
          window.localStorage.setItem("baby-companion-auth-token", "probe-token");
        });

        await page.route("**/api/**", async (route) => {
          const url = new URL(route.request().url());
          const headers = { "access-control-allow-origin": "*", "content-type": "application/json" };
          if (route.request().method() === "OPTIONS") { await route.fulfill({ status: 204, headers, body: "" }); return; }
          if (url.pathname === "/api/auth/me") {
            await route.fulfill({ status: 200, headers, body: JSON.stringify({
              user: { id: "smoke-user", phone: "13800000000", createdAt: "2026-05-12T00:00:00.000Z" },
              family: { id: "smoke-family", name: "小宝家" },
              member: { roleName: "妈妈", caregiver: true },
              authenticated: true,
              onboardingRequired: false,
            }) });
            return;
          }
          if (url.pathname === "/api/app/state") { await route.fulfill({ status: 200, headers, body: JSON.stringify({ empty: false, state }) }); return; }
          if (url.pathname === "/api/pro/usage") { await route.fulfill({ status: 200, headers, body: JSON.stringify({ days: 30, totalTokens: 0, callCount: 0, inputTokens: 0, outputTokens: 0, featureTops: [], modelNote: "" }) }); return; }
          await route.fulfill({ status: 200, headers, body: JSON.stringify({}) });
        });

        await page.goto(baseUrl, { waitUntil: "networkidle" });
        await page.waitForTimeout(500);

        const clickTab = async (label) => {
          await page.getByRole("button", { name: label }).first().click({ timeout: 5000 }).catch(async () => {
            await page.locator(`text=${label}`).first().click();
          });
          await page.waitForTimeout(400);
        };

        // 1. 记录 Tab today (DailySummaryView)
        await clickTab("记录");
        await page.locator(".daily-summary").first().scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
        await page.screenshot({ path: path.join(artifactDir, `${vp.name}-1-records-today.png`), fullPage: true });

        // 2. 我的 Tab (verify Pro 申请 button hidden)
        await clickTab("我的");
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(artifactDir, `${vp.name}-2-profile.png`), fullPage: true });

        // 3. Action click: 去账本 (back to 记录 → click 去账本 → should switch to 账本 tab)
        await clickTab("记录");
        await page.locator(".daily-summary").first().scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
        await page.locator("button.daily-summary__finding-action", { hasText: "去账本" }).first().click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(artifactDir, `${vp.name}-3-action-ledger.png`), fullPage: true });

        // 4. Action click: 标记里程碑 (open MilestonesView)
        await clickTab("记录");
        await page.locator(".daily-summary").first().scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
        await page.locator("button.daily-summary__finding-action", { hasText: "标记里程碑" }).first().click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(artifactDir, `${vp.name}-4-action-milestones.png`), fullPage: true });

        console.log(`saved ${vp.name} (4 screenshots)`);

        await ctx.close();
      }
    } finally {
      await browser.close();
    }
  } finally {
    server.kill("SIGTERM");
    setTimeout(() => { if (server.exitCode === null) server.kill("SIGKILL"); }, 2000).unref();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
