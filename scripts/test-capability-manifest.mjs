// Capability manifest 防漂移 gate。
// 保证单一事实源 backend/src/main/resources/agent/capability-manifest.json
// 与代码/benchmark 一致：结构完整、effectType 真实、enabled 能力都有真实存在的 benchmark 覆盖。
// 接入 npm run test:agent-l2:unit，manifest 漂移即 CI 失败。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scenarios } from "./l2-benchmark/scenarios.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "backend/src/main/resources/agent/capability-manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

// EffectPolicy 真实支持的落库类型（agent effectDecision.type）。新增 effectType 必须先在后端实现。
const KNOWN_EFFECT_TYPES = new Set([
  "careLog",
  "growthEvent",
  "growthMeasurement",
  "reminder",
  "memory",
  "expenseItem",
  "albumItem",
]);

const scenarioIds = new Set(scenarios.map((s) => s.id));
const errors = [];
const seenIds = new Set();

if (!Array.isArray(manifest.capabilities) || manifest.capabilities.length === 0) {
  errors.push("manifest.capabilities 缺失或为空");
}

for (const cap of manifest.capabilities ?? []) {
  const id = cap.id ?? "<no-id>";
  for (const field of ["id", "name", "trigger", "summary", "modes"]) {
    if (cap[field] == null || (Array.isArray(cap[field]) && cap[field].length === 0)) {
      errors.push(`能力 ${id} 缺少必填字段 ${field}`);
    }
  }
  if (seenIds.has(cap.id)) errors.push(`能力 id 重复：${cap.id}`);
  seenIds.add(cap.id);

  if (cap.effectType !== null && !KNOWN_EFFECT_TYPES.has(cap.effectType)) {
    errors.push(`能力 ${id} 的 effectType=${cap.effectType} 不在 EffectPolicy 真实支持集合内（漂移）`);
  }

  if (cap.enabled) {
    if (!Array.isArray(cap.benchmark) || cap.benchmark.length === 0) {
      errors.push(`enabled 能力 ${id} 没有 benchmark 覆盖（要么补场景，要么置 enabled=false 标为未实现）`);
    } else {
      for (const sid of cap.benchmark) {
        if (!scenarioIds.has(sid)) {
          errors.push(`能力 ${id} 引用了不存在的 benchmark 场景：${sid}`);
        }
      }
    }
  }
}

if (!Array.isArray(manifest.globalBoundaries) || manifest.globalBoundaries.length === 0) {
  errors.push("manifest.globalBoundaries 缺失");
}
if (!manifest.imageBoundary) errors.push("manifest.imageBoundary 缺失");
if (!Array.isArray(manifest.replyRules) || manifest.replyRules.length === 0) {
  errors.push("manifest.replyRules 缺失");
}

if (errors.length) {
  console.error("❌ capability-manifest gate FAILED:");
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}

const enabled = manifest.capabilities.filter((c) => c.enabled).length;
console.log(
  `✓ capability-manifest gate passed: ${manifest.capabilities.length} 个能力（${enabled} enabled），` +
    `effectType 全部真实、enabled 能力均有真实存在的 benchmark 覆盖。`,
);
