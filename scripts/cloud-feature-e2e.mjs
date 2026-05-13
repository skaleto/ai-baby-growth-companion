#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const envFile = path.resolve(rootDir, process.env.E2E_ENV_FILE || "scripts/cloud-feature-e2e.env.local");
loadEnvFile(envFile);
const apiBaseUrl = trimTrailingSlash(process.env.E2E_API_BASE_URL || "http://120.55.188.242:8300");
const host = process.env.E2E_FRONTEND_HOST || "localhost";
const port = Number(process.env.E2E_FRONTEND_PORT || 5173);
const baseUrl = `http://${host}:${port}`;
const artifactDir = path.resolve(rootDir, process.env.E2E_ARTIFACT_DIR || ".verification/cloud-feature-e2e");
const reportPath = path.resolve(rootDir, "docs/automation-test-results.md");
const runId = process.env.E2E_RUN_ID || new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const testPrefix = `自动化E2E-${runId}`;
const caregiverPhone = process.env.E2E_CAREGIVER_PHONE || "";
const caregiverInvite = process.env.E2E_CAREGIVER_INVITE || "";
const allowCaregiverOnboarding = process.env.E2E_ALLOW_CAREGIVER_ONBOARDING === "1";
const caregiverRole = process.env.E2E_CAREGIVER_ROLE || "";
const caregiverIsCaregiver = parseEnvBoolean(process.env.E2E_CAREGIVER_IS_CAREGIVER);
const viewerPhone = process.env.E2E_VIEWER_PHONE || "";
const viewerInvite = process.env.E2E_VIEWER_INVITE || "";
const allowViewerOnboarding = process.env.E2E_ALLOW_VIEWER_ONBOARDING === "1";
const viewerRole = process.env.E2E_VIEWER_ROLE || "";
const viewerIsCaregiver = parseEnvBoolean(process.env.E2E_VIEWER_IS_CAREGIVER);
const runAgent = process.env.E2E_RUN_AGENT !== "0";

const viewports = [
  { name: "iphone-se-375x667", width: 375, height: 667 },
  { name: "iphone-13-390x844", width: 390, height: 844 },
  { name: "iphone-pro-max-430x932", width: 430, height: 932 },
  { name: "android-compact-360x800", width: 360, height: 800 },
  { name: "android-pixel-412x915", width: 412, height: 915 },
  { name: "android-large-432x960", width: 432, height: 960 },
];

const tabs = ["聊天", "记录", "账本", "相册", "提醒", "我的"];
const created = {
  expenses: new Set(),
  reminders: new Set(),
  messages: new Set(),
};
const cleanupNotes = [];

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, "utf8");
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) return;
    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  });
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function maskPhone(phone) {
  if (!phone) return "";
  return phone.replace(/^(\d{3})\d{4}(\d+)$/, "$1****$2");
}

function maskSecret(value) {
  if (!value) return "";
  if (value.length <= 3) return "***";
  return `${value.slice(0, 1)}***${value.slice(-1)}`;
}

function parseEnvBoolean(value) {
  if (value === undefined || value === "") return undefined;
  if (["1", "true", "TRUE", "yes", "YES"].includes(value)) return true;
  if (["0", "false", "FALSE", "no", "NO"].includes(value)) return false;
  throw new Error(`Invalid boolean env value: ${value}`);
}

function todayDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
}

function e2eError(message) {
  const error = new Error(message);
  error.name = "E2EError";
  return error;
}

function missingCredentialMessage() {
  return [
    "云端健康 ok；但缺少 E2E_CAREGIVER_PHONE/E2E_CAREGIVER_INVITE，无法继续真实登录测试。",
    "",
    "下一步：",
    "  cp scripts/cloud-feature-e2e.env.example scripts/cloud-feature-e2e.env.local",
    "  # 填入 E2E_CAREGIVER_PHONE 和 E2E_CAREGIVER_INVITE 后重跑：",
    "  npm run test:cloud-e2e",
  ].join("\n");
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!response.ok) {
    const message = body && typeof body === "object" && "message" in body ? body.message : text || response.statusText;
    throw e2eError(`${response.status} ${message}`);
  }
  return body;
}

async function healthCheck() {
  const response = await fetch(`${apiBaseUrl}/api/health`);
  const text = await response.text();
  if (!response.ok || text.trim() !== "ok") {
    throw e2eError(`云端健康检查失败：${response.status} ${text}`);
  }
  return text.trim();
}

async function inviteRoles(inviteCode, phone) {
  const params = new URLSearchParams({ inviteCode });
  if (phone) params.set("phone", phone);
  return requestJson(`${apiBaseUrl}/api/auth/invite/roles?${params.toString()}`);
}

async function loginApi(phone, inviteCode, roleName, caregiver) {
  const payload = { phone, inviteCode };
  if (roleName !== undefined) payload.roleName = roleName;
  if (caregiver !== undefined) payload.caregiver = caregiver;
  return requestJson(`${apiBaseUrl}/api/auth/login`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function apiState(token) {
  return requestJson(`${apiBaseUrl}/api/app/state`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function deleteRecord(token, collection, id) {
  const response = await fetch(`${apiBaseUrl}/api/app/state/${collection}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw e2eError(`清理 ${collection}/${id} 失败：${response.status} ${text}`);
  }
}

async function putRecord(token, collection, id, item) {
  const response = await fetch(`${apiBaseUrl}/api/app/state/${collection}/${encodeURIComponent(id)}?mode=replace`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(item),
  });
  const text = await response.text();
  if (!response.ok) {
    throw e2eError(`${response.status} ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

function startVite() {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const child = spawn(npx, ["vite", "--host", host, "--port", String(port), "--strictPort"], {
    cwd: rootDir,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      BROWSER: "none",
      VITE_AGENT_API_BASE_URL: apiBaseUrl,
    },
  });
  const logs = [];
  child.stdout.on("data", (chunk) => logs.push(chunk.toString()));
  child.stderr.on("data", (chunk) => logs.push(chunk.toString()));
  return {
    child,
    logs,
    stop: () =>
      new Promise((resolve) => {
        if (child.exitCode !== null) return resolve();
        child.once("exit", resolve);
        child.kill("SIGTERM");
        setTimeout(() => {
          if (child.exitCode === null) child.kill("SIGKILL");
        }, 3000).unref();
      }),
  };
}

async function waitForFrontend(server, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    if (server.child.exitCode !== null) {
      throw e2eError(`Vite 已退出：\n${server.logs.join("")}`);
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
  throw e2eError(`等待前端启动超时：${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function expectNoOverflow(page, label) {
  const result = await page.evaluate(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const root = document.documentElement;
    const body = document.body;
    const issues = [];
    if (Math.max(root.scrollWidth, body.scrollWidth) > width + 1) {
      issues.push(`页面横向溢出：${Math.max(root.scrollWidth, body.scrollWidth)}px > ${width}px`);
    }
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < height;
    };
    const offenders = Array.from(document.querySelectorAll("main,section,form,nav,button,input,textarea,[role='dialog']"))
      .filter(visible)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const label =
          element.getAttribute("aria-label") ||
          element.getAttribute("title") ||
          element.getAttribute("class") ||
          element.textContent?.trim().slice(0, 24) ||
          element.tagName.toLowerCase();
        return { label, left: rect.left, right: rect.right, width: rect.width };
      })
      .filter((item) => item.left < -2 || item.right > width + 2 || item.width > width + 2)
      .slice(0, 8);
    offenders.forEach((item) => {
      issues.push(`${item.label}: left=${Math.round(item.left)}, right=${Math.round(item.right)}, width=${Math.round(item.width)}`);
    });
    return { issues };
  });
  if (result.issues.length) throw e2eError(`${label} 布局问题：\n- ${result.issues.join("\n- ")}`);
}

async function expectElementUncovered(locator, label) {
  const result = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + Math.min(rect.height / 2, 120);
    const topElement = document.elementFromPoint(x, y);
    return {
      ok: Boolean(topElement && element.contains(topElement)),
      x: Math.round(x),
      y: Math.round(y),
      topClass: topElement?.getAttribute("class") ?? topElement?.tagName ?? "",
      rect: {
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
      },
    };
  });
  if (!result.ok) {
    throw e2eError(`${label} 被其他元素覆盖：point=(${result.x},${result.y}) top=${result.topClass} rect=${JSON.stringify(result.rect)}`);
  }
}

async function loginUi(page, phone, inviteCode) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".auth-panel", { timeout: 15000 });
  await page.locator(".auth-form input").nth(0).fill(phone);
  await page.locator(".auth-form input").nth(1).fill(inviteCode);
  await page.getByText("已识别家庭身份").waitFor({ timeout: 10000 });
  const joinOptions = await page.getByLabel("加入家庭身份设置").count();
  if (joinOptions > 0) throw e2eError("已注册用户登录页仍展示角色/照护人选择");
  await page.getByRole("button", { name: "登录" }).click();
  await completeOnboardingIfNeeded(page);
  await page.waitForSelector("nav.mobile-tabbar", { timeout: 20000 });
}

async function completeOnboardingIfNeeded(page) {
  await page.waitForFunction(
    () => Boolean(document.querySelector("nav.mobile-tabbar")) || document.body.innerText.includes("先认识一下小宝"),
    null,
    { timeout: 20000 },
  );
  if (await page.locator("nav.mobile-tabbar").isVisible().catch(() => false)) return;
  await page.getByRole("heading", { name: "先认识一下小宝" }).waitFor({ timeout: 5000 });

  await page.getByLabel("小宝昵称").fill(`自动化宝宝${runId.slice(-4)}`);
  await page.locator(".onboarding-form input[type='date']").fill("2026-01-18");
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "完成设置" }).click();
}

async function gotoTab(page, label) {
  await page.getByRole("button", { name: label }).last().click();
  await page.waitForTimeout(250);
  await resetHorizontalScroll(page);
}

async function clickTabButton(page, label) {
  await page.getByRole("tab", { name: label }).click();
  await page.waitForTimeout(160);
  await resetHorizontalScroll(page);
}

async function resetHorizontalScroll(page) {
  await page.evaluate(() => {
    window.scrollTo(0, window.scrollY);
    document.documentElement.scrollLeft = 0;
    document.body.scrollLeft = 0;
    document.querySelectorAll("html, body, #root, .app-shell, .workspace, .records-screen, .ledger-screen, .album-screen, .reminders-screen, .profile-screen").forEach((element) => {
      element.scrollLeft = 0;
    });
  });
}

async function runLayoutMatrix(browser, storageStatePath) {
  const screenshots = [];
  for (const viewport of viewports) {
    const context = await browser.newContext({
      storageState: storageStatePath,
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("nav.mobile-tabbar", { timeout: 20000 });
    for (const tab of tabs) {
      const count = await page.getByRole("button", { name: tab }).count();
      if (count === 0 && tab === "聊天") continue;
      await gotoTab(page, tab);
      await expectNoOverflow(page, `${viewport.name}/${tab}`);
    }
    if (errors.length) throw e2eError(`${viewport.name} 控制台错误：\n- ${errors.join("\n- ")}`);
    const screenshot = path.join(artifactDir, `layout-${viewport.name}.png`);
    await page.screenshot({ path: screenshot, fullPage: false });
    screenshots.push(path.relative(rootDir, screenshot));
    await context.close();
  }
  return { screenshots };
}

async function ledgerCrud(page, token) {
  const title = `${testPrefix}-奶粉`;
  await gotoTab(page, "账本");
  await page.getByRole("button", { name: /记一笔支出/ }).click();
  const editor = page.locator("form.expense-editor");
  await editor.waitFor({ timeout: 8000 });
  await page.waitForTimeout(220);
  if (!(await page.locator("nav.mobile-tabbar").isVisible().catch(() => false))) {
    throw e2eError("账本支出弹层打开后底部 Tab 不应消失");
  }
  const editorBox = await editor.boundingBox();
  const tabbarBox = await page.locator("nav.mobile-tabbar").boundingBox();
  if (!editorBox || !tabbarBox) throw e2eError("无法读取账本支出弹层或底部 Tab 的位置");
  if (editorBox.y < 6) throw e2eError(`账本支出弹层顶部疑似被截断：top=${Math.round(editorBox.y)}px`);
  if (editorBox.y + editorBox.height > tabbarBox.y - 2) {
    throw e2eError(`账本支出弹层底部压到 Tab：sheetBottom=${Math.round(editorBox.y + editorBox.height)}px tabTop=${Math.round(tabbarBox.y)}px`);
  }
  await expectElementUncovered(editor, "账本支出弹层");
  await editor.locator("details.expense-optional-panel summary").click();
  await editor.getByLabel("商家").waitFor({ timeout: 5000 });
  await page.waitForTimeout(260);
  if (!(await editor.getByLabel("商家").isVisible().catch(() => false))) {
    throw e2eError("账本补充说明展开后商家字段不可见");
  }
  const spacing = await editor.evaluate((element) => {
    const optional = element.querySelector(".expense-optional-panel");
    const actions = element.querySelector(".story-modal-actions");
    const textarea = element.querySelector("textarea");
    if (!optional || !actions || !textarea) return null;
    const optionalRect = optional.getBoundingClientRect();
    const actionsRect = actions.getBoundingClientRect();
    const textareaRect = textarea.getBoundingClientRect();
    return {
      gapToActions: Math.round(actionsRect.top - optionalRect.bottom),
      textareaBottomGap: Math.round(actionsRect.top - textareaRect.bottom),
    };
  });
  if (!spacing || spacing.gapToActions < 6 || spacing.textareaBottomGap < 14) {
    throw e2eError(`账本补充说明和底部操作区间距不足：${JSON.stringify(spacing)}`);
  }
  const keyboardLayout = await editor.evaluate((element) => {
    document.body.classList.add("keyboard-open");
    document.documentElement.style.setProperty("--keyboard-inset", "320px");
    const sheetRect = element.getBoundingClientRect();
    const actionsRect = element.querySelector(".story-modal-actions")?.getBoundingClientRect();
    const bodyRect = element.querySelector(".expense-editor-body")?.getBoundingClientRect();
    document.body.classList.remove("keyboard-open");
    document.documentElement.style.removeProperty("--keyboard-inset");
    return {
      sheetTop: Math.round(sheetRect.top),
      sheetBottom: Math.round(sheetRect.bottom),
      actionsBottom: actionsRect ? Math.round(actionsRect.bottom) : null,
      bodyBottom: bodyRect ? Math.round(bodyRect.bottom) : null,
      viewportHeight: window.innerHeight,
    };
  });
  if (keyboardLayout.actionsBottom === null || keyboardLayout.bodyBottom === null || keyboardLayout.actionsBottom > keyboardLayout.viewportHeight - 4) {
    throw e2eError(`账本键盘态布局不安全：${JSON.stringify(keyboardLayout)}`);
  }
  await editor.getByLabel("商品名或用途").fill(title);
  await editor.getByLabel("金额").fill("12.34");
  await editor.getByLabel("商家").fill("自动化母婴店");
  await editor.getByLabel("备注").fill("自动化备注");
  await editor.getByRole("button", { name: /保存/ }).click();
  await page.getByText(title).waitFor({ timeout: 12000 });
  const stateAfterCreate = await apiState(token);
  const createdExpense = stateAfterCreate.state?.expenses?.find((item) => item.title === title);
  if (createdExpense) created.expenses.add(createdExpense.id);
  await clickTabButton(page, "明细");
  const item = page.locator(".expense-item", { hasText: title }).first();
  await item.getByTitle("编辑支出").click();
  await editor.waitFor({ timeout: 8000 });
  await editor.getByLabel("金额").fill("23.45");
  await editor.getByRole("button", { name: /保存/ }).click();
  await page.locator(".expense-item", { hasText: title }).first().getByText("¥23.45").waitFor({ timeout: 12000 });
  const stateAfterEdit = await apiState(token);
  const expense = stateAfterEdit.state?.expenses?.find((item) => item.title === title);
  if (!expense) throw e2eError("账本新增/编辑后云端状态中未找到支出");
  created.expenses.add(expense.id);
  await page.locator(".expense-item", { hasText: title }).first().getByTitle("删除支出").click();
  const keepExpenseDialog = page.getByRole("dialog", { name: /确定删除这笔支出吗/ });
  await keepExpenseDialog.waitFor({ timeout: 8000 });
  await expectElementUncovered(keepExpenseDialog, "支出删除确认弹窗");
  await keepExpenseDialog.getByRole("button", { name: "先保留" }).click();
  await page.getByText(title).waitFor({ timeout: 5000 });
  await page.locator(".expense-item", { hasText: title }).first().getByTitle("删除支出").click();
  const deleteExpenseDialog = page.getByRole("dialog", { name: /确定删除这笔支出吗/ });
  await deleteExpenseDialog.waitFor({ timeout: 8000 });
  await expectElementUncovered(deleteExpenseDialog, "支出删除确认弹窗");
  await deleteExpenseDialog.getByRole("button", { name: "删除", exact: true }).click();
  await expectGoneFromState(token, "expenses", title);
  created.expenses.delete(expense.id);
  return { title, editedAmount: 23.45 };
}

async function reminderCrud(page, token) {
  const completeTitle = `${testPrefix}-完成提醒`;
  const deleteTitle = `${testPrefix}-删除提醒`;
  await gotoTab(page, "提醒");
  await createReminder(page, completeTitle);
  const completeReminder = await waitForStateItem(token, "reminders", completeTitle, "云端状态中未找到新建提醒");
  created.reminders.add(completeReminder.id);
  await page.locator(".reminder-item", { hasText: completeTitle }).first().getByTitle("标记完成").click();
  const keepCompleteDialog = page.getByRole("dialog", { name: /确认已经完成了吗|关闭本次提醒吗/ });
  await keepCompleteDialog.waitFor({ timeout: 8000 });
  await keepCompleteDialog.getByRole("button", { name: "先不完成" }).click();
  await page.locator(".reminder-item", { hasText: completeTitle }).first().getByTitle("标记完成").click();
  const completeDialog = page.getByRole("dialog", { name: /确认已经完成了吗|关闭本次提醒吗/ });
  await completeDialog.getByRole("button", { name: /确认完成/ }).click();
  await page.locator(".reminder-group-done", { hasText: completeTitle }).waitFor({ timeout: 12000 });

  await createReminder(page, deleteTitle);
  const deleteReminder = await waitForStateItem(token, "reminders", deleteTitle, "云端状态中未找到待删除提醒");
  created.reminders.add(deleteReminder.id);
  await page.locator(".reminder-item", { hasText: deleteTitle }).first().getByTitle("删除提醒").click();
  const keepReminderDialog = page.getByRole("dialog", { name: /确定不再提醒吗/ });
  await keepReminderDialog.waitFor({ timeout: 8000 });
  await keepReminderDialog.getByRole("button", { name: "先保留" }).click();
  await page.locator(".reminder-item", { hasText: deleteTitle }).first().waitFor({ timeout: 5000 });
  await page.locator(".reminder-item", { hasText: deleteTitle }).first().getByTitle("删除提醒").click();
  const deleteReminderDialog = page.getByRole("dialog", { name: /确定不再提醒吗/ });
  await deleteReminderDialog.getByRole("button", { name: "删除", exact: true }).click();
  await expectGoneFromState(token, "reminders", deleteTitle);
  created.reminders.delete(deleteReminder.id);
  return { completed: completeTitle, deleted: deleteTitle };
}

async function createReminder(page, title) {
  await page.getByRole("button", { name: "新建" }).click();
  const editor = page.locator("form.reminder-editor");
  await editor.waitFor({ timeout: 8000 });
  await editor.getByLabel("提醒标题").fill(title);
  await editor.locator("input[type='date']").fill(todayDate());
  await editor.locator("input[type='time']").fill("00:01");
  await editor.getByRole("button", { name: /保存/ }).click();
  await page.locator(".reminder-item", { hasText: title }).first().waitFor({ timeout: 12000 });
}

async function recordsViews(page) {
  await gotoTab(page, "记录");
  await page.getByRole("heading", { name: /今天的总览|年|月|日/ }).waitFor({ timeout: 8000 });
  await clickTabButton(page, "趋势");
  await page.getByText(/近 7 天|近7天/).first().waitFor({ timeout: 8000 });
  await clickTabButton(page, "日历");
  await page.locator(".calendar-grid, .record-calendar").first().waitFor({ timeout: 8000 });
  await expectNoOverflow(page, "记录三视图");
  return { views: ["今日", "趋势", "日历"] };
}

async function albumViews(page) {
  await gotoTab(page, "相册");
  await page.getByRole("tab", { name: "全部" }).waitFor({ timeout: 8000 });
  const categories = ["成长", "喂养", "健康"];
  for (const category of categories) {
    const tab = page.getByRole("tab", { name: category });
    if (await tab.count()) await tab.click();
  }
  await page.getByRole("tab", { name: "全部" }).click();
  const previewButtons = await page.locator(".album-photo-thumb").count();
  if (previewButtons > 0) {
    await page.locator(".album-photo-thumb").first().click();
    await page.getByRole("dialog", { name: "附件预览" }).waitFor({ timeout: 8000 });
    await page.keyboard.press("Escape").catch(() => undefined);
    const close = page.getByRole("button", { name: /关闭|返回/ }).first();
    if (await close.count()) await close.click().catch(() => undefined);
  } else {
    await page.getByText(/还没有这个分类的回忆|素材/).first().waitFor({ timeout: 8000 });
  }
  await expectNoOverflow(page, "相册分类");
  return { previewItems: previewButtons };
}

async function profileView(page) {
  await gotoTab(page, "我的");
  await page.getByText("我的身份").waitFor({ timeout: 8000 });
  await page.getByText("家庭照护人").waitFor({ timeout: 8000 });
  await page.getByText(apiBaseUrl).waitFor({ timeout: 8000 });
  await expectNoOverflow(page, "我的页");
  return { backend: apiBaseUrl };
}

async function chatLive(page, token) {
  const text = `${testPrefix} 连通性检查，请只回复一句已收到，不要写记录。`;
  await gotoTab(page, "聊天");
  const aiMessageCountBefore = await page.locator(".message.ai").count();
  await page.locator(".composer textarea").fill(text);
  await page.locator(".send-button").click();
  await page.getByText(text).waitFor({ timeout: 8000 });
  await page.waitForFunction(
    (countBefore) => document.querySelectorAll(".message.ai").length > countBefore,
    aiMessageCountBefore,
    { timeout: 60000 },
  );
  const latestAiText = await page.locator(".message.ai").last().innerText();
  if (latestAiText.includes("AI 服务暂时不可用")) throw e2eError("Agent 返回不可用错误");
  await sleep(1000);
  const state = await apiState(token);
  const matched = state.state?.messages?.filter((message) => message.text?.includes(testPrefix)) || [];
  matched.forEach((message) => created.messages.add(message.id));
  const failed = matched.some((message) => message.text?.includes("AI 服务暂时不可用"));
  if (failed) throw e2eError("Agent 返回不可用错误");
  return { messages: matched.length };
}

async function viewerPermissionCheck(browser) {
  if (!viewerPhone || !viewerInvite) {
    return { skipped: true, reason: "未配置 E2E_VIEWER_PHONE/E2E_VIEWER_INVITE" };
  }
  const rolePreview = await inviteRoles(viewerInvite, viewerPhone);
  let viewer;
  if (!rolePreview.existingMember) {
    if (!allowViewerOnboarding) {
      throw e2eError("只读测试账号未加入家庭。如需用新测试手机号验证只读权限，请配置 E2E_ALLOW_VIEWER_ONBOARDING=1、E2E_VIEWER_ROLE 和 E2E_VIEWER_IS_CAREGIVER=false。");
    }
    if (!viewerRole || viewerIsCaregiver !== false) {
      throw e2eError("新只读测试手机号入家必须显式配置 E2E_VIEWER_ROLE 和 E2E_VIEWER_IS_CAREGIVER=false。");
    }
    if (rolePreview.occupiedRoles?.includes?.(viewerRole)) {
      throw e2eError(`测试家庭中角色「${viewerRole}」已被占用，请换一个可用角色。`);
    }
    viewer = await loginApi(viewerPhone, viewerInvite, viewerRole, false);
  } else {
    viewer = await loginApi(viewerPhone, viewerInvite);
  }
  if (viewer.member?.caregiver) throw e2eError("只读测试账号实际是照护人，无法验证只读权限");
  const denied = await fetch(`${apiBaseUrl}/api/app/state/expenses/${encodeURIComponent(`${testPrefix}-viewer-deny`)}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${viewer.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      id: `${testPrefix}-viewer-deny`,
      title: `${testPrefix}-只读写入`,
      amount: 1,
      currency: "CNY",
      category: "other",
      date: todayDate(),
      attachmentIds: [],
      source: "manual",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
  });
  if (denied.status !== 403) throw e2eError(`只读写接口期望 403，实际 ${denied.status}`);
  const viewerContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const viewerPage = await viewerContext.newPage();
  try {
    await loginUi(viewerPage, viewerPhone, viewerInvite);
    if (await viewerPage.locator("nav.mobile-tabbar button", { hasText: "聊天" }).count()) throw e2eError("只读账号不应展示聊天入口");
    await gotoTab(viewerPage, "记录");
    await viewerPage.locator(".records-screen").waitFor({ timeout: 8000 });
    await gotoTab(viewerPage, "账本");
    const visibleLedgerCreate = await viewerPage.getByRole("button", { name: /记一笔支出/ }).first().isVisible().catch(() => false);
    if (visibleLedgerCreate) throw e2eError("只读账号不应展示账本新增入口");
  } finally {
    await viewerContext.close();
  }
  return { viewer: maskPhone(viewerPhone), writeStatus: denied.status };
}

async function expectGoneFromState(token, collection, title) {
  await pageWait(async () => {
    const state = await apiState(token);
    const items = state.state?.[collection] || [];
    return !items.some((item) => item.title === title);
  }, `${collection} 中仍存在 ${title}`, 10000);
}

async function waitForStateItem(token, collection, title, message, timeoutMs = 12000) {
  let matched = null;
  await pageWait(async () => {
    const state = await apiState(token);
    matched = state.state?.[collection]?.find((item) => item.title === title) || null;
    return Boolean(matched);
  }, message, timeoutMs);
  return matched;
}

async function pageWait(predicate, message, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await sleep(500);
  }
  throw e2eError(message);
}

async function cleanup(token) {
  for (const id of created.expenses) {
    try {
      await deleteRecord(token, "expenses", id);
      cleanupNotes.push(`已清理支出 ${id}`);
    } catch (error) {
      cleanupNotes.push(error instanceof Error ? error.message : String(error));
    }
  }
  for (const id of created.reminders) {
    try {
      await deleteRecord(token, "reminders", id);
      cleanupNotes.push(`已清理提醒 ${id}`);
    } catch (error) {
      cleanupNotes.push(error instanceof Error ? error.message : String(error));
    }
  }
  for (const id of created.messages) {
    try {
      await deleteRecord(token, "messages", id);
      cleanupNotes.push(`已清理消息 ${id}`);
    } catch (error) {
      cleanupNotes.push(error instanceof Error ? error.message : String(error));
    }
  }
}

function makeCase(id, priority, feature, exitCriteria, run) {
  return { id, priority, feature, exitCriteria, run };
}

async function runCase(results, definition, context) {
  const startedAt = new Date();
  try {
    const details = await definition.run(context);
    results.push({
      ...definition,
      status: details?.skipped ? "skipped" : "passed",
      durationMs: Date.now() - startedAt.getTime(),
      details,
    });
  } catch (error) {
    const screenshot = context.page ? path.join(artifactDir, `${definition.id}.png`) : "";
    if (context.page && !context.page.isClosed()) {
      await context.page.screenshot({ path: screenshot, fullPage: false }).catch(() => undefined);
    }
    results.push({
      ...definition,
      status: "failed",
      durationMs: Date.now() - startedAt.getTime(),
      error: error instanceof Error ? error.message : String(error),
      screenshot: screenshot ? path.relative(rootDir, screenshot) : undefined,
    });
  }
}

async function runFrontendCases(results, cases, context) {
  let server;
  let browser;
  let browserContext;
  try {
    server = startVite();
    await waitForFrontend(server);
    browser = await chromium.launch({ headless: true });
    browserContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await browserContext.newPage();
    const storageStatePath = path.join(artifactDir, `storage-${runId}.json`);
    const shared = {
      ...context,
      browser,
      context: browserContext,
      page,
      storageStatePath,
    };

    for (const definition of cases) {
      await runCase(results, definition, shared);
      if (definition.id === "AUTH-UI-001" && results.at(-1)?.status !== "failed") {
        await browserContext.storageState({ path: storageStatePath });
      }
      if (results.at(-1)?.status === "failed" && definition.priority === "P0") {
        break;
      }
    }
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    if (server) await server.stop().catch(() => undefined);
  }
}

async function writeReports(results, meta) {
  const passed = results.filter((item) => item.status === "passed").length;
  const skipped = results.filter((item) => item.status === "skipped").length;
  const failed = results.filter((item) => item.status === "failed").length;
  const jsonReport = {
    ...meta,
    summary: { total: results.length, passed, skipped, failed },
    cases: results.map(({ run, ...item }) => item),
    cleanup: cleanupNotes,
  };
  const jsonPath = path.join(artifactDir, `result-${runId}.json`);
  const latestPath = path.join(artifactDir, "latest-result.json");
  await writeFile(jsonPath, `${JSON.stringify(jsonReport, null, 2)}\n`);
  await writeFile(latestPath, `${JSON.stringify(jsonReport, null, 2)}\n`);
  const lines = [
    "# 小宝记云端自动化测试结果",
    "",
    `- 运行时间：${meta.generatedAt}`,
    `- Run ID：${runId}`,
    `- API：${apiBaseUrl}`,
    `- 前端：${baseUrl}`,
    `- 照护人账号：${maskPhone(caregiverPhone) || "未配置"}`,
    `- 只读账号：${maskPhone(viewerPhone) || "未配置"}`,
    `- 汇总：${passed} passed / ${skipped} skipped / ${failed} failed / ${results.length} total`,
    `- JSON 结果：${path.relative(rootDir, jsonPath)}`,
    "",
    "## 用例结果",
    "",
    "| 用例 | 优先级 | 功能 | 结果 | 准出标准 | 备注 |",
    "| --- | --- | --- | --- | --- | --- |",
    ...results.map((item) => {
      const note = item.status === "failed" ? item.error : item.details?.reason || JSON.stringify(item.details || {});
      return `| ${item.id} | ${item.priority} | ${item.feature} | ${item.status} | ${item.exitCriteria} | ${String(note).replace(/\|/g, "/").replace(/\r?\n/g, "<br>").slice(0, 320)} |`;
    }),
    "",
    "## 清理记录",
    "",
    ...(cleanupNotes.length ? cleanupNotes.map((item) => `- ${item}`) : ["- 无需清理或无清理输出。"]),
    "",
  ];
  await writeFile(reportPath, lines.join("\n"));
  return { jsonPath, latestPath, reportPath, failed };
}

async function main() {
  await mkdir(artifactDir, { recursive: true });
  const results = [];
  let caregiverLogin;
  const meta = {
    generatedAt: new Date().toISOString(),
    runId,
    apiBaseUrl,
    baseUrl,
    envFile: existsSync(envFile) ? path.relative(rootDir, envFile) : "",
    caregiverPhone: maskPhone(caregiverPhone),
    caregiverInvite: maskSecret(caregiverInvite),
    allowCaregiverOnboarding,
    caregiverRole,
    viewerPhone: maskPhone(viewerPhone),
    allowViewerOnboarding,
    viewerRole,
    runAgent,
  };

  const cases = [
    makeCase("CLOUD-API-001", "P0", "云端健康与真实凭证", "健康 ok；邀请码有效；照护人可登录；已有成员预检命中。", async () => {
      await healthCheck();
      if (!caregiverPhone || !caregiverInvite) {
        throw e2eError(missingCredentialMessage());
      }
      const rolePreview = await inviteRoles(caregiverInvite, caregiverPhone);
      if (!rolePreview.existingMember) {
        if (!allowCaregiverOnboarding) {
          throw e2eError("照护人测试账号未被云端识别为已注册成员。如需用新测试手机号加入测试家庭，请显式配置 E2E_ALLOW_CAREGIVER_ONBOARDING=1、E2E_CAREGIVER_ROLE 和 E2E_CAREGIVER_IS_CAREGIVER=true。");
        }
        if (!caregiverRole || caregiverIsCaregiver !== true) {
          throw e2eError("新测试手机号入家必须显式配置 E2E_CAREGIVER_ROLE 和 E2E_CAREGIVER_IS_CAREGIVER=true。");
        }
        if (rolePreview.occupiedRoles?.includes?.(caregiverRole)) {
          throw e2eError(`测试家庭中角色「${caregiverRole}」已被占用，请换一个可用角色。`);
        }
        caregiverLogin = await loginApi(caregiverPhone, caregiverInvite, caregiverRole, true);
      } else {
        caregiverLogin = await loginApi(caregiverPhone, caregiverInvite);
      }
      if (!caregiverLogin?.accessToken || !caregiverLogin.member?.caregiver) {
        throw e2eError("照护人测试账号登录成功但不是照护人身份。");
      }
      return {
        health: "ok",
        family: caregiverLogin.family?.name,
        role: caregiverLogin.member?.roleName,
        authFlow: rolePreview.existingMember ? "existing-member" : "new-caregiver-onboarding",
      };
    }),
    makeCase("AUTH-UI-001", "P0", "已注册用户登录体验", "登录页显示已识别身份，不再展示角色和照护人选择。", async ({ page }) => {
      await loginUi(page, caregiverPhone, caregiverInvite);
      return { loggedIn: true };
    }),
    makeCase("SHELL-LAYOUT-001", "P0", "App 壳、导航与移动适配", "六个 Tab 可切换，移动视口无横向溢出和控制台错误。", async ({ browser, storageStatePath }) => runLayoutMatrix(browser, storageStatePath)),
    makeCase("STATE-PERM-001", "P0", "状态读取与只读权限", "照护人可读状态；只读账号写入返回 403；只读 UI 不展示写入口。", async ({ browser, token }) => {
      const state = await apiState(token);
      if (!state?.state?.profile) throw e2eError("状态缺少 profile。");
      return viewerPermissionCheck(browser);
    }),
    makeCase("LEDGER-CRUD-001", "P0", "账本新增编辑删除", "新增、编辑、删除均反映到真实云端状态，删除有二次确认。", async ({ page, token }) => ledgerCrud(page, token)),
    makeCase("REMINDER-CRUD-001", "P0", "提醒新增完成删除", "新建提醒、完成确认、删除确认均生效，云端状态同步。", async ({ page, token }) => reminderCrud(page, token)),
    makeCase("RECORDS-VIEWS-001", "P0", "记录三视图", "今日、趋势、日历都可渲染并无横向溢出。", async ({ page }) => recordsViews(page)),
    makeCase("ALBUM-VIEWS-001", "P1", "相册分类与预览", "分类可切换；有素材可预览，无素材显示空态。", async ({ page }) => albumViews(page)),
    makeCase("PROFILE-VIEW-001", "P0", "我的页资料", "资料、身份、照护人、后端接口可见。", async ({ page }) => profileView(page)),
    makeCase("CHAT-LIVE-001", "P1", "真实 Agent 文本链路", "真实发送文本并收到 AI 回复；不出现服务不可用。", async ({ page, token }) => {
      if (!runAgent) return { skipped: true, reason: "E2E_RUN_AGENT=0" };
      return chatLive(page, token);
    }),
  ];

  try {
    const [apiCase, ...frontendCases] = cases;
    await runCase(results, apiCase, {});
    if (results.at(-1)?.status !== "failed") {
      const shared = {
        get token() {
          return caregiverLogin?.accessToken || "";
        },
      };
      await runFrontendCases(results, frontendCases, shared);
    }

    if (caregiverLogin?.accessToken) await cleanup(caregiverLogin.accessToken);
  } catch (error) {
    results.push({
      id: "HARNESS-ERROR",
      priority: "P0",
      feature: "测试框架运行",
      exitCriteria: "脚本自身不崩溃，并能写出结果报告。",
      status: "failed",
      durationMs: 0,
      error: error instanceof Error ? error.message : String(error),
    });
    if (caregiverLogin?.accessToken) await cleanup(caregiverLogin.accessToken);
  }

  const report = await writeReports(results, meta);
  const failed = results.filter((item) => item.status === "failed");
  if (failed.length) {
    console.error(`Cloud feature E2E failed: ${failed.map((item) => item.id).join(", ")}`);
    console.error(`Report: ${path.relative(rootDir, report.reportPath)}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Cloud feature E2E passed: ${results.length} cases.`);
  console.log(`Report: ${path.relative(rootDir, report.reportPath)}`);
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
