#!/usr/bin/env node
// app-acceptance-sweep · ROI#1:从 feature-inventory + coverage-index 生成「验收巡检计划」+ gap 报告。
//
// 价值:现有 coverage-index 按「有没有测试层」分类;本脚本再叠一层「验收巡检能不能真驱动验证」的视角,
// 把每条功能判成:
//   - auto-covered        已被自动层覆盖 → 巡检里真驱动 + 复断言
//   - frontend-fillable   是 gap 但前端可加 probe 补 → 巡检里新增 probe 的候选
//   - device-or-backend-gap  真机/真后端才测得到 → 诚实标 known_gap(不假装测了),给"要在哪测"
// 头号目的(Codex ROI#1):把 known_gap 顶到明面,防"脚本跑很多但 40 个 gap 被忽略"的验收幻觉。
//
// 用法:node scripts/qa-sweep/plan-from-inventory.mjs   (加 --json 只输出计划路径)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appFunctionCoverageIndex } from "../l2-benchmark/app-function-coverage-index.mjs";

const repoRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const outDir = path.join(repoRoot, ".verification/acceptance");
const planPath = path.join(outDir, "acceptance-plan.json");

// 自动初判:哪些「只有真机/真后端/真云端」验得到,前端 mock 巡检测不到 → 诚实 known_gap。
// 注:这是启发式初判(按 coverage 层 + 功能名 + area 关键词),device/前端边界需人工校准一次。
const DEVICE_BACKEND_LAYERS = new Set(["native", "cloud"]);
// 功能名里出现这些 = 核心能力要真机/真后端(语音 ASR、相机/媒体、原生通知/闹铃、OTA、部署、同步、IAP、数据导出等)
const NATIVE_FEATURE_RE =
  /语音|麦克风|录音|相机|拍照|图片\/视频|视频入口|媒体权限|缩略图|原生|通知保留|闹铃|闹钟|OTA|部署|ECS|跨设备|同步|订阅|内购|IAP|数据删除|导出|备份/;
// area 属原生/云端,且功能名不是纯 UI 项(入口/说明/权益门禁/提示/空状态这些前端可验)
const NATIVE_AREA_RE = /原生|云端|媒体/;
const PURE_UI_RE = /入口|说明|权益|提示|空状态|文案|徽标|角标/;

function disposition(entry) {
  if (entry.status === "covered" || entry.status === "covered_by_layer") return "auto-covered";
  // known_gap:再分前端可补 vs 真机/真后端
  const layers = (entry.coverage || []).map((c) => c.layer);
  const onlyDeviceBackend = layers.length > 0 && layers.every((l) => DEVICE_BACKEND_LAYERS.has(l));
  if (onlyDeviceBackend) return "device-or-backend-gap";
  if (NATIVE_FEATURE_RE.test(entry.feature)) return "device-or-backend-gap";
  if (NATIVE_AREA_RE.test(entry.area) && !PURE_UI_RE.test(entry.feature)) return "device-or-backend-gap";
  return "frontend-fillable";
}

const plan = appFunctionCoverageIndex.map((entry) => ({
  priority: entry.priority,
  area: entry.area,
  feature: entry.feature,
  status: entry.status,
  disposition: disposition(entry),
  layers: (entry.coverage || []).map((c) => c.layer),
  nextAction: entry.nextAction || null,
}));

const byStatus = tally(plan, (p) => p.status);
const byDisposition = tally(plan, (p) => p.disposition);
const byPriority = tally(plan, (p) => p.priority);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  planPath,
  JSON.stringify({ generatedFrom: "feature-inventory.md + app-function-coverage-index.mjs", total: plan.length, byStatus, byDisposition, byPriority, plan }, null, 2) + "\n",
);

if (process.argv.includes("--json")) {
  console.log(planPath);
  process.exit(0);
}

// ---- 人读 gap 报告 ----
const line = "─".repeat(64);
console.log(`\n验收巡检计划 · 共 ${plan.length} 条功能(源:feature-inventory + coverage-index)`);
console.log(line);
console.log("按覆盖状态:", fmt(byStatus));
console.log("按巡检处置:", fmt(byDisposition));
console.log("按优先级  :", fmt(byPriority));
console.log(`计划已写:${path.relative(repoRoot, planPath)}`);

const fillable = plan.filter((p) => p.disposition === "frontend-fillable");
const deviceGap = plan.filter((p) => p.disposition === "device-or-backend-gap");

console.log(`\n● 前端可自动补的 gap(巡检应新增 probe)—— ${fillable.length} 条`);
console.log(line);
printGroupedByArea(fillable);

console.log(`\n● 必须真机/真后端的 gap(诚实标 known_gap,前端 mock 测不到;自动初判,边界可人工校准)—— ${deviceGap.length} 条`);
console.log(line);
printGroupedByArea(deviceGap);

const autoCount = byDisposition["auto-covered"] || 0;
console.log(`\n小结:${autoCount} 条已自动覆盖(巡检里复跑断言)/ ${fillable.length} 条前端可补 / ${deviceGap.length} 条须真机·真后端。`);
console.log("⚠️ 验收报告必须显式列出后两类,不得因为「脚本跑了很多」就当全测过(防验收幻觉)。\n");

function tally(arr, key) {
  return arr.reduce((acc, x) => { const k = key(x); acc[k] = (acc[k] || 0) + 1; return acc; }, {});
}
function fmt(obj) {
  return Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join("  ");
}
function printGroupedByArea(rows) {
  if (!rows.length) { console.log("  (无)"); return; }
  const byArea = new Map();
  for (const r of rows) { if (!byArea.has(r.area)) byArea.set(r.area, []); byArea.get(r.area).push(r); }
  for (const [area, items] of byArea) {
    console.log(`  【${area}】`);
    for (const it of items) console.log(`    · [${it.priority}] ${it.feature}${it.nextAction ? "  → " + it.nextAction : ""}`);
  }
}
