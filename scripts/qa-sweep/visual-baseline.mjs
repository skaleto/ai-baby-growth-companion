#!/usr/bin/env node
// 视觉基线闸门:
//   node scripts/qa-sweep/visual-baseline.mjs accept   # 把当前 .verification/acceptance 的截图签成基线
//   node scripts/qa-sweep/visual-baseline.mjs          # diff:对比当前 vs 基线,产 _changed 变更集 + 报告
import { readdir, readFile, writeFile, mkdir, copyFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sha256, aHash, hamming, pixelDiffRatio } from "./image-hash.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const corpusDir = path.join(rootDir, ".verification/acceptance");
const baselineDir = path.join(rootDir, ".verification/acceptance-baseline");
const manifestPath = path.join(baselineDir, "baseline-manifest.json");
const changedDir = path.join(corpusDir, "_changed");
const AHASH_THRESHOLD = Number(process.env.QA_VISUAL_AHASH || 6);   // 汉明距离 > 此值算"变了"
const PIXEL_THRESHOLD = Number(process.env.QA_VISUAL_PIXEL || 0.02); // 像素 diff 比例 > 此值算"变了"
const mode = process.argv[2] === "accept" ? "accept" : "diff";

// 递归收集所有 screen.png,key = 相对 corpus 的路径(如 caregiver-rich/iphone-13-390x844__记录/screen.png)
async function collect(dir, base = dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name === "_changed") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await collect(p, base, out);
    else if (e.name === "screen.png") out.push(path.relative(base, p));
  }
  return out;
}
const flatName = (rel) => rel.replace(/[\\/]/g, "__");

const shots = await collect(corpusDir);
if (!shots.length) { console.error("没有截图语料,先 npm run qa:sweep"); process.exit(1); }

if (mode === "accept") {
  await rm(baselineDir, { recursive: true, force: true });
  await mkdir(baselineDir, { recursive: true });
  const manifest = { acceptedAt: new Date().toISOString(), acceptedBy: "human", entries: {} };
  for (const rel of shots) {
    const buf = await readFile(path.join(corpusDir, rel));
    manifest.entries[rel] = { sha256: sha256(buf), aHash: aHash(buf) };
    await copyFile(path.join(corpusDir, rel), path.join(baselineDir, flatName(rel)));
  }
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`已签基线:${shots.length} 张(${path.relative(rootDir, manifestPath)})`);
  process.exit(0);
}

// diff 模式
let manifest = null;
try { manifest = JSON.parse(await readFile(manifestPath, "utf8")); } catch {}
await rm(changedDir, { recursive: true, force: true });
await mkdir(changedDir, { recursive: true });

const rows = [];
for (const rel of shots) {
  const buf = await readFile(path.join(corpusDir, rel));
  const cur = { sha256: sha256(buf), aHash: aHash(buf) };
  const base = manifest?.entries?.[rel];
  let status, detail = "";
  if (!manifest) { status = "no-baseline"; }
  else if (!base) { status = "new"; }
  else if (base.sha256 === cur.sha256) { status = "unchanged"; }
  else {
    const ham = hamming(base.aHash, cur.aHash);
    const baseBuf = await readFile(path.join(baselineDir, flatName(rel))).catch(() => null);
    const pix = baseBuf ? pixelDiffRatio(baseBuf, buf) : 1;
    detail = `aHash距离=${ham} 像素diff=${(pix * 100).toFixed(1)}%`;
    status = ham > AHASH_THRESHOLD || pix > PIXEL_THRESHOLD ? "changed" : "unchanged-minor";
  }
  rows.push({ rel, status, detail });
  if (status === "new" || status === "changed" || status === "no-baseline") {
    await copyFile(path.join(corpusDir, rel), path.join(changedDir, flatName(rel)));
  }
}

const tally = rows.reduce((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {});
await writeFile(path.join(corpusDir, "visual-diff.json"), JSON.stringify({ generatedAt: new Date().toISOString(), threshold: { aHash: AHASH_THRESHOLD, pixel: PIXEL_THRESHOLD }, tally, rows }, null, 2) + "\n");

console.log(`\n视觉基线 diff:${shots.length} 张`);
console.log("─".repeat(56));
console.log("分布:", Object.entries(tally).map(([k, v]) => `${k}=${v}`).join("  "));
const forLLM = rows.filter((r) => ["new", "changed", "no-baseline"].includes(r.status));
console.log(`送 LLM 复审(变更/新增):${forLLM.length} 张 → ${path.relative(rootDir, changedDir)}/`);
for (const r of forLLM.slice(0, 20)) console.log(`  · [${r.status}] ${r.rel}${r.detail ? "  " + r.detail : ""}`);
if (!manifest) console.log("\n⚠️ 还没有基线:全部视为新增。请先人工眼过 .verification/acceptance/ 截图,确认无误后 `npm run qa:baseline:accept` 签基线。");
process.exitCode = 0; // diff 本身不判失败;失败由后续 vision-review 决定
