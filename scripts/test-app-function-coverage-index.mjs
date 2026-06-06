#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { scenarios } from "./l2-benchmark/scenarios.mjs";
import { appFunctionCoverageIndex } from "./l2-benchmark/app-function-coverage-index.mjs";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const inventoryPath = path.join(repoRoot, "docs/feature-inventory.md");
const inventoryMarkdown = fs.readFileSync(inventoryPath, "utf8");

const allowedStatuses = new Set(["covered", "covered_by_layer", "known_gap"]);
const allowedLayers = new Set(["harness", "l0_l1", "l2", "frontend", "backend", "api", "cloud", "native", "docs", "manual"]);
const scenarioIds = new Set(scenarios.map((scenario) => scenario.id));

function parseInventoryRows(markdown) {
  const rows = [];
  let currentArea = "";
  for (const rawLine of markdown.split(/\r?\n/)) {
    const heading = rawLine.match(/^###\s+\d+\.\s+(.+)$/);
    if (heading) {
      currentArea = heading[1].trim();
      continue;
    }
    if (!rawLine.startsWith("| P")) continue;
    const cells = rawLine.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 4) continue;
    rows.push({
      priority: cells[0],
      feature: cells[1],
      area: currentArea,
    });
  }
  return rows;
}

const inventoryRows = parseInventoryRows(inventoryMarkdown);
assert.ok(inventoryRows.length > 35, `expected detailed current inventory rows, got ${inventoryRows.length}`);

const indexKeys = new Set();
const indexByKey = new Map();
for (const entry of appFunctionCoverageIndex) {
  const key = `${entry.priority}:${entry.feature}`;
  assert.ok(!indexKeys.has(key), `duplicate app function coverage entry ${key}`);
  indexKeys.add(key);
  indexByKey.set(key, entry);
}

for (const row of inventoryRows) {
  const key = `${row.priority}:${row.feature}`;
  assert.ok(indexByKey.has(key), `missing app function coverage for ${row.area} / ${key}`);
}

for (const entry of appFunctionCoverageIndex) {
  assert.ok(["P0", "P1", "P2"].includes(entry.priority), `${entry.feature} has invalid priority ${entry.priority}`);
  assert.ok(typeof entry.area === "string" && entry.area.trim(), `${entry.feature} needs area`);
  assert.ok(typeof entry.feature === "string" && entry.feature.trim(), "coverage entry needs feature");
  assert.ok(allowedStatuses.has(entry.status), `${entry.feature} has unsupported status ${entry.status}`);
  assert.ok(Array.isArray(entry.coverage) && entry.coverage.length > 0, `${entry.feature} must list coverage evidence`);
  for (const coverage of entry.coverage) {
    assert.ok(allowedLayers.has(coverage.layer), `${entry.feature} has unsupported layer ${coverage.layer}`);
    assert.ok(typeof coverage.evidence === "string" && coverage.evidence.trim(), `${entry.feature} coverage item needs evidence`);
    for (const scenarioId of coverage.scenarioIds || []) {
      assert.ok(scenarioIds.has(scenarioId), `${entry.feature} references missing L2 scenario ${scenarioId}`);
      assert.equal(Boolean(scenarios.find((scenario) => scenario.id === scenarioId)?.skip), false, `${scenarioId} should be runnable if referenced as coverage`);
    }
  }
  if (entry.status === "known_gap") {
    assert.ok(typeof entry.nextAction === "string" && entry.nextAction.trim(), `${entry.feature} known gap needs nextAction`);
  }
}

for (const required of [
  "P0:记录默认首页",
  "P0:底部四 Tab 导航",
  "P0:记录页轻量 AI 输入",
  "P0:喂养手动记录",
  "P0:睡眠手动记录",
  "P0:成长入口与最新值",
  "P0:手动新增成长测量",
  "P0:相册上传",
  "P0:按天分组",
  "P0:AI 记账待确认",
  "P0:提醒管理入口",
  "P0:Tool-first 喂养写入",
  "P0:Tool-first 成长待确认",
  "P0:Tool-first 账本待确认",
  "P0:不提供 AI 提醒工具",
  "P0:语音输入",
  "P0:写权限拦截",
]) {
  assert.ok(indexByKey.has(required), `coverage index should explicitly mention ${required}`);
}

const markdownPath = path.join(repoRoot, "docs/app-function-coverage-index.md");
assert.ok(fs.existsSync(markdownPath), "docs/app-function-coverage-index.md should exist");
const markdown = fs.readFileSync(markdownPath, "utf8");
for (const row of inventoryRows) {
  assert.ok(markdown.includes(`| ${row.priority} | ${row.feature} |`), `coverage markdown should mention ${row.priority} ${row.feature}`);
}

console.log(`app function coverage index tests passed: ${inventoryRows.length} inventory rows covered`);
