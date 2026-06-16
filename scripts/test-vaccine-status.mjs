#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const tempDir = await mkdtemp(path.join(tmpdir(), "xiaobao-vaccine-status-"));
try {
  const out = path.join(tempDir, "s.mjs");
  await build({ entryPoints: [path.join(rootDir, "frontend/src/vaccineStatus.ts")], bundle: true, platform: "node", format: "esm", outfile: out, logLevel: "silent" });
  const { computeDoseStatus, vaccineDosesForRegion, pendingCount } = await import(pathToFileURL(out).href);

  const w = { ageMonthMin: 2, ageMonthMax: 4 };
  assert.equal(computeDoseStatus({ ageMonths: 6, ...w, doneDate: "2026-06-01" }), "done", "有日期=done");
  assert.equal(computeDoseStatus({ ageMonths: 6, ...w, doneDate: null }), "overdue", "过窗未打=overdue");
  assert.equal(computeDoseStatus({ ageMonths: 2, ...w, doneDate: null }), "due", "窗口前段(剩>1月)=due");
  assert.equal(computeDoseStatus({ ageMonths: 3, ...w, doneDate: null }), "closing", "剩正好1月(≤1,设计稿边界)=closing");
  assert.equal(computeDoseStatus({ ageMonths: 4, ...w, doneDate: null }), "closing", "窗口末月(剩0)=closing");
  assert.equal(computeDoseStatus({ ageMonths: 1, ...w, doneDate: null }), "upcoming", "未到窗口=upcoming");
  assert.equal(computeDoseStatus({ ageMonths: null, ...w, doneDate: null }), "upcoming", "无生日=upcoming");

  // 区域叠加:national + 选中省的 provincial,过滤掉别省
  const doses = [
    { id: "n1", klass: "nip", region: "national" },
    { id: "bj1", klass: "provincial", region: "BJ" },
    { id: "sh1", klass: "provincial", region: "SH" },
    { id: "o1", klass: "optional", region: "national" },
  ];
  const bj = vaccineDosesForRegion(doses, "BJ").map((d) => d.id);
  assert.ok(bj.includes("n1") && bj.includes("bj1") && bj.includes("o1") && !bj.includes("sh1"), "BJ 叠加正确");
  const none = vaccineDosesForRegion(doses, "national").map((d) => d.id);
  assert.ok(none.includes("n1") && none.includes("o1") && !none.includes("bj1"), "national 不含任何省增补");

  // 待安排计数 = due + closing + overdue(done/upcoming 不计)
  assert.equal(pendingCount(["done", "due", "closing", "overdue", "upcoming"]), 3, "pendingCount 计 due+closing+overdue");
  assert.equal(pendingCount(["done", "upcoming"]), 0, "无待安排=0");

  console.log("vaccine status tests passed");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
