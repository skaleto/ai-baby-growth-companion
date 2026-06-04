#!/usr/bin/env node
// L2 Agent capability benchmark runner.
//
// Drives real `POST /api/agent/chat/stream` requests against a LOCAL backend
// with a dedicated test account, scoring each scenario on three axes:
//   1. latency            — TTFT (first content event) + total stream time, N runs median
//   2. result accuracy    — structural hard-assertions on effectDecisions + LLM judge on aiText
//   3. system execution   — app_state diff (records written / boundaries respected / tools fired)
//
// Spec: docs/superpowers/specs/2026-06-04-agent-capability-benchmark.md
// Companion modules: scripts/l2-benchmark/scenarios.mjs, scripts/l2-benchmark/judge.mjs
//
// SAFETY: only ever talks to L2_BASE_URL (default http://localhost:8300) with a
// dedicated test phone → isolated test family. Never connect this to production.
//
// USAGE:
//   npm run test:agent-l2
//   npm run test:agent-l2 -- --only feed-complete,qa-policy
//   npm run test:agent-l2 -- --runs 5
//   npm run test:agent-l2 -- --update-baseline
//
// This runner is NOT required to pass without a running backend; it fails fast on
// the health check and writes a report explaining the precondition gap.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { selectScenarios } from "./l2-benchmark/scenarios.mjs";
import { assertOp, evaluateStructural, getPath } from "./l2-benchmark/assertions.mjs";
import { applyEffectDecisions, upsertStateRecord } from "./l2-benchmark/effect-apply.mjs";
import {
  judgeAiText,
  resolveJudgeApiKey,
  DEFAULT_JUDGE_MODEL,
  JUDGE_PROMPT_VERSION,
} from "./l2-benchmark/judge.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const baselinePath = path.join(__dirname, "l2-benchmark", "baseline.json");
const reportPath = path.join(rootDir, "docs", "agent-l2-benchmark-results.md");

// ── Configuration (env + CLI) ────────────────────────────────────────────────

const CONFIG = {
  baseUrl: (process.env.L2_BASE_URL || "http://localhost:8300").replace(/\/+$/, ""),
  // Dedicated test account → isolated family. Never a production phone.
  testPhone: process.env.L2_TEST_PHONE || "13800000001",
  testRole: process.env.L2_TEST_ROLE || "妈妈",
  // login requires a valid invite code; the local backend's
  // backend/data/auth/invite_codes holds env-specific codes. Override per env.
  // TODO(uncertain): default invite code is environment-specific — set L2_INVITE_CODE.
  inviteCode: process.env.L2_INVITE_CODE || "TEST-CODE",
  // Per-request stream timeout (image scenarios can be slow).
  streamTimeoutMs: Number(process.env.L2_STREAM_TIMEOUT_MS || 90000),
  healthTimeoutMs: Number(process.env.L2_HEALTH_TIMEOUT_MS || 5000),
  // Latency regression thresholds (fraction over baseline median).
  ttftWarnPct: Number(process.env.L2_TTFT_WARN_PCT || 0.3),
  ttftRedPct: Number(process.env.L2_TTFT_RED_PCT || 0.6),
  totalWarnPct: Number(process.env.L2_TOTAL_WARN_PCT || 0.3),
  totalRedPct: Number(process.env.L2_TOTAL_RED_PCT || 0.6),
  // Judge config (DeepSeek, flash tier).
  judge: {
    baseUrl: (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, ""),
    chatPath: process.env.DEEPSEEK_CHAT_PATH || "/chat/completions",
    model: process.env.L2_JUDGE_MODEL || DEFAULT_JUDGE_MODEL,
    apiKey: resolveJudgeApiKey(),
    timeoutMs: Number(process.env.L2_JUDGE_TIMEOUT_MS || 45000),
  },
  // Optional: local SQLite to read agent_run.final_model. Skipped if absent.
  sqlitePath: process.env.L2_SQLITE_PATH || path.join(rootDir, "backend", "data", "baby-companion.sqlite"),
};

function parseArgs(argv) {
  const args = { only: [], runs: 3, updateBaseline: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--only") {
      args.only = (argv[++i] || "").split(",").map((s) => s.trim()).filter(Boolean);
    } else if (arg.startsWith("--only=")) {
      args.only = arg.slice("--only=".length).split(",").map((s) => s.trim()).filter(Boolean);
    } else if (arg === "--runs") {
      args.runs = Math.max(1, Number(argv[++i] || 3) || 3);
    } else if (arg.startsWith("--runs=")) {
      args.runs = Math.max(1, Number(arg.slice("--runs=".length)) || 3);
    } else if (arg === "--update-baseline") {
      args.updateBaseline = true;
    }
  }
  return args;
}

// ── Small utilities ──────────────────────────────────────────────────────────

function log(...parts) {
  console.log(...parts);
}

function median(values) {
  const nums = values.filter((v) => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
  if (nums.length === 0) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid];
}

// ── HTTP helpers (native fetch) ──────────────────────────────────────────────

async function healthCheck() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.healthTimeoutMs);
  try {
    // No dedicated health endpoint guaranteed; hit auth roles which is unauthenticated
    // and cheap. Any HTTP response (even 4xx) proves the server is up.
    const res = await fetch(`${CONFIG.baseUrl}/api/auth/invite/roles?inviteCode=ping`, {
      signal: controller.signal,
    });
    return { up: true, status: res.status };
  } catch (error) {
    return { up: false, error: error?.message || String(error) };
  } finally {
    clearTimeout(timeout);
  }
}

async function login() {
  const res = await fetch(`${CONFIG.baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone: CONFIG.testPhone,
      inviteCode: CONFIG.inviteCode,
      roleName: CONFIG.testRole,
      caregiver: true,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`login failed: HTTP ${res.status} ${text.slice(0, 200)}`);
  }
  let token;
  try {
    token = JSON.parse(text).accessToken;
  } catch {
    throw new Error(`login response was not JSON: ${text.slice(0, 200)}`);
  }
  if (!token) throw new Error("login response had no accessToken");
  return token;
}

async function getAppState(token) {
  const res = await fetch(`${CONFIG.baseUrl}/api/app/state`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`GET app/state failed: HTTP ${res.status} ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

/**
 * Reset the test family's app_state so diffs are repeatable. The backend has no
 * explicit reset endpoint, but `PUT /api/app/state` with `{}` replaces the
 * snapshot (used by AppStateControllerTests.resetState). If that is unavailable
 * we fall back to recording the current state as the diff baseline.
 */
async function resetOrBaselineState(token) {
  const res = await fetch(`${CONFIG.baseUrl}/api/app/state`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: "{}",
  });
  if (res.ok) {
    const json = await res.json().catch(() => null);
    return { reset: true, state: json?.state || {} };
  }
  // Fallback: cannot reset; snapshot current state as the per-scenario baseline.
  const snapshot = await getAppState(token).catch(() => ({ state: {} }));
  return { reset: false, state: snapshot?.state || {} };
}

// ── SSE streaming ────────────────────────────────────────────────────────────

/**
 * POST a chat request and consume the text/event-stream.
 *
 * Backend event contract (verified in AgentRuntime.java):
 *   - "content"  : { delta } — incremental aiText text chunks (NOT JSON).
 *   - "reasoning": { delta } — thinking trace (ignored for scoring).
 *   - "tool"     : { id, toolId, name, status, ... } — tool activity.
 *   - "final"    : full serialized AgentChatResponse (aiText/effectDecisions/...).
 *                  THIS is the authoritative parsed response, not the content concat.
 *   - "error"    : { message }
 *   - misc status events (planning / generating / analyzing_media ...) — ignored.
 *
 * Returns { ttftMs, totalMs, aiTextStream, finalResponse, toolEvents, errorEvent }.
 */
async function streamChat(token, scenario) {
  const requestBody = {
    message: scenario.message || "",
    attachments: scenario.attachments || [],
    pageContext: scenario.pageContext,
    babyProfile: scenario.babyProfile,
    // L2 exercises the default routing; thinking/lowLatency left to backend defaults.
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.streamTimeoutMs);

  const started = performance.now();
  let ttftMs = null;
  let aiTextStream = "";
  let finalResponse = null;
  const toolEvents = [];
  let errorEvent = null;

  try {
    const res = await fetch(`${CONFIG.baseUrl}/api/agent/chat/stream`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ttftMs: null,
        totalMs: performance.now() - started,
        aiTextStream: "",
        finalResponse: null,
        toolEvents: [],
        errorEvent: { message: `HTTP ${res.status}: ${text.slice(0, 200)}` },
        transportError: true,
      };
    }
    if (!res.body) {
      throw new Error("response had no body stream");
    }

    const decoder = new TextDecoder();
    let buffer = "";
    const reader = res.body.getReader();

    // Parse SSE frames: events are separated by a blank line; each event has
    // `event:` and (possibly multiple) `data:` lines.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sepIndex;
      // Handle both \n\n and \r\n\r\n frame separators.
      while ((sepIndex = indexOfFrameBreak(buffer)) !== -1) {
        const rawFrame = buffer.slice(0, sepIndex.index);
        buffer = buffer.slice(sepIndex.index + sepIndex.length);
        const event = parseSseFrame(rawFrame);
        if (!event) continue;

        const handled = handleEvent(event);
        if (handled?.firstContent && ttftMs === null) {
          ttftMs = performance.now() - started;
        }
      }
    }

    function handleEvent(event) {
      const { name, data } = event;
      if (name === "content") {
        const delta = data?.delta ?? "";
        if (delta) aiTextStream += delta;
        return { firstContent: true };
      }
      if (name === "tool") {
        toolEvents.push(data);
        return {};
      }
      if (name === "final") {
        finalResponse = data;
        return {};
      }
      if (name === "error") {
        errorEvent = data;
        return {};
      }
      return {};
    }

    return {
      ttftMs,
      totalMs: performance.now() - started,
      aiTextStream,
      finalResponse,
      toolEvents,
      errorEvent,
    };
  } catch (error) {
    return {
      ttftMs,
      totalMs: performance.now() - started,
      aiTextStream,
      finalResponse,
      toolEvents,
      errorEvent: errorEvent || { message: `stream error: ${error?.message || error}` },
      transportError: true,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** Find the next SSE frame boundary, returning its index + separator length. */
function indexOfFrameBreak(buffer) {
  const lf = buffer.indexOf("\n\n");
  const crlf = buffer.indexOf("\r\n\r\n");
  if (lf === -1 && crlf === -1) return -1;
  if (crlf !== -1 && (lf === -1 || crlf < lf)) return { index: crlf, length: 4 };
  return { index: lf, length: 2 };
}

/** Parse one raw SSE frame into { name, data } with JSON-decoded data. */
function parseSseFrame(rawFrame) {
  const lines = rawFrame.split(/\r?\n/);
  let name = "message";
  const dataLines = [];
  for (const line of lines) {
    if (line.startsWith("event:")) {
      name = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).replace(/^ /, ""));
    }
    // ignore id:/retry:/comments
  }
  if (dataLines.length === 0 && name === "message") return null;
  const dataRaw = dataLines.join("\n");
  let data = dataRaw;
  if (dataRaw) {
    try {
      data = JSON.parse(dataRaw);
    } catch {
      data = dataRaw; // some events (rare) may be plain strings
    }
  }
  return { name, data };
}

// ── System-execution (app_state diff) assertions ────────────────────────────

function collectionLength(state, name) {
  const arr = state?.[name];
  return Array.isArray(arr) ? arr.length : 0;
}

/** Return items present in `after` but not in `before` (by id) for a collection. */
function newItems(beforeState, afterState, name) {
  const before = Array.isArray(beforeState?.[name]) ? beforeState[name] : [];
  const after = Array.isArray(afterState?.[name]) ? afterState[name] : [];
  const beforeIds = new Set(before.map((it) => it?.id).filter((id) => id != null));
  return after.filter((it) => it?.id == null || !beforeIds.has(it.id));
}

function evaluateExecution(scenario, beforeState, afterState) {
  const checks = [];
  const exp = scenario.stateExpect || {};

  if (exp.collection && exp.mustGrow) {
    const before = collectionLength(beforeState, exp.collection);
    const after = collectionLength(afterState, exp.collection);
    const grew = after > before;
    checks.push({
      label: `${exp.collection} grew`,
      pass: grew,
      detail: `${before} → ${after}`,
    });
    if (grew && Array.isArray(exp.newItemAssertions)) {
      const added = newItems(beforeState, afterState, exp.collection);
      const target = added[0] || {};
      for (const na of exp.newItemAssertions) {
        const actual = getPath(target, na.path);
        const { pass, detail } = assertOp(actual, na.op, na.value);
        checks.push({ label: `new ${exp.collection}.${na.path} ${na.op}`, pass, detail });
      }
    }
  }

  if (Array.isArray(exp.mustNotGrow)) {
    for (const name of exp.mustNotGrow) {
      const before = collectionLength(beforeState, name);
      const after = collectionLength(afterState, name);
      checks.push({
        label: `${name} did not grow`,
        pass: after <= before,
        detail: `${before} → ${after}`,
      });
    }
  }

  const pass = checks.every((c) => c.pass);
  return { checks, pass };
}

// ── Per-scenario state setup ────────────────────────────────────────────────

function todayInAppZone() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function resolveFixtureValue(value, replacements = { today: todayInAppZone() }) {
  if (value === "$today") return replacements.today;
  if (Array.isArray(value)) return value.map((item) => resolveFixtureValue(item, replacements));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveFixtureValue(item, replacements)]));
  }
  return value;
}

async function applyScenarioSetup(token, scenario) {
  const records = Array.isArray(scenario.setupState) ? scenario.setupState : [];
  for (const record of records) {
    await upsertStateRecord({
      baseUrl: CONFIG.baseUrl,
      token,
      collection: record.collection,
      id: record.id,
      item: resolveFixtureValue(record.item),
      mode: record.mode || "merge",
    });
  }
  return records.length;
}

// ── agent_run.final_model lookup (optional, best-effort) ─────────────────────

/**
 * Try to read the most recent agent_run.final_model from local SQLite via the
 * `sqlite3` CLI. Returns null on any failure (the feature is optional; runner
 * still reports its own measured latency).
 * TODO(uncertain): assumes local sqlite3 CLI + readable DB file. For the remote
 * deployment, point L2_SQLITE_PATH at a synced copy or skip.
 */
async function queryLatestFinalModel() {
  try {
    if (!fs.existsSync(CONFIG.sqlitePath)) return null;
    const { spawnSync } = await import("node:child_process");
    const sql = "SELECT final_model FROM agent_run ORDER BY COALESCE(completed_at, started_at, created_at) DESC LIMIT 1;";
    const res = spawnSync("sqlite3", [CONFIG.sqlitePath, sql], { encoding: "utf8", timeout: 5000 });
    if (res.status !== 0) return null;
    const value = (res.stdout || "").trim();
    return value || null;
  } catch {
    return null;
  }
}

// ── Baseline ─────────────────────────────────────────────────────────────────

function loadBaseline() {
  try {
    return JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  } catch {
    return null;
  }
}

function writeBaseline(baseline) {
  fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
  fs.writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
}

/** Compare a scenario's metrics against baseline; produce regression flags. */
function compareToBaseline(scenarioId, metrics, baseline) {
  const base = baseline?.scenarios?.[scenarioId];
  const flags = [];
  if (!base) {
    flags.push({ level: "info", text: "no baseline (new scenario)" });
    return flags;
  }
  // Latency regressions.
  for (const [key, warnPct, redPct, label] of [
    ["ttftMs", CONFIG.ttftWarnPct, CONFIG.ttftRedPct, "TTFT"],
    ["totalMs", CONFIG.totalWarnPct, CONFIG.totalRedPct, "total"],
  ]) {
    const now = metrics[key];
    const was = base[key];
    if (typeof now === "number" && typeof was === "number" && was > 0) {
      const delta = (now - was) / was;
      if (delta >= redPct) flags.push({ level: "red", text: `${label} regressed ${(delta * 100).toFixed(0)}% (${was.toFixed(0)}→${now.toFixed(0)}ms)` });
      else if (delta >= warnPct) flags.push({ level: "warn", text: `${label} +${(delta * 100).toFixed(0)}% (${was.toFixed(0)}→${now.toFixed(0)}ms)` });
    }
  }
  // Quality score drops.
  for (const dim of ["accuracy", "helpfulness", "tone"]) {
    const now = metrics.judge?.[dim];
    const was = base.judge?.[dim];
    if (typeof now === "number" && typeof was === "number" && now < was) {
      flags.push({ level: "warn", text: `${dim} ${was}→${now}` });
    }
  }
  return flags;
}

// ── Per-scenario execution ───────────────────────────────────────────────────

async function runScenario(scenario, token, runs) {
  log(`\n▶ ${scenario.id} (${scenario.capability})`);

  if (scenario.skip) {
    log(`  ⏭  skipped: ${scenario.skipReason || "placeholder"}`);
    return { id: scenario.id, capability: scenario.capability, skipped: true, knownGap: scenario.knownGap, skipReason: scenario.skipReason };
  }

  const resetResult = await resetOrBaselineState(token).catch((e) => ({ reset: false, error: e.message }));
  if (!resetResult.reset) {
    log(`  ⚠ could not reset app_state before scenario; diff baseline may include old data${resetResult.error ? ` (${resetResult.error})` : ""}`);
  }
  const setupCount = await applyScenarioSetup(token, scenario);
  if (setupCount) log(`  ✓ seeded ${setupCount} app_state record(s)`);

  const ttfts = [];
  const totals = [];
  let lastRun = null;

  // Latency: N runs; for diff/structural we use the LAST run. Earlier runs do
  // not apply effects, so they cannot consume the state growth we need to verify.
  for (let i = 0; i < runs; i += 1) {
    let beforeState = {};
    if (i === runs - 1) {
      const snap = await getAppState(token).catch(() => ({ state: {} }));
      beforeState = snap?.state || {};
    }
    const result = await streamChat(token, scenario);
    ttfts.push(result.ttftMs);
    totals.push(result.totalMs);
    if (i === runs - 1) {
      const appliedEffects = await applyEffectDecisions({
        baseUrl: CONFIG.baseUrl,
        token,
        scenarioId: scenario.id,
        beforeState,
        finalResponse: result.finalResponse,
      });
      const afterSnap = await getAppState(token).catch(() => ({ state: {} }));
      lastRun = { result, beforeState, afterState: afterSnap?.state || {}, appliedEffects };
    }
    log(`  run ${i + 1}/${runs}: TTFT=${result.ttftMs == null ? "n/a" : result.ttftMs.toFixed(0)}ms total=${result.totalMs.toFixed(0)}ms${result.errorEvent ? `  ⚠ ${JSON.stringify(result.errorEvent).slice(0, 120)}` : ""}`);
  }

  const { result, beforeState, afterState, appliedEffects } = lastRun;
  const finalResponse = result.finalResponse;
  const aiText = finalResponse?.aiText || result.aiTextStream || "";

  // Result accuracy — structural.
  const structural = evaluateStructural(scenario, finalResponse, result.toolEvents);
  // System execution — app_state diff.
  const execution = evaluateExecution(scenario, beforeState, afterState);
  // final_model (optional).
  const finalModel = await queryLatestFinalModel();
  // Result accuracy — judge (sampled once on the last run).
  const judge = await judgeAiText({ scenario, aiText, config: CONFIG.judge });

  const metrics = {
    ttftMs: median(ttfts),
    totalMs: median(totals),
    finalModel,
    judge: {
      accuracy: judge.accuracy,
      helpfulness: judge.helpfulness,
      tone: judge.tone,
      safety: judge.safety,
      reason: judge.reason,
      skipped: Boolean(judge.skipped),
      skipReason: judge.skipReason,
    },
  };

  // Red-line detection for exit code.
  const redlines = [];
  if (result.transportError || result.errorEvent) {
    redlines.push(`transport/error event: ${JSON.stringify(result.errorEvent || "transport").slice(0, 160)}`);
  }
  if (!structural.pass) redlines.push("structural assertion(s) failed");
  if (!execution.pass) redlines.push("execution (app_state diff) assertion(s) failed");
  if (judge.ok && judge.safety === "fail") redlines.push("judge safety = fail");
  if (judge.ok) {
    for (const dim of ["accuracy", "helpfulness", "tone"]) {
      if (typeof judge[dim] === "number" && judge[dim] < 2) redlines.push(`judge ${dim} < 2 (=${judge[dim]})`);
    }
  }

  log(`  result-accuracy: ${structural.pass ? "PASS" : "FAIL"} | execution: ${execution.pass ? "PASS" : "FAIL"} | judge: ${judge.skipped ? "skipped" : `a${judge.accuracy}/h${judge.helpfulness}/t${judge.tone} safety=${judge.safety}`}${finalModel ? ` | final_model=${finalModel}` : ""}`);

  return {
    id: scenario.id,
    capability: scenario.capability,
    inputType: scenario.inputType,
    metrics,
    structural,
    execution,
    judge,
    redlines,
    toolEvents: result.toolEvents,
    appliedEffects,
    setupCount,
    aiTextPreview: aiText.slice(0, 200),
  };
}

// ── Report generation ────────────────────────────────────────────────────────

function fmtMs(v) {
  return typeof v === "number" && Number.isFinite(v) ? `${v.toFixed(0)}ms` : "n/a";
}

function statusEmoji(pass) {
  return pass ? "✅" : "❌";
}

function buildReport({ args, scenarioResults, baseline, regressionsById, overallExit, preconditionError }) {
  const generatedAt = new Date().toISOString();
  const lines = [];
  lines.push("# Agent L2 Benchmark Results");
  lines.push("");
  lines.push(`Generated at: ${generatedAt}`);
  lines.push(`Base URL: \`${CONFIG.baseUrl}\` | Runs per scenario: ${args.runs} | Judge: \`${CONFIG.judge.model}\` (${JUDGE_PROMPT_VERSION})`);
  lines.push("");
  lines.push("## Command");
  lines.push("");
  lines.push("```bash");
  const cliFlags = [
    args.only.length ? `--only ${args.only.join(",")}` : "",
    args.runs !== 3 ? `--runs ${args.runs}` : "",
    args.updateBaseline ? "--update-baseline" : "",
  ].filter(Boolean);
  lines.push(`npm run test:agent-l2${cliFlags.length ? ` -- ${cliFlags.join(" ")}` : ""}`);
  lines.push("```");
  lines.push("");

  if (preconditionError) {
    lines.push("## Status: BLOCKED (precondition not met)");
    lines.push("");
    lines.push(`- ${preconditionError}`);
    lines.push("");
    lines.push("> The L2 benchmark needs a local backend at `L2_BASE_URL` with a valid test invite code.");
    lines.push("> Start the backend (`cd backend && mvn spring-boot:run`) and set `L2_INVITE_CODE` to a code from `backend/data/auth/invite_codes`.");
    lines.push("");
    return `${lines.join("\n")}\n`;
  }

  const ran = scenarioResults.filter((r) => !r.skipped);
  const skipped = scenarioResults.filter((r) => r.skipped);
  const passing = ran.filter((r) => r.redlines.length === 0).length;

  lines.push("## Summary");
  lines.push("");
  lines.push(`- Overall: ${overallExit === 0 ? "✅ PASS" : "❌ FAIL (red-line tripped)"}`);
  lines.push(`- Scenarios run: ${ran.length} (passing: ${passing}, with red-lines: ${ran.length - passing})`);
  lines.push(`- Skipped (placeholders): ${skipped.length}${skipped.length ? ` — ${skipped.map((s) => s.id).join(", ")}` : ""}`);
  lines.push("");

  // Latency table grouped overview.
  lines.push("## Latency (median over runs)");
  lines.push("");
  lines.push("| Scenario | Input | TTFT | Total | final_model | vs baseline |");
  lines.push("|---|---|---|---|---|---|");
  for (const r of ran) {
    const flags = regressionsById[r.id] || [];
    const flagText = flags.length ? flags.map((f) => `${f.level === "red" ? "🔴" : f.level === "warn" ? "🟡" : "ℹ️"} ${f.text}`).join("; ") : "—";
    lines.push(`| \`${r.id}\` | ${r.inputType} | ${fmtMs(r.metrics.ttftMs)} | ${fmtMs(r.metrics.totalMs)} | ${r.metrics.finalModel || "—"} | ${flagText} |`);
  }
  lines.push("");

  // Per-scenario detail (three axes).
  lines.push("## Per-scenario detail");
  lines.push("");
  for (const r of ran) {
    lines.push(`### \`${r.id}\` — ${r.capability}`);
    lines.push("");
    lines.push(`- Red-lines: ${r.redlines.length ? r.redlines.map((x) => `🔴 ${x}`).join("; ") : "none"}`);
    lines.push("");
    lines.push("**结果准确度 (structural):**");
    lines.push("");
    for (const c of r.structural.checks) {
      lines.push(`- ${statusEmoji(c.pass)} ${c.label} — ${c.detail}`);
    }
    if (r.structural.checks.length === 0) lines.push("- (no structural assertions)");
    lines.push("");
    lines.push("**系统执行准确度 (app_state diff):**");
    lines.push("");
    for (const c of r.execution.checks) {
      lines.push(`- ${statusEmoji(c.pass)} ${c.label} — ${c.detail}`);
    }
    if (r.execution.checks.length === 0) lines.push("- (no execution assertions)");
    lines.push("");
    lines.push("**结果准确度 (LLM judge on aiText):**");
    lines.push("");
    if (r.judge.skipped) {
      lines.push(`- ⏭ judge skipped: ${r.judge.skipReason}`);
    } else {
      lines.push(`- accuracy: ${r.judge.accuracy}/5 | helpfulness: ${r.judge.helpfulness}/5 | tone: ${r.judge.tone}/5 | safety: ${r.judge.safety === "pass" ? "✅ pass" : "❌ fail"}`);
      if (r.judge.reason) lines.push(`- judge note: ${r.judge.reason}`);
    }
    lines.push("");
    if (r.aiTextPreview) {
      lines.push(`> aiText preview: ${r.aiTextPreview.replace(/\n/g, " ")}${r.aiTextPreview.length >= 200 ? "…" : ""}`);
      lines.push("");
    }
    if (r.appliedEffects?.applied?.length) {
      lines.push(`- Applied effects: ${r.appliedEffects.applied.map((item) => `${item.collection}/${item.id}`).join(", ")}`);
      lines.push("");
    }
  }

  if (skipped.length) {
    const knownGaps = skipped.filter((s) => s.knownGap);
    const placeholders = skipped.filter((s) => !s.knownGap);
    if (knownGaps.length) {
      lines.push("## Known product coverage gaps");
      lines.push("");
      for (const s of knownGaps) lines.push(`- \`${s.id}\`: ${s.skipReason || "known gap"}`);
      lines.push("");
    }
    if (placeholders.length) {
      lines.push("## Skipped scenarios");
      lines.push("");
      for (const s of placeholders) lines.push(`- \`${s.id}\`: ${s.skipReason || "placeholder"}`);
      lines.push("");
    }
    lines.push("## Scenario coverage inventory");
    lines.push("");
    for (const r of [...ran, ...skipped]) {
      const marker = r.skipped ? (r.knownGap ? "known-gap" : "skipped") : "runnable";
      lines.push(`- \`${r.id}\` — ${r.capability || "?"} — ${marker}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push(`_Baseline: ${baseline ? `loaded (${Object.keys(baseline.scenarios || {}).length} scenarios, generated ${baseline.generatedAt || "?"})` : "none yet — run with --update-baseline to create"}_`);
  lines.push("");
  return `${lines.join("\n")}\n`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  log("Agent L2 Benchmark");
  log(`  base URL: ${CONFIG.baseUrl}`);
  log(`  test phone: ${CONFIG.testPhone} (role ${CONFIG.testRole})`);
  log(`  runs: ${args.runs}${args.only.length ? `  only: ${args.only.join(",")}` : ""}${args.updateBaseline ? "  [update-baseline]" : ""}`);
  if (!CONFIG.judge.apiKey) {
    log("  ⚠ no DeepSeek API key — judge scoring will be skipped (set DEEPSEEK_API_KEY / DEEPSEEK_API_KEY_FILE)");
  }

  const baseline = loadBaseline();
  const selected = selectScenarios(args.only);

  // 1) Health check.
  const health = await healthCheck();
  if (!health.up) {
    const msg = `backend health check failed at ${CONFIG.baseUrl} (${health.error}). Is the local backend running?`;
    log(`\n❌ ${msg}`);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, buildReport({ args, scenarioResults: [], baseline, regressionsById: {}, overallExit: 1, preconditionError: msg }));
    process.exit(1);
  }
  log(`  ✓ backend reachable (HTTP ${health.status})`);

  // 2) Login → bearer.
  let token;
  try {
    token = await login();
    log("  ✓ logged in as test account");
  } catch (error) {
    const msg = `login failed: ${error.message}`;
    log(`\n❌ ${msg}`);
    fs.writeFileSync(reportPath, buildReport({ args, scenarioResults: [], baseline, regressionsById: {}, overallExit: 1, preconditionError: msg }));
    process.exit(1);
  }

  // 3) Scenarios reset their app_state independently before they run.
  log("  ✓ scenario-level app_state reset enabled");

  // 4) Run scenarios.
  const scenarioResults = [];
  for (const scenario of selected) {
    try {
      scenarioResults.push(await runScenario(scenario, token, args.runs));
    } catch (error) {
      log(`  ❌ scenario ${scenario.id} threw: ${error.message}`);
      scenarioResults.push({
        id: scenario.id,
        capability: scenario.capability,
        inputType: scenario.inputType,
        knownGap: scenario.knownGap,
        metrics: { ttftMs: null, totalMs: null, finalModel: null, judge: { skipped: true } },
        structural: { checks: [{ label: "scenario execution", pass: false, detail: error.message }], pass: false },
        execution: { checks: [], pass: false },
        judge: { skipped: true, skipReason: error.message },
        redlines: [`scenario threw: ${error.message}`],
        toolEvents: [],
        aiTextPreview: "",
      });
    }
  }

  // 5) Baseline comparison.
  const regressionsById = {};
  for (const r of scenarioResults) {
    if (r.skipped) continue;
    regressionsById[r.id] = compareToBaseline(r.id, r.metrics, baseline);
  }

  // 6) Determine exit code: any scenario red-line OR any red latency regression.
  let overallExit = 0;
  for (const r of scenarioResults) {
    if (r.skipped) continue;
    if (r.redlines.length > 0) overallExit = 1;
    const flags = regressionsById[r.id] || [];
    if (flags.some((f) => f.level === "red")) overallExit = 1;
  }

  // 7) Write report.
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, buildReport({ args, scenarioResults, baseline, regressionsById, overallExit, preconditionError: null }));
  log(`\n📝 report → ${path.relative(rootDir, reportPath)}`);

  // 8) Update baseline if requested.
  if (args.updateBaseline) {
    const next = { generatedAt: new Date().toISOString(), judgePromptVersion: JUDGE_PROMPT_VERSION, scenarios: { ...(baseline?.scenarios || {}) } };
    for (const r of scenarioResults) {
      if (r.skipped) continue;
      next.scenarios[r.id] = {
        ttftMs: r.metrics.ttftMs,
        totalMs: r.metrics.totalMs,
        finalModel: r.metrics.finalModel,
        judge: {
          accuracy: r.judge.accuracy,
          helpfulness: r.judge.helpfulness,
          tone: r.judge.tone,
          safety: r.judge.safety,
        },
      };
    }
    writeBaseline(next);
    log(`📌 baseline updated → ${path.relative(rootDir, baselinePath)}`);
  }

  log(`\n${overallExit === 0 ? "✅ L2 benchmark PASSED" : "❌ L2 benchmark FAILED (red-line tripped)"}`);
  process.exit(overallExit);
}

main().catch((error) => {
  console.error(`\n❌ fatal: ${error?.stack || error}`);
  process.exit(1);
});
