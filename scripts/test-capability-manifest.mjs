// Capability manifest 防漂移 + 反向可达校验 gate。
// 1) manifest 自身结构完整、id 唯一、enabled 能力有真实存在的 benchmark 覆盖。
// 2) 反向可达校验（Claude×Codex 交叉 review 补强）：enabled 且会写数据的能力，其 effectType
//    必须能被 effect-apply.mjs 真实落库——manifest 不能声明系统实际无法落地的能力，从结构层
//    堵住"AI 说能做但系统没实现"。真相源是 effect-apply 的 EFFECT_TYPE_TO_COLLECTION，不是本文件的副本。
// 接入 npm run test:agent-l2:unit，漂移即 CI 失败。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scenarios } from "./l2-benchmark/scenarios.mjs";
import { EFFECT_TYPE_TO_COLLECTION } from "./l2-benchmark/effect-apply.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "backend/src/main/resources/agent/capability-manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

// 真相源：effect-apply.mjs 实际能落库的 effectType 集合（不是本文件硬编码的副本）。
const APPLICABLE_EFFECT_TYPES = new Set(Object.keys(EFFECT_TYPE_TO_COLLECTION));

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

  // 反向可达校验：enabled 且会写数据(effectType 非 null)的能力，effectType 必须能真实落库。
  if (cap.enabled && cap.effectType != null && !APPLICABLE_EFFECT_TYPES.has(cap.effectType)) {
    errors.push(
      `能力 ${id} 声明 effectType=${cap.effectType}，但 effect-apply 无法把它落库——` +
        `manifest 声明了系统实际没有的能力（这正是"AI 说能做但没实现"的根）。`,
    );
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
const writeCaps = manifest.capabilities.filter((c) => c.enabled && c.effectType != null).length;
console.log(
  `✓ capability-manifest gate passed: ${manifest.capabilities.length} 个能力（${enabled} enabled，${writeCaps} 个会写数据）；` +
    `结构完整、benchmark 覆盖真实存在、会写数据的能力 effectType 全部可被 effect-apply 真实落库（反向可达校验通过）。`,
);
