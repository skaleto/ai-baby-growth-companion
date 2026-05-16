#!/usr/bin/env node
// Visual review of Playwright smoke screenshots using Claude vision.
//
// Two backends, auto-detected so the script works whether driven by Claude
// Code, Codex, plain CI, or a human:
//
//   1. `claude-cli`     — subprocess to the local `claude` binary. Uses your
//                         Claude subscription credit, no API key needed.
//                         Preferred when the binary is on PATH and logged in.
//   2. `anthropic-api`  — direct Anthropic API call via @anthropic-ai/sdk.
//                         Requires ANTHROPIC_API_KEY. Works anywhere Node runs.
//
// Override the choice with VISION_REVIEW_BACKEND=claude-cli|anthropic-api|auto.
//
// Usage:
//   npm run review:vision                    # reviews .verification/frontend-smoke
//   node scripts/vision-review.mjs <dir>     # any folder with PNGs + optional report.json
//
// Env knobs:
//   VISION_REVIEW_BACKEND     default "auto"
//   VISION_REVIEW_MODEL       default depends on backend (see below)
//   VISION_REVIEW_CONCURRENCY default 2 for cli, 4 for api
//   VISION_REVIEW_FAIL_ON     default "major" — exits 1 when this severity or worse is found
//   CLAUDE_BIN                default "claude"
//   ANTHROPIC_API_KEY         required only for the anthropic-api backend

import { readFile, readdir, writeFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const SEVERITY_ORDER = ["ok", "minor", "major", "broken"];
const VALID_BACKENDS = ["auto", "claude-cli", "anthropic-api"];

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const targetDir = path.resolve(rootDir, process.argv[2] || ".verification/frontend-smoke");
const requestedBackend = (process.env.VISION_REVIEW_BACKEND || "auto").toLowerCase();
const failOn = (process.env.VISION_REVIEW_FAIL_ON || "major").toLowerCase();
const claudeBin = process.env.CLAUDE_BIN || "claude";

if (!SEVERITY_ORDER.includes(failOn)) {
  console.error(`VISION_REVIEW_FAIL_ON must be one of ${SEVERITY_ORDER.join(", ")}`);
  process.exit(2);
}
if (!VALID_BACKENDS.includes(requestedBackend)) {
  console.error(`VISION_REVIEW_BACKEND must be one of ${VALID_BACKENDS.join(", ")}`);
  process.exit(2);
}

const SYSTEM_PROMPT = `You are reviewing screenshots of an AI-powered baby growth tracking app (婴幼儿成长记录 App). The screenshots come from automated Playwright smoke tests across multiple mobile viewports plus desktop.

Your job: catch *visual* bugs that DOM-based tests cannot — overlapping elements, cut-off text, broken alignment, content that overflows its container, missing UI elements, illegible color combinations, broken layout on a specific viewport, components rendering in the wrong place, tab bar / navigation issues, modal/overlay rendering glitches, and similar.

DO NOT flag:
- subjective styling preferences ("could look nicer")
- intentional design choices like mobile-first compact UI
- Chinese / Japanese text being present (this app is in Chinese)
- empty states or loading skeletons that look intentional
- minor spacing differences

Rate severity:
- ok: no issues worth flagging
- minor: cosmetic issue, app still usable (e.g. 1-2px misalignment, slight text wrap)
- major: visible bug a user would notice (e.g. overlapping buttons, truncated key info, tab bar mispositioned)
- broken: app unusable on this screen (e.g. white screen, modal stuck, content completely off-screen)

Return ONLY a JSON object matching the schema. No prose.`;

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    severity: { type: "string", enum: SEVERITY_ORDER },
    summary: { type: "string" },
    issues: { type: "array", items: { type: "string" } },
  },
  required: ["severity", "summary", "issues"],
};

function claudeBinAvailable() {
  try {
    const r = spawnSync(claudeBin, ["--version"], { stdio: "ignore" });
    return r.status === 0;
  } catch {
    return false;
  }
}

function resolveBackend() {
  if (requestedBackend === "claude-cli") {
    if (!claudeBinAvailable()) {
      console.error(
        `VISION_REVIEW_BACKEND=claude-cli but \`${claudeBin}\` is not on PATH (or not logged in). ` +
          "Install Claude Code or set CLAUDE_BIN.",
      );
      process.exit(2);
    }
    return "claude-cli";
  }
  if (requestedBackend === "anthropic-api") {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("VISION_REVIEW_BACKEND=anthropic-api but ANTHROPIC_API_KEY is not set.");
      process.exit(2);
    }
    return "anthropic-api";
  }
  // auto
  if (claudeBinAvailable()) return "claude-cli";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic-api";
  console.error(
    "No vision backend available. Either:\n" +
      `  - install and log into Claude Code so \`${claudeBin}\` is on PATH, or\n` +
      "  - set ANTHROPIC_API_KEY for the API fallback.\n" +
      "You can also pin a backend with VISION_REVIEW_BACKEND=claude-cli|anthropic-api.",
  );
  process.exit(2);
}

const backend = resolveBackend();
const modelDefaults = {
  "claude-cli": "haiku",
  "anthropic-api": "claude-haiku-4-5-20251001",
};
const concurrencyDefaults = { "claude-cli": 2, "anthropic-api": 4 };
const model = process.env.VISION_REVIEW_MODEL || modelDefaults[backend];
const concurrency = Math.max(
  1,
  Number(process.env.VISION_REVIEW_CONCURRENCY) || concurrencyDefaults[backend],
);

async function loadContext() {
  try {
    const reportPath = path.join(targetDir, "report.json");
    const raw = await readFile(reportPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function listScreenshots() {
  const entries = await readdir(targetDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".png"))
    .map((e) => e.name)
    .sort();
}

function contextNoteFor(filename, report) {
  if (!report) return "";
  const stem = filename.replace(/\.png$/i, "");
  const viewport = report.viewports?.find((v) => v.viewport === stem || `layout-${v.viewport}` === stem);
  if (viewport) {
    const flowMode = viewport.flow?.mode ? `flow: ${viewport.flow.mode}` : "";
    return `Viewport ${viewport.viewport} (${viewport.size})${flowMode ? `, ${flowMode}` : ""}.`;
  }
  return "";
}

function normalize(parsed) {
  return {
    severity: SEVERITY_ORDER.includes(parsed.severity) ? parsed.severity : "minor",
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    issues: Array.isArray(parsed.issues) ? parsed.issues.map(String) : [],
  };
}

// ─────────────────────────── claude-cli backend ───────────────────────────

function runClaude(args, stdin) {
  return new Promise((resolve, reject) => {
    const child = spawn(claudeBin, args, { stdio: ["pipe", "pipe", "pipe"] });
    const out = [];
    const err = [];
    child.stdout.on("data", (chunk) => out.push(chunk));
    child.stderr.on("data", (chunk) => err.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      const stdout = Buffer.concat(out).toString("utf8");
      const stderr = Buffer.concat(err).toString("utf8");
      if (code !== 0) reject(new Error(`claude exited ${code}: ${stderr || stdout}`));
      else resolve({ stdout, stderr });
    });
    if (stdin !== undefined) child.stdin.end(stdin);
    else child.stdin.end();
  });
}

function parseClaudeCliResponse(stdout) {
  let envelope;
  try {
    envelope = JSON.parse(stdout);
  } catch (err) {
    return { severity: "minor", summary: `Failed to parse claude output: ${err.message}`, issues: [] };
  }
  if (envelope.is_error) {
    return { severity: "minor", summary: `claude error: ${envelope.result || envelope.subtype}`, issues: [] };
  }
  if (envelope.structured_output && typeof envelope.structured_output === "object") {
    return normalize(envelope.structured_output);
  }
  const resultText = typeof envelope.result === "string" ? envelope.result.trim() : "";
  const jsonStart = resultText.indexOf("{");
  const jsonEnd = resultText.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    return { severity: "minor", summary: "Empty model response", issues: [] };
  }
  try {
    return normalize(JSON.parse(resultText.slice(jsonStart, jsonEnd + 1)));
  } catch (err) {
    return { severity: "minor", summary: `JSON parse error: ${err.message}`, issues: [] };
  }
}

async function reviewWithClaudeCli(filename, report) {
  const filePath = path.join(targetDir, filename);
  const contextNote = contextNoteFor(filename, report);
  const userPrompt = [
    `Screenshot path: ${filePath}`,
    contextNote && `Context: ${contextNote}`,
    "",
    "Read this image with the Read tool and respond with the JSON object per schema.",
  ]
    .filter(Boolean)
    .join("\n");

  const args = [
    "--print",
    "--add-dir",
    targetDir,
    "--allowedTools",
    "Read",
    "--disable-slash-commands",
    "--model",
    model,
    "--output-format",
    "json",
    "--json-schema",
    JSON.stringify(RESPONSE_SCHEMA),
    "--system-prompt",
    `${SYSTEM_PROMPT}\n\nUse the Read tool on the screenshot path the user gives you.`,
  ];

  const { stdout } = await runClaude(args, userPrompt);
  return parseClaudeCliResponse(stdout);
}

// ─────────────────────────── anthropic-api backend ───────────────────────────

let cachedApiClient = null;
async function getApiClient() {
  if (cachedApiClient) return cachedApiClient;
  const mod = await import("@anthropic-ai/sdk");
  const Anthropic = mod.default;
  cachedApiClient = new Anthropic();
  return cachedApiClient;
}

function parseApiResponse(message) {
  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    return { severity: "minor", summary: "Empty model response", issues: [] };
  }
  try {
    return normalize(JSON.parse(text.slice(jsonStart, jsonEnd + 1)));
  } catch (err) {
    return { severity: "minor", summary: `JSON parse error: ${err.message}`, issues: [] };
  }
}

async function reviewWithAnthropicApi(filename, report) {
  const client = await getApiClient();
  const filePath = path.join(targetDir, filename);
  const buffer = await readFile(filePath);
  const base64 = buffer.toString("base64");
  const contextNote = contextNoteFor(filename, report);
  const userText = contextNote
    ? `Screenshot: ${filename}\nContext: ${contextNote}\n\nReview this screenshot.`
    : `Screenshot: ${filename}\n\nReview this screenshot.`;

  const message = await client.messages.create({
    model,
    max_tokens: 512,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/png", data: base64 } },
          { type: "text", text: userText },
        ],
      },
    ],
  });
  return parseApiResponse(message);
}

// ─────────────────────────────────────────────────────────────────────────────

async function reviewOne(filename, report) {
  const reviewer = backend === "claude-cli" ? reviewWithClaudeCli : reviewWithAnthropicApi;
  const review = await reviewer(filename, report);
  return { filename, ...review };
}

async function runLimited(items, worker, limit) {
  const results = new Array(items.length);
  let cursor = 0;
  async function next() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        results[i] = await worker(items[i], i);
      } catch (err) {
        results[i] = { filename: items[i], severity: "minor", summary: `Review failed: ${err.message}`, issues: [] };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next));
  return results;
}

function severityRank(sev) {
  return SEVERITY_ORDER.indexOf(sev);
}

function renderMarkdown(results, report) {
  const worst = results.reduce(
    (acc, r) => (severityRank(r.severity) > severityRank(acc) ? r.severity : acc),
    "ok",
  );
  const counts = SEVERITY_ORDER.reduce((acc, s) => {
    acc[s] = results.filter((r) => r.severity === s).length;
    return acc;
  }, {});

  const lines = [
    "# Vision Review",
    "",
    `- Target: \`${path.relative(rootDir, targetDir)}\``,
    `- Backend: \`${backend}\`, model: \`${model}\``,
    `- Reviewed: ${results.length} screenshot(s)`,
    `- Worst severity: **${worst}**`,
    `- Breakdown: ${SEVERITY_ORDER.map((s) => `${s}=${counts[s]}`).join(", ")}`,
  ];
  if (report?.generatedAt) lines.push(`- Smoke run: ${report.generatedAt}`);
  lines.push("");

  for (const sev of ["broken", "major", "minor", "ok"]) {
    const group = results.filter((r) => r.severity === sev);
    if (!group.length) continue;
    lines.push(`## ${sev} (${group.length})`);
    lines.push("");
    for (const r of group) {
      lines.push(`### ${r.filename}`);
      if (r.summary) lines.push(`> ${r.summary}`);
      if (r.issues.length) {
        lines.push("");
        for (const issue of r.issues) lines.push(`- ${issue}`);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

async function main() {
  const report = await loadContext();
  const screenshots = await listScreenshots();
  if (!screenshots.length) {
    console.error(`No PNG screenshots found in ${targetDir}. Run npm run smoke:frontend first.`);
    process.exit(2);
  }

  console.log(
    `Reviewing ${screenshots.length} screenshot(s) from ${path.relative(rootDir, targetDir)} via ${backend} (${model}, concurrency ${concurrency})...`,
  );

  const results = await runLimited(
    screenshots,
    (name) => reviewOne(name, report),
    concurrency,
  );

  const markdown = renderMarkdown(results, report);
  const json = {
    generatedAt: new Date().toISOString(),
    target: path.relative(rootDir, targetDir),
    backend,
    model,
    results,
  };

  await writeFile(path.join(targetDir, "vision-review.md"), `${markdown}\n`);
  await writeFile(path.join(targetDir, "vision-review.json"), `${JSON.stringify(json, null, 2)}\n`);

  const worstRank = results.reduce((acc, r) => Math.max(acc, severityRank(r.severity)), 0);
  const failRank = severityRank(failOn);

  console.log("");
  console.log(markdown);
  console.log("");
  console.log(`Wrote ${path.relative(rootDir, path.join(targetDir, "vision-review.md"))}`);

  if (worstRank >= failRank) {
    console.error(`Vision review found ${SEVERITY_ORDER[worstRank]} issue(s) (fail threshold: ${failOn}).`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack || err.message : String(err));
  process.exit(1);
});
