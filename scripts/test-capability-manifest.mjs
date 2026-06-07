#!/usr/bin/env node
// Capability manifest 防漂移 gate（tool-first 版本）。
// enabled 的写能力必须声明 actionTools，且这些工具必须在后端真实注册；
// disabled 能力不会进入 agent prompt，也不强制 benchmark 覆盖。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scenarios } from "./l2-benchmark/scenarios.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "backend/src/main/resources/agent/capability-manifest.json");
const actionToolDir = path.join(root, "backend/src/main/java/com/xiaobao/babycompanion/agent/action");
const webSearchToolPath = path.join(root, "backend/src/main/java/com/xiaobao/babycompanion/agent/WebSearchTool.java");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const implementedTools = discoverImplementedToolIds();
const scenarioIds = new Set(scenarios.map((s) => s.id));
const scenarioById = new Map(scenarios.map((s) => [s.id, s]));
const errors = [];
const seenIds = new Set();

if (!Array.isArray(manifest.capabilities) || manifest.capabilities.length === 0) {
  errors.push("manifest.capabilities 缺失或为空");
}

for (const cap of manifest.capabilities ?? []) {
  const id = cap.id ?? "<no-id>";
  for (const field of ["id", "name", "trigger", "summary", "modes", "enabled"]) {
    if (cap[field] == null || (Array.isArray(cap[field]) && cap[field].length === 0)) {
      errors.push(`能力 ${id} 缺少必填字段 ${field}`);
    }
  }
  if (seenIds.has(cap.id)) errors.push(`能力 id 重复：${cap.id}`);
  seenIds.add(cap.id);

  const writes = Array.isArray(cap.writes) ? cap.writes : [];
  const actionTools = Array.isArray(cap.actionTools) ? cap.actionTools : [];
  if (cap.enabled && writes.length > 0) {
    if (actionTools.length === 0) {
      errors.push(`enabled 写能力 ${id} 没有 actionTools，不能证明由受控工具落库`);
    }
    for (const tool of actionTools) {
      if (!implementedTools.has(tool)) {
        errors.push(`能力 ${id} 声明 actionTool=${tool}，但后端未发现该工具实现`);
      }
    }
    for (const write of writes) {
      if (!["applied", "pending_created"].includes(write.status)) {
        errors.push(`能力 ${id} 的 writes.status=${write.status} 非法`);
      }
      if (!["careLogs", "pendingEffects"].includes(write.collection)) {
        errors.push(`能力 ${id} 的 writes.collection=${write.collection} 非本轮允许的记录/账本写入集合`);
      }
    }
  }

  if (cap.enabled) {
    if (!Array.isArray(cap.benchmark) || cap.benchmark.length === 0) {
      errors.push(`enabled 能力 ${id} 没有 benchmark 覆盖`);
    } else {
      for (const sid of cap.benchmark) {
        if (!scenarioIds.has(sid)) errors.push(`能力 ${id} 引用了不存在的 benchmark 场景：${sid}`);
        if (scenarioById.get(sid)?.skip) errors.push(`enabled 能力 ${id} 引用了已 skip 的 benchmark 场景：${sid}`);
      }
    }
  }
}

for (const disabledId of ["set_reminder", "save_memory", "save_to_album"]) {
  const cap = (manifest.capabilities ?? []).find((item) => item.id === disabledId);
  if (!cap || cap.enabled !== false) {
    errors.push(`本轮应禁用 AI 写入能力 ${disabledId}`);
  }
}

if (!Array.isArray(manifest.globalBoundaries) || manifest.globalBoundaries.length === 0) {
  errors.push("manifest.globalBoundaries 缺失");
}
if (!manifest.imageBoundary) errors.push("manifest.imageBoundary 缺失");
if (!Array.isArray(manifest.replyRules) || manifest.replyRules.length === 0) {
  errors.push("manifest.replyRules 缺失");
}
if (!manifest.replyRules?.some((rule) => String(rule).includes("actionResults"))) {
  errors.push("manifest.replyRules 必须声明 actionResults 是最终回复事实来源");
}

if (errors.length) {
  console.error("❌ capability-manifest gate FAILED:");
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}

const enabled = manifest.capabilities.filter((c) => c.enabled).length;
const writeCaps = manifest.capabilities.filter((c) => c.enabled && Array.isArray(c.writes) && c.writes.length > 0).length;
console.log(
  `✓ capability-manifest gate passed: ${manifest.capabilities.length} 个能力（${enabled} enabled，${writeCaps} 个会写数据）；` +
    `enabled 写能力全部由真实 action tool 承载。`,
);

function discoverImplementedToolIds() {
  const ids = new Set();
  for (const file of fs.readdirSync(actionToolDir)) {
    if (!file.endsWith(".java")) continue;
    const source = fs.readFileSync(path.join(actionToolDir, file), "utf8");
    const match = /public\s+String\s+id\s*\(\s*\)\s*\{\s*return\s+"([^"]+)"/s.exec(source);
    if (match) ids.add(match[1]);
  }
  if (fs.existsSync(webSearchToolPath)) {
    const source = fs.readFileSync(webSearchToolPath, "utf8");
    const match = /public\s+String\s+id\s*\(\s*\)\s*\{\s*return\s+"([^"]+)"/s.exec(source);
    if (match) ids.add(match[1]);
  }
  return ids;
}
