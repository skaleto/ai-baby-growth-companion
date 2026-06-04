#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const port = Number(process.env.FRONTEND_SMOKE_PORT || 4173);
const host = process.env.FRONTEND_SMOKE_HOST || "127.0.0.1";
const baseUrl = `http://${host}:${port}`;
const artifactDir = path.resolve(rootDir, process.env.FRONTEND_SMOKE_ARTIFACT_DIR || ".verification/frontend-smoke");
const authMode = process.env.FRONTEND_SMOKE_AUTH || "mock";

const viewports = [
  { name: "desktop", width: 1280, height: 900, mobile: false },
  { name: "iphone-se-375x667", width: 375, height: 667, mobile: true },
  { name: "iphone-13-390x844", width: 390, height: 844, mobile: true },
  { name: "iphone-pro-max-430x932", width: 430, height: 932, mobile: true },
  { name: "android-compact-360x800", width: 360, height: 800, mobile: true },
  { name: "android-pixel-412x915", width: 412, height: 915, mobile: true },
  { name: "android-large-432x960", width: 432, height: 960, mobile: true },
];

const tabLabels = ["聊天", "记录", "账本", "相册", "提醒", "我的"];
const smokeFutureReminderAt = futureDateTimeParts(7 * 24 * 60);

const smokeState = {
  profile: {
    nickname: "小宝",
    stage: "born",
    gender: "girl",
    expectedDate: "2026-01-26",
    birthDate: "2026-01-18",
    birthWeight: 3.2,
    birthHeight: 50,
    region: "上海",
    feeding: "混合喂养",
    allergies: ["暂未发现"],
    caregivers: ["妈妈", "爸爸"],
  },
  messages: [
    {
      id: "smoke-msg-1",
      role: "ai",
      text: "本地冒烟环境已准备好，可以检查移动端布局。",
      createdAt: new Date().toISOString(),
      tags: ["冒烟"],
    },
  ],
  growthEvents: [
    {
      id: "smoke-growth-1",
      type: "first_smile",
      title: "第一次笑出声",
      date: "2026-03-12",
      summary: "用于本地 smoke 的成长记录。",
      firstTime: true,
      tags: ["里程碑"],
    },
  ],
  growthMeasurements: [
    {
      id: "smoke-growth-measurement-1",
      type: "height",
      value: 66.5,
      date: "2026-05-12",
      note: "体检测量",
      recordedBy: { label: "妈妈", roleName: "妈妈" },
    },
  ],
  careLogs: [
    {
      id: "smoke-care-1",
      date: "2026-05-12",
      milkMl: 610,
      milkTimes: 6,
      sleepHours: 13.5,
      wakes: 2,
      soothing: "normal",
      solids: [],
      notes: ["本地冒烟数据"],
      events: [
        {
          id: "smoke-care-event-1",
          type: "milk",
          date: "2026-05-12",
          time: "08:10",
          title: "喝奶",
          amountMl: 110,
          note: "冒烟检查数据",
          tags: ["喝奶"],
          recordedBy: { label: "妈妈", roleName: "妈妈" },
        },
      ],
      recordedBy: { label: "妈妈", roleName: "妈妈" },
    },
  ],
  reminders: [
    {
      id: "smoke-reminder-1",
      title: "晚间洗澡",
      dueText: "每天 20:00",
      category: "routine",
      recurrence: "daily",
      status: "open",
      createdAt: new Date().toISOString(),
      history: [],
    },
    {
      id: "smoke-reminder-future",
      title: "体检疫苗",
      dueText: `${smokeFutureReminderAt.date} ${smokeFutureReminderAt.time}`,
      dueAt: smokeFutureReminderAt.iso,
      category: "vaccine",
      status: "open",
      createdAt: "2026-05-13T14:31:56.623Z",
      history: [],
    },
  ],
  memories: [],
  pendingEffects: [],
  albumItems: [
    {
      id: "smoke-album-video",
      kind: "media",
      title: "冒烟视频",
      date: "2026-05-12",
      occurredAt: "2026-05-12T08:20:00.000Z",
      category: "growth",
      tags: ["冒烟"],
      attachmentId: "smoke-video-attachment",
      attachment: {
        id: "smoke-video-attachment",
        name: "smoke-video.mp4",
        kind: "video",
        url: "/api/uploads/smoke-video",
        mimeType: "video/mp4",
        createdAt: "2026-05-12T08:20:00.000Z",
      },
      source: "manual",
      recordedBy: { label: "爸爸", roleName: "爸爸" },
    },
  ],
  expenses: [
    {
      id: "smoke-expense-1",
      title: "奶粉",
      amount: 268,
      currency: "CNY",
      category: "formula",
      date: "2026-05-12",
      attachmentIds: ["smoke-expense-attachment"],
      attachments: [
        {
          id: "smoke-expense-attachment",
          name: "receipt.png",
          kind: "image",
          url: "/api/uploads/smoke-expense-attachment",
          mimeType: "image/png",
          createdAt: "2026-05-12T08:30:00.000Z",
        },
      ],
      source: "manual",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      recordedBy: { label: "妈妈", roleName: "妈妈" },
    },
  ],
  conversationSummary: null,
  thinkingEnabled: true,
  selectedModel: "deepseek-v4-pro",
  dailySummary: {
    id: "smoke-daily-summary-today",
    date: "2026-05-26",
    text: "小宝今天总体发展良好，全天进食和睡眠正常。",
    facts: [
      "今天共喝奶 6 次，每次约 110ml。",
      "午间睡眠 1.5 小时，夜间睡眠 11 小时。",
    ],
    observations: [
      "白天精神状态很好，与家人互动频繁。",
      "今天添加了新的固体辅食品尝，状态正常。",
    ],
    findings: [
      {
        type: "family_action_continuity",
        text: "下午 3 点你出门后，妈妈用白噪音哄睡了 25 分钟",
        related: {
          careLogEventIds: [],
          growthEventIds: [],
          albumItemIds: [],
          expenseIds: [],
          reminderIds: [],
          memberIds: [],
          memoryIds: [],
          comparedTo: [],
        },
        action: null,
      },
      {
        type: "expense_price_compare",
        text: "今天买的飞鹤 1 段，比上月单价贵了 ¥12",
        related: {
          careLogEventIds: [],
          growthEventIds: [],
          albumItemIds: [],
          expenseIds: ["exp-sample-1"],
          reminderIds: [],
          memberIds: [],
          memoryIds: [],
          comparedTo: ["exp-sample-2"],
        },
        action: {
          label: "去账本",
          target: "ledger:exp-sample-1",
        },
      },
      {
        type: "media_milestone_candidate",
        text: "妈妈发的这张照片里，他可能第一次扶站",
        related: {
          careLogEventIds: [],
          growthEventIds: [],
          albumItemIds: ["alb-sample-1"],
          expenseIds: [],
          reminderIds: [],
          memberIds: [],
          memoryIds: [],
          comparedTo: [],
        },
        action: {
          label: "标记里程碑",
          target: "milestone:first_stand",
        },
      },
    ],
    missingItems: [],
    accountMissingItems: [],
    generatedAt: new Date().toISOString(),
    sourceFingerprint: "smoke-fingerprint",
    stale: false,
  },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function futureDateTimeParts(minutesFromNow = 90) {
  const target = new Date(Date.now() + minutesFromNow * 60 * 1000);
  return {
    date: `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`,
    time: `${String(target.getHours()).padStart(2, "0")}:${String(target.getMinutes()).padStart(2, "0")}`,
    iso: target.toISOString(),
  };
}

async function waitForServer(preview, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    if (preview.child.exitCode !== null) {
      throw new Error(`Vite preview exited before smoke could connect.\n${preview.logs.join("")}`);
    }
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${baseUrl}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

function startPreview() {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const child = spawn(npx, ["vite", "preview", "--config", "frontend/vite.config.ts", "--host", host, "--port", String(port), "--strictPort"], {
    cwd: rootDir,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, BROWSER: "none" },
  });

  const logs = [];
  child.stdout.on("data", (chunk) => logs.push(chunk.toString()));
  child.stderr.on("data", (chunk) => logs.push(chunk.toString()));

  child.on("exit", (code, signal) => {
    if (code !== 0 && signal !== "SIGTERM") {
      console.error(logs.join(""));
    }
  });

  return {
    child,
    logs,
    stop: () =>
      new Promise((resolve) => {
        if (child.exitCode !== null) {
          resolve();
          return;
        }
        child.once("exit", resolve);
        child.kill("SIGTERM");
        setTimeout(() => {
          if (child.exitCode === null) child.kill("SIGKILL");
        }, 3000).unref();
      }),
  };
}

async function installApiMocks(page) {
  if (authMode !== "mock") return;
  let apiState = JSON.parse(JSON.stringify(smokeState));

  await page.addInitScript(() => {
    window.localStorage.setItem("baby-companion-auth-token", "frontend-smoke-token");
  });

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
      "content-type": "application/json",
    };

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers, body: "" });
      return;
    }

    if (url.pathname === "/api/auth/me") {
      await route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify({
          user: { id: "smoke-user", phone: "13800000000", createdAt: "2026-05-12T00:00:00.000Z" },
          family: { id: "smoke-family", name: "小宝家" },
          member: { roleName: "妈妈", caregiver: true },
          authenticated: true,
          onboardingRequired: false,
        }),
      });
      return;
    }

    if (url.pathname === "/api/app/state") {
      if (request.method() === "PUT") {
        apiState = await request.postDataJSON();
      }
      await route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify({ empty: false, state: apiState }),
      });
      return;
    }

    const appRecordMatch = url.pathname.match(/^\/api\/app\/state\/([^/]+)\/([^/]+)$/);
    if (appRecordMatch) {
      const collection = decodeURIComponent(appRecordMatch[1]);
      const id = decodeURIComponent(appRecordMatch[2]);
      if (request.method() === "PUT") {
        const item = await request.postDataJSON();
        if (collection === "profile") {
          apiState.profile = item;
        } else if (Array.isArray(apiState[collection])) {
          const nextItems = apiState[collection].filter((entry) => entry?.id !== id);
          apiState = { ...apiState, [collection]: [...nextItems, { ...item, id }] };
        } else {
          apiState = { ...apiState, [collection]: item };
        }
        await route.fulfill({
          status: 200,
          headers,
          body: JSON.stringify({ empty: false, state: apiState }),
        });
        return;
      }
      if (request.method() === "DELETE") {
        if (Array.isArray(apiState[collection])) {
          apiState = { ...apiState, [collection]: apiState[collection].filter((entry) => entry?.id !== id) };
        }
        await route.fulfill({
          status: 200,
          headers,
          body: JSON.stringify({ empty: false, state: apiState }),
        });
        return;
      }
    }

    if (url.pathname === "/api/pro/usage") {
      await route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify({
          days: 30,
          since: "2026-04-12T00:00:00.000Z",
          generatedAt: new Date().toISOString(),
          requestCount: 3,
          successfulRequestCount: 3,
          meteredRequestCount: 2,
          unmeteredRequestCount: 1,
          inputTokens: 1250,
          outputTokens: 180,
          totalTokens: 1430,
          byFeature: [
            {
              key: "agent_chat",
              label: "agent_chat",
              provider: null,
              model: null,
              feature: "agent_chat",
              inputType: null,
              requestCount: 1,
              successfulRequestCount: 1,
              meteredRequestCount: 1,
              unmeteredRequestCount: 0,
              inputTokens: 980,
              outputTokens: 120,
              totalTokens: 1100,
            },
            {
              key: "daily_summary",
              label: "daily_summary",
              provider: null,
              model: null,
              feature: "daily_summary",
              inputType: null,
              requestCount: 1,
              successfulRequestCount: 1,
              meteredRequestCount: 1,
              unmeteredRequestCount: 0,
              inputTokens: 270,
              outputTokens: 60,
              totalTokens: 330,
            },
          ],
          byModel: [
            {
              key: "deepseek:deepseek-v4-pro",
              label: "deepseek-v4-pro",
              provider: "deepseek",
              model: "deepseek-v4-pro",
              feature: null,
              inputType: null,
              requestCount: 2,
              successfulRequestCount: 2,
              meteredRequestCount: 2,
              unmeteredRequestCount: 0,
              inputTokens: 1250,
              outputTokens: 180,
              totalTokens: 1430,
            },
          ],
        }),
      });
      return;
    }

    if (url.pathname === "/api/uploads/smoke-video") {
      await route.fulfill({
        status: 200,
        headers: { ...headers, "content-type": "video/mp4" },
        body: "",
      });
      return;
    }

    await route.fulfill({
      status: 200,
      headers,
      body: JSON.stringify({ ok: true, empty: false, state: apiState }),
    });
  });
}

async function checkLayout(page, viewportName) {
  const result = await page.evaluate(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const root = document.documentElement;
    const body = document.body;
    const issues = [];

    if (root.scrollWidth > width + 1 || body.scrollWidth > width + 1) {
      issues.push(`horizontal overflow: document ${Math.max(root.scrollWidth, body.scrollWidth)}px > viewport ${width}px`);
    }

    const selectors = [
      "main",
      "nav",
      "section",
      "form",
      "button",
      "input",
      "textarea",
      "[role='dialog']",
      ".mobile-tabbar",
      ".topbar",
      ".composer",
      ".auth-panel",
    ];

    const isVisible = (element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) !== 0 &&
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.top < height
      );
    };

    const offenders = Array.from(document.querySelectorAll(selectors.join(",")))
      .filter(isVisible)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const label =
          element.getAttribute("aria-label") ||
          element.getAttribute("class") ||
          element.textContent?.trim().slice(0, 24) ||
          element.tagName.toLowerCase();
        return { tag: element.tagName.toLowerCase(), label, left: rect.left, right: rect.right, width: rect.width };
      })
      .filter((item) => item.left < -2 || item.right > width + 2 || item.width > width + 2)
      .slice(0, 8);

    offenders.forEach((item) => {
      issues.push(`${item.tag} "${item.label}" outside viewport: left=${Math.round(item.left)}, right=${Math.round(item.right)}, width=${Math.round(item.width)}`);
    });

    const tabbar = document.querySelector(".mobile-tabbar");
    if (tabbar && isVisible(tabbar)) {
      const rect = tabbar.getBoundingClientRect();
      if (rect.left < -1 || rect.right > width + 1 || rect.bottom > height + 1) {
        issues.push(`mobile tabbar outside viewport: left=${Math.round(rect.left)}, right=${Math.round(rect.right)}, bottom=${Math.round(rect.bottom)}`);
      }
    }

    return {
      width,
      height,
      scrollWidth: Math.max(root.scrollWidth, body.scrollWidth),
      scrollHeight: Math.max(root.scrollHeight, body.scrollHeight),
      issues,
    };
  });

  if (result.issues.length) {
    throw new Error(`${viewportName} layout issues:\n- ${result.issues.join("\n- ")}`);
  }
  return result;
}

async function checkAppShellAligned(page, label) {
  const result = await page.evaluate(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const issues = [];
    const root = document.documentElement;
    const body = document.body;
    const app = document.querySelector(".app-shell");

    if (window.scrollX !== 0 || window.scrollY !== 0) {
      issues.push(`window scrolled to ${Math.round(window.scrollX)},${Math.round(window.scrollY)}`);
    }
    if (root.scrollWidth > width + 1 || body.scrollWidth > width + 1) {
      issues.push(`horizontal overflow: document ${Math.max(root.scrollWidth, body.scrollWidth)}px > viewport ${width}px`);
    }
    if (app) {
      const rect = app.getBoundingClientRect();
      if (rect.left < -1 || rect.top < -1 || rect.right > width + 1 || rect.bottom > height + 1) {
        issues.push(`app shell outside viewport: left=${Math.round(rect.left)}, top=${Math.round(rect.top)}, right=${Math.round(rect.right)}, bottom=${Math.round(rect.bottom)}`);
      }
    }

    return { issues };
  });

  if (result.issues.length) {
    throw new Error(`${label} alignment issues:\n- ${result.issues.join("\n- ")}`);
  }
}

async function checkElementVisibleInViewport(page, locator, label) {
  const result = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const width = window.innerWidth;
    const height = window.innerHeight;
    const style = window.getComputedStyle(element);
    const issues = [];
    if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) {
      issues.push("element is not visible");
    }
    if (rect.top < -1 || rect.left < -1 || rect.right > width + 1 || rect.bottom > height - 8) {
      issues.push(`element outside visible viewport: top=${Math.round(rect.top)}, bottom=${Math.round(rect.bottom)}, viewport=${width}x${height}`);
    }
    return { issues };
  });

  if (result.issues.length) {
    throw new Error(`${label} visibility issues:\n- ${result.issues.join("\n- ")}`);
  }
}

async function checkElementAboveKeyboardOverlay(page, locator, label) {
  const result = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    const keyboardInset = Number.parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue("--keyboard-inset")) || 0;
    const keyboardTop = window.innerHeight - keyboardInset;
    const modal = element.closest(".ledger-form-sheet, .reminder-form-sheet");
    const composer = element.closest(".composer");
    const modalRect = modal instanceof HTMLElement ? modal.getBoundingClientRect() : null;
    const composerRect = composer instanceof HTMLElement ? composer.getBoundingClientRect() : null;
    const issues = [];
    if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) {
      issues.push("focused field is not visible");
    }
    if (keyboardInset <= 0 || !document.body.classList.contains("keyboard-open")) {
      issues.push("keyboard overlay state is not active");
    }
    if (rect.bottom > keyboardTop - 10) {
      issues.push(`focused field is covered by keyboard overlay: fieldBottom=${Math.round(rect.bottom)}, keyboardTop=${Math.round(keyboardTop)}`);
    }
    if (modalRect && modalRect.bottom > keyboardTop - 6) {
      issues.push(`modal sheet is covered by keyboard overlay: sheetBottom=${Math.round(modalRect.bottom)}, keyboardTop=${Math.round(keyboardTop)}`);
    }
    if (composerRect && composerRect.bottom > keyboardTop - 6) {
      issues.push(`chat composer is covered by keyboard overlay: composerBottom=${Math.round(composerRect.bottom)}, keyboardTop=${Math.round(keyboardTop)}`);
    }
    if (rect.left < -1 || rect.right > window.innerWidth + 1 || rect.top < -1) {
      issues.push(`focused field outside viewport: left=${Math.round(rect.left)}, top=${Math.round(rect.top)}, right=${Math.round(rect.right)}`);
    }
    return { issues };
  });

  if (result.issues.length) {
    throw new Error(`${label} keyboard overlay issues:\n- ${result.issues.join("\n- ")}`);
  }
}

async function checkMobileTabbarVisible(page, label) {
  const result = await page.evaluate(() => {
    const tabbar = document.querySelector(".mobile-tabbar");
    const modal = document.querySelector(".ledger-form-sheet, .reminder-form-sheet, .reminder-action-modal");
    const issues = [];
    if (!(tabbar instanceof HTMLElement)) {
      issues.push("mobile tabbar is missing");
      return { issues };
    }
    const rect = tabbar.getBoundingClientRect();
    const style = window.getComputedStyle(tabbar);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) < 0.95) {
      issues.push(`mobile tabbar is hidden: display=${style.display}, visibility=${style.visibility}, opacity=${style.opacity}`);
    }
    if (rect.width <= 0 || rect.height <= 0 || rect.bottom > window.innerHeight + 1 || rect.top >= window.innerHeight - 1) {
      issues.push(`mobile tabbar outside viewport: top=${Math.round(rect.top)}, bottom=${Math.round(rect.bottom)}, viewport=${window.innerWidth}x${window.innerHeight}`);
    }
    if (modal instanceof HTMLElement) {
      const modalRect = modal.getBoundingClientRect();
      if (modalRect.bottom > rect.top + 1) {
        issues.push(`modal sheet overlaps tabbar: sheetBottom=${Math.round(modalRect.bottom)}, tabbarTop=${Math.round(rect.top)}`);
      }
    }
    return { issues };
  });

  if (result.issues.length) {
    throw new Error(`${label} tabbar issues:\n- ${result.issues.join("\n- ")}`);
  }
}

async function checkDialogNotBlocked(page, locator, label) {
  const result = await locator.evaluate((dialog) => {
    const rect = dialog.getBoundingClientRect();
    const actions = dialog.querySelector(".story-modal-actions");
    const actionsRect = actions instanceof HTMLElement ? actions.getBoundingClientRect() : null;
    const backdrop = dialog.closest(".story-modal-backdrop");
    const backdropRect = backdrop instanceof HTMLElement ? backdrop.getBoundingClientRect() : null;
    const backdropStyle = backdrop instanceof HTMLElement ? window.getComputedStyle(backdrop) : null;
    const tabbar = document.querySelector(".mobile-tabbar");
    const tabbarStyle = tabbar instanceof HTMLElement ? window.getComputedStyle(tabbar) : null;
    const tabbarRect = tabbar instanceof HTMLElement ? tabbar.getBoundingClientRect() : null;
    const tabbarVisible =
      tabbar instanceof HTMLElement &&
      tabbarStyle &&
      tabbarStyle.display !== "none" &&
      tabbarStyle.visibility !== "hidden" &&
      Number(tabbarStyle.opacity) > 0.2 &&
      tabbarRect &&
      tabbarRect.bottom > 0 &&
      tabbarRect.top < window.innerHeight;
    const safeBottom = tabbarVisible && tabbarRect ? tabbarRect.top : window.innerHeight;
    const issues = [];

    if (rect.width <= 0 || rect.height <= 0) {
      issues.push("dialog is not visible");
    }
    if (rect.left < -1 || rect.right > window.innerWidth + 1 || rect.top < -1 || rect.bottom > safeBottom - 4) {
      issues.push(`dialog is blocked or outside safe area: top=${Math.round(rect.top)}, bottom=${Math.round(rect.bottom)}, safeBottom=${Math.round(safeBottom)}`);
    }
    if (actionsRect && actionsRect.bottom > safeBottom - 8) {
      issues.push(`dialog actions are blocked: actionsBottom=${Math.round(actionsRect.bottom)}, safeBottom=${Math.round(safeBottom)}`);
    }
    if (backdropRect && backdropStyle && backdropRect.bottom < window.innerHeight - 1) {
      const background = backdropStyle.backgroundColor;
      const hasVisibleBackdrop =
        background !== "rgba(0, 0, 0, 0)" &&
        background !== "transparent" &&
        background !== "";
      const hasBackdropFilter = backdropStyle.backdropFilter !== "none" && backdropStyle.backdropFilter !== "";
      if (hasVisibleBackdrop || hasBackdropFilter) {
        issues.push(`visible backdrop is clipped at bottom=${Math.round(backdropRect.bottom)} of viewport=${window.innerHeight}`);
      }
    }

    return { issues };
  });

  if (result.issues.length) {
    throw new Error(`${label} dialog issues:\n- ${result.issues.join("\n- ")}`);
  }
}

async function checkLedgerDateFields(page, label) {
  const result = await page.evaluate(() => {
    const issues = [];
    document.querySelectorAll(".expense-date-field").forEach((field, index) => {
      const text = field.querySelector("span");
      if (!(text instanceof HTMLElement)) return;
      const fieldRect = field.getBoundingClientRect();
      const textRect = text.getBoundingClientRect();
      const style = window.getComputedStyle(field);
      if (style.display === "none" || style.visibility === "hidden" || fieldRect.width <= 0 || fieldRect.height <= 0) return;
      if (text.scrollWidth > text.clientWidth + 1) {
        issues.push(`date field ${index + 1} text is clipped: ${text.scrollWidth}px > ${text.clientWidth}px`);
      }
      if (textRect.left < fieldRect.left - 1 || textRect.right > fieldRect.right + 1) {
        issues.push(`date field ${index + 1} text outside control`);
      }
    });
    return { issues };
  });

  if (result.issues.length) {
    throw new Error(`${label} date field issues:\n- ${result.issues.join("\n- ")}`);
  }
}

async function checkLedgerOptionalDetailsConcise(page, editor, label) {
  const result = await editor.locator(".expense-optional-panel").evaluate((panel) => {
    const issues = [];
    const body = panel.closest(".expense-editor")?.querySelector(".expense-editor-body");
    if (body instanceof HTMLElement) {
      body.scrollTop = body.scrollHeight;
    }

    const fields = panel.querySelector(".expense-optional-fields");
    const labels = Array.from(panel.querySelectorAll("label"))
      .map((item) => item.textContent?.trim().replace(/\s+/g, "") || "")
      .filter(Boolean);
    const panelRect = panel.getBoundingClientRect();
    const fieldsRect = fields instanceof HTMLElement ? fields.getBoundingClientRect() : null;

    if (labels.length !== 2 || !labels.some((item) => item.startsWith("商家")) || !labels.some((item) => item.startsWith("备注"))) {
      issues.push(`optional details should only expose merchant and note fields: ${labels.join(", ")}`);
    }
    if (fields instanceof HTMLElement && fields.scrollWidth > fields.clientWidth + 1) {
      issues.push(`optional details overflow horizontally: ${fields.scrollWidth}px > ${fields.clientWidth}px`);
    }
    if (fieldsRect && fieldsRect.bottom > window.innerHeight + 1) {
      issues.push(`optional details bottom is outside viewport: bottom=${Math.round(fieldsRect.bottom)}, viewport=${window.innerHeight}`);
    }
    if (panelRect.right > window.innerWidth + 1 || panelRect.left < -1) {
      issues.push(`optional details panel outside viewport: left=${Math.round(panelRect.left)}, right=${Math.round(panelRect.right)}`);
    }

    return { issues };
  });

  if (result.issues.length) {
    throw new Error(`${label} optional details issues:\n- ${result.issues.join("\n- ")}`);
  }
}

async function checkLedgerModalChrome(page, label) {
  const result = await page.evaluate(() => {
    const issues = [];
    const backdrop = document.querySelector(".ledger-form-backdrop");
    const sheet = document.querySelector(".ledger-form-sheet");
    if (!(backdrop instanceof HTMLElement) || !(sheet instanceof HTMLElement)) {
      issues.push("ledger modal is missing");
      return { issues };
    }

    const backdropStyle = window.getComputedStyle(backdrop);
    const sheetRect = sheet.getBoundingClientRect();
    const backdropRect = backdrop.getBoundingClientRect();

    if (backdropStyle.backgroundColor !== "rgba(0, 0, 0, 0)" && backdropStyle.backgroundColor !== "transparent") {
      issues.push(`ledger modal backdrop should be transparent: ${backdropStyle.backgroundColor}`);
    }
    if (sheetRect.height > backdropRect.height * 0.94) {
      issues.push(`ledger sheet is still stretched too tall: sheet=${Math.round(sheetRect.height)}, backdrop=${Math.round(backdropRect.height)}`);
    }

    return { issues };
  });

  if (result.issues.length) {
    throw new Error(`${label} modal chrome issues:\n- ${result.issues.join("\n- ")}`);
  }
}

async function exerciseMobileUpdateNotice(page) {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("xiaobao-mobile-update-notice", {
      detail: {
        message: "正在下载新版本 smoke",
        tone: "info",
        durationMs: 0,
        progress: null,
        progressMode: "indeterminate",
      },
    }));
  });
  const toast = page.locator(".system-weak-toast.with-progress").last();
  await toast.waitFor({ timeout: 5000 });
  const indeterminateText = (await toast.textContent()) ?? "";
  if (indeterminateText.includes("0%")) {
    throw new Error(`mobile update indeterminate progress should not render 0%: "${indeterminateText}"`);
  }
  if (!indeterminateText.includes("下载中")) {
    throw new Error(`mobile update indeterminate progress should show downloading state: "${indeterminateText}"`);
  }

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("xiaobao-mobile-update-notice", {
      detail: {
        message: "正在下载新版本 smoke",
        tone: "info",
        durationMs: 0,
        progress: 42,
        progressMode: "determinate",
      },
    }));
  });
  await page.waitForFunction(() => document.querySelector(".system-weak-percent")?.textContent?.includes("42%"));

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("xiaobao-mobile-update-notice", {
      detail: {
        message: "当前已是最新版本",
        tone: "success",
        durationMs: 20,
      },
    }));
  });
  await page.waitForTimeout(80);
  return { mobileUpdateNoticeChecked: true };
}

async function exerciseAlbumVideoFallback(page) {
  await page.getByRole("button", { name: "相册" }).last().click();
  await page.waitForSelector(".album-photo-thumb", { timeout: 5000 });
  const result = await page.evaluate(() => {
    const videoThumbs = Array.from(document.querySelectorAll(".album-photo-thumb video"));
    return {
      videoCount: videoThumbs.length,
      missingSrcCount: videoThumbs.filter((item) => !(item instanceof HTMLVideoElement) || !item.currentSrc && !item.getAttribute("src")).length,
    };
  });
  if (result.videoCount < 1) {
    throw new Error("album video fallback did not render a video thumbnail element");
  }
  if (result.missingSrcCount > 0) {
    throw new Error("album video fallback rendered without a video source");
  }
  return { albumVideoFallbackChecked: true };
}

async function exerciseChatExpenseShortcut(page, viewport) {
  await page.getByRole("button", { name: "聊天" }).last().click();
  await page.waitForTimeout(120);
  await page.getByRole("button", { name: "记账" }).click();
  const composer = page.locator(".composer textarea").first();
  await composer.waitFor({ timeout: 5000 });
  const value = await composer.inputValue();
  if (!value.includes("记一笔") || !value.includes("支出")) {
    throw new Error(`chat expense shortcut did not prefill ledger prompt: "${value}"`);
  }
  if (viewport.mobile) {
    await simulateKeyboardCycle(page, viewport, composer);
    await checkAppShellAligned(page, `${viewport.name} chat after keyboard`);
  }
  await composer.fill("");
  return { chatExpenseShortcutChecked: true };
}

async function exerciseGrowthMeasurementFlow(page, viewport) {
  if (authMode !== "mock") return null;

  await page.getByRole("button", { name: "记录" }).last().click();
  await page.waitForTimeout(120);
  // 成长 is now an independent overlay accessed from the 今日 card
  await page.getByRole("tab", { name: "今日" }).click();
  await page.waitForTimeout(80);
  const growthCardBtn = page.locator(".growth-entry-card-open");
  await growthCardBtn.waitFor({ timeout: 5000 });
  await growthCardBtn.click();
  await page.getByRole("heading", { name: "成长记录" }).waitFor({ timeout: 5000 });
  const seededMeasurementRow = page.locator(".growth-history li", { hasText: "66.5cm" }).first();
  await seededMeasurementRow.locator(".growth-history-value", { hasText: "66.5cm" }).waitFor({ timeout: 5000 });
  await seededMeasurementRow.getByRole("button", { name: "编辑" }).click();
  const editValueInput = page.locator(".growth-value-input input").first();
  await editValueInput.fill("67.1");
  await page.locator('.growth-entry-form input[type="text"]').fill("复查更新");
  await page.getByRole("button", { name: "保存修改" }).click();
  await page.locator(".growth-history li", { hasText: "67.1cm" }).filter({ hasText: "复查更新" }).first().waitFor({ timeout: 5000 });
  if (await page.locator(".growth-history li", { hasText: "66.5cm" }).filter({ hasText: "体检测量" }).count()) {
    throw new Error("growth measurement edit kept the old seeded history row unchanged");
  }

  const chartCount = await page.locator(".growth-chart").count();
  if (chartCount > 0) {
    throw new Error(`growth MVP should render a simple list, not reference charts; found ${chartCount} chart(s)`);
  }

  const valueInput = page.locator(".growth-value-input input").first();
  await valueInput.fill("999");
  await page.getByRole("button", { name: "记录一笔" }).click();
  await page.waitForTimeout(120);
  if (await page.getByText("999cm").count()) {
    throw new Error("growth measurement accepted an out-of-range height value");
  }

  await valueInput.fill("68.2");
  await page.locator('.growth-entry-form input[type="text"]').fill("家里复测");
  await page.getByRole("button", { name: "记录一笔" }).click();
  const addedMeasurementRow = page.locator(".growth-history li", { hasText: "68.2cm" }).filter({ hasText: "家里复测" }).first();
  await page.locator(".growth-history-value", { hasText: "68.2cm" }).first().waitFor({ timeout: 5000 });
  await page.getByText("家里复测").waitFor({ timeout: 5000 });
  await addedMeasurementRow.getByRole("button", { name: "删除" }).click();
  await page.waitForTimeout(120);
  if (await page.locator(".growth-history li", { hasText: "68.2cm" }).filter({ hasText: "家里复测" }).count()) {
    throw new Error("growth measurement delete did not remove the newly added history row");
  }

  if (viewport.mobile) {
    await checkAppShellAligned(page, `${viewport.name} growth measurement flow`);
  }

  // close the growth overlay before continuing
  await page.getByRole("button", { name: "返回" }).click();
  await page.waitForTimeout(120);

  return { growthMeasurementFlowChecked: true, growthMeasurementDeleteChecked: true };
}

async function simulateKeyboardCycle(page, viewport, field) {
  await field.scrollIntoViewIfNeeded();
  await page.waitForTimeout(80);
  await field.focus();
  await page.waitForTimeout(120);
  const keyboardInset = Math.min(340, Math.max(260, Math.round(viewport.height * 0.42)));
  await page.evaluate((inset) => {
    const host = window;
    if (!host.__smokeOriginalVisualViewport) host.__smokeOriginalVisualViewport = window.visualViewport;
    const original = host.__smokeOriginalVisualViewport;
    const syntheticViewport = new EventTarget();
    Object.defineProperties(syntheticViewport, {
      height: { get: () => Math.max(260, window.innerHeight - inset) },
      width: { get: () => window.innerWidth },
      offsetTop: { get: () => 0 },
      offsetLeft: { get: () => 0 },
      pageTop: { get: () => 0 },
      pageLeft: { get: () => 0 },
      scale: { get: () => original?.scale ?? 1 },
    });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: syntheticViewport });
    window.dispatchEvent(new Event("resize"));
  }, keyboardInset);
  await page.waitForTimeout(220);
  await checkElementVisibleInViewport(page, field, `${viewport.name} focused field while keyboard is open`);
  await checkElementAboveKeyboardOverlay(page, field, `${viewport.name} focused field while keyboard is open`);
  await field.evaluate((element) => element.blur());
  await page.evaluate(() => {
    const host = window;
    if (host.__smokeOriginalVisualViewport) {
      Object.defineProperty(window, "visualViewport", { configurable: true, value: host.__smokeOriginalVisualViewport });
    }
    window.dispatchEvent(new Event("resize"));
  });
  await page.waitForTimeout(650);
}

async function exerciseLedgerKeyboardFlow(page, viewport) {
  if (!viewport.mobile || authMode !== "mock") return null;

  await page.getByRole("button", { name: "账本" }).last().click();
  await page.waitForTimeout(160);
  if (await page.getByRole("button", { name: "智能记账" }).count()) {
    throw new Error("ledger page still exposes standalone smart ledger entry");
  }

  await page.getByRole("button", { name: /记一笔支出/ }).click();
  const editor = page.locator("form.expense-editor");
  await editor.waitFor({ timeout: 5000 });
  await checkMobileTabbarVisible(page, `${viewport.name} expense editor open`);
  await checkLedgerDateFields(page, `${viewport.name} expense editor`);
  await checkLedgerModalChrome(page, `${viewport.name} expense editor`);
  await editor.locator(".expense-optional-panel summary").click();
  await checkLedgerOptionalDetailsConcise(page, editor, `${viewport.name} expense editor`);
  await simulateKeyboardCycle(page, viewport, editor.locator("input").first());
  await checkAppShellAligned(page, `${viewport.name} expense editor after keyboard`);
  await editor.getByRole("button", { name: "关闭" }).click();
  await page.waitForTimeout(180);
  await checkAppShellAligned(page, `${viewport.name} ledger after closing expense editor`);

  return { ledgerManualEntryChecked: true };
}

async function exerciseReminderFlow(page, viewport) {
  if (authMode !== "mock") return null;

  await page.getByRole("button", { name: "提醒" }).last().click();
  await page.waitForTimeout(160);

  await page.getByRole("button", { name: /延后提醒 体检疫苗/ }).click();
  const postponeDialog = page.getByRole("dialog", { name: "延后到什么时候？" });
  await postponeDialog.waitFor({ timeout: 5000 });
  if (viewport.mobile) {
    await checkMobileTabbarVisible(page, `${viewport.name} postpone reminder dialog open`);
    await checkDialogNotBlocked(page, postponeDialog, `${viewport.name} postpone reminder dialog`);
  }
  const future = futureDateTimeParts(120);
  await postponeDialog.locator('input[type="date"]').fill(future.date);
  await postponeDialog.locator('input[type="time"]').fill(future.time);
  await postponeDialog.getByRole("button", { name: /确认延后/ }).click();
  await postponeDialog.waitFor({ state: "hidden", timeout: 5000 });

  await page.getByRole("button", { name: /标记完成 体检疫苗/ }).click();
  const completeDialog = page.getByRole("dialog", { name: /确认已经完成了吗|关闭本次提醒吗/ });
  await completeDialog.waitFor({ timeout: 5000 });
  if (viewport.mobile) {
    await checkMobileTabbarVisible(page, `${viewport.name} complete reminder dialog open`);
    await checkDialogNotBlocked(page, completeDialog, `${viewport.name} complete reminder dialog`);
  }
  await completeDialog.getByRole("button", { name: /先不完成/ }).click();
  await completeDialog.waitFor({ state: "hidden", timeout: 5000 });
  await page.getByRole("button", { name: /标记完成 体检疫苗/ }).waitFor({ timeout: 5000 });
  if (await page.locator(".reminder-group-done .reminder-item", { hasText: "体检疫苗" }).count()) {
    throw new Error("cancelling reminder completion unexpectedly moved 体检疫苗 to done");
  }

  await page.getByRole("button", { name: /删除提醒 体检疫苗/ }).click();
  const deleteDialog = page.getByRole("dialog", { name: "确定不再提醒吗？" });
  await deleteDialog.waitFor({ timeout: 5000 });
  if (viewport.mobile) {
    await checkMobileTabbarVisible(page, `${viewport.name} delete reminder dialog open`);
    await checkDialogNotBlocked(page, deleteDialog, `${viewport.name} delete reminder dialog`);
  }
  await deleteDialog.getByRole("button", { name: /先保留/ }).click();
  await deleteDialog.waitFor({ state: "hidden", timeout: 5000 });
  await page.getByRole("button", { name: /删除提醒 体检疫苗/ }).waitFor({ timeout: 5000 });

  await page.getByRole("button", { name: /标记完成 体检疫苗/ }).click();
  await completeDialog.waitFor({ timeout: 5000 });
  await completeDialog.getByRole("button", { name: /确认完成/ }).click();
  await completeDialog.waitFor({ state: "hidden", timeout: 5000 });
  await page.locator(".reminder-group-done .reminder-item", { hasText: "体检疫苗" }).first().waitFor({ timeout: 5000 });
  if (await page.getByRole("button", { name: /标记完成 体检疫苗/ }).count()) {
    throw new Error("confirming reminder completion left 体检疫苗 in an actionable reminder bucket");
  }

  await page.getByRole("button", { name: /删除提醒 晚间洗澡/ }).click();
  await deleteDialog.waitFor({ timeout: 5000 });
  await deleteDialog.getByRole("button", { name: /先保留/ }).click();
  await deleteDialog.waitFor({ state: "hidden", timeout: 5000 });
  await page.getByRole("button", { name: /删除提醒 晚间洗澡/ }).waitFor({ timeout: 5000 });

  await page.getByRole("button", { name: /删除提醒 晚间洗澡/ }).click();
  await deleteDialog.waitFor({ timeout: 5000 });
  await deleteDialog.getByRole("button", { name: "删除" }).click();
  await deleteDialog.waitFor({ state: "hidden", timeout: 5000 });
  await page.locator(".reminder-item", { hasText: "晚间洗澡" }).waitFor({ state: "detached", timeout: 5000 });

  await page.getByRole("button", { name: /新建/ }).click();
  const editor = page.getByRole("dialog", { name: "新建提醒" });
  await editor.waitFor({ timeout: 5000 });
  if (viewport.mobile) {
    await checkMobileTabbarVisible(page, `${viewport.name} reminder editor open`);
    await checkDialogNotBlocked(page, editor, `${viewport.name} reminder editor`);
    await simulateKeyboardCycle(page, viewport, editor.locator("input").first());
    await checkAppShellAligned(page, `${viewport.name} reminder editor after keyboard`);
  }
  await editor.getByRole("button", { name: "关闭" }).click();
  await page.waitForTimeout(180);

  return { reminderConfirmFlowChecked: true };
}

async function exerciseAppShell(page, viewport) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("main.app-shell", { timeout: 15000 });

  if (authMode !== "mock") {
    await page.waitForSelector(".auth-panel", { timeout: 15000 });
    return { mode: "unauthenticated", tabsChecked: [] };
  }

  await page.waitForSelector("nav.mobile-tabbar", { timeout: 15000 });
  const mobileUpdateNotice = await exerciseMobileUpdateNotice(page);
  const checkedTabs = [];
  for (const label of tabLabels) {
    const tab = page.getByRole("button", { name: label }).last();
    await tab.click({ timeout: 5000 });
    await page.waitForTimeout(120);
    if (label === "提醒") {
      await page.getByText("未来安排").waitFor({ timeout: 5000 });
      await page.locator(".reminder-group-upcoming .reminder-item", { hasText: "体检疫苗" }).first().waitFor({ timeout: 5000 });
      await page.getByText(/未完成待办/).waitFor({ timeout: 5000 });
    }
    checkedTabs.push(label);
  }

  const albumVideoFallback = await exerciseAlbumVideoFallback(page);
  const chatExpenseShortcut = await exerciseChatExpenseShortcut(page, viewport);
  const growthMeasurementFlow = await exerciseGrowthMeasurementFlow(page, viewport);
  const ledgerKeyboard = await exerciseLedgerKeyboardFlow(page, viewport);
  const reminderFlow = await exerciseReminderFlow(page, viewport);

  if (viewport.mobile) {
    await page.getByRole("button", { name: "聊天" }).last().click();
    await page.waitForTimeout(120);
  }

  return { mode: "authenticated", tabsChecked: checkedTabs, mobileUpdateNotice, albumVideoFallback, chatExpenseShortcut, growthMeasurementFlow, ledgerKeyboard, reminderFlow };
}

async function runViewport(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.mobile ? 2 : 1,
    isMobile: viewport.mobile,
    hasTouch: viewport.mobile,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await installApiMocks(page);
  const flow = await exerciseAppShell(page, viewport);
  const layout = await checkLayout(page, viewport.name);
  const screenshotPath = path.join(artifactDir, `${viewport.name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  await context.close();

  if (pageErrors.length || consoleErrors.length) {
    throw new Error(
      `${viewport.name} runtime issues:\n${[...pageErrors, ...consoleErrors].map((item) => `- ${item}`).join("\n")}`,
    );
  }

  return {
    viewport: viewport.name,
    size: `${viewport.width}x${viewport.height}`,
    flow,
    layout,
    screenshot: path.relative(rootDir, screenshotPath),
  };
}

async function main() {
  await mkdir(artifactDir, { recursive: true });
  const preview = startPreview();
  const results = [];

  try {
    await waitForServer(preview);
    const browser = await chromium.launch({ headless: true });
    try {
      for (const viewport of viewports) {
        results.push(await runViewport(browser, viewport));
      }
    } finally {
      await browser.close();
    }

    const report = {
      generatedAt: new Date().toISOString(),
      baseUrl,
      authMode,
      viewports: results,
    };
    await writeFile(path.join(artifactDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    await writeFile(
      path.join(artifactDir, "summary.md"),
      [
        "# Frontend Smoke Summary",
        "",
        `- Base URL: ${baseUrl}`,
        `- Auth mode: ${authMode}`,
        ...results.map((item) => `- ${item.viewport} (${item.size}): ${item.flow.mode}, screenshot ${item.screenshot}`),
        "",
      ].join("\n"),
    );

    console.log("Frontend smoke passed.");
    results.forEach((item) => {
      const tabs = item.flow.tabsChecked.length ? ` tabs: ${item.flow.tabsChecked.join(", ")}` : "";
      console.log(`- ${item.viewport} ${item.size}:${tabs}; screenshot ${item.screenshot}`);
    });
  } finally {
    await preview.stop();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
