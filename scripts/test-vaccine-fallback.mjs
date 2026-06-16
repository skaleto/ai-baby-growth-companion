#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const tempDir = await mkdtemp(path.join(tmpdir(), "xiaobao-vaccine-fallback-"));
try {
  const out = path.join(tempDir, "f.mjs");
  await build({ entryPoints: [path.join(rootDir, "frontend/src/data/vaccineSchedule.fallback.ts")], bundle: true, platform: "node", format: "esm", outfile: out, logLevel: "silent" });
  const m = await import(pathToFileURL(out).href);
  const data = m.VACCINE_FALLBACK;
  assert.ok(data && typeof data.version === "string" && typeof data.asOf === "string", "应有 version/asOf");
  assert.ok(Array.isArray(data.doses) && data.doses.length >= 5, "应有 doses");
  const ids = data.doses.map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length, "doseId 必须唯一");
  const REGIONS = new Set(["national", "BJ", "SH", "GD", "ZJ", "JS"]);
  const KLASS = new Set(["nip", "provincial", "optional"]);
  for (const d of data.doses) {
    assert.ok(d.id && d.vaccine && typeof d.doseNo === "number", `字段完备: ${d.id}`);
    assert.ok(d.ageMonthMin <= d.ageMonthMax, `窗口合法: ${d.id}`);
    assert.ok(KLASS.has(d.klass), `klass 合法: ${d.id}`);
    assert.ok(REGIONS.has(d.region), `region 合法: ${d.id}`);
    assert.ok(typeof d.intro === "string" && d.intro, `有简介: ${d.id}`);
  }
  assert.ok(data.doses.some((d) => d.klass === "nip" && d.region === "national"), "应有一类 national");
  assert.ok(data.doses.some((d) => d.klass === "optional"), "应有二类");
  // 价格只对二类(optional),且引用的苗名在 doses 里存在(守护后续内容任务加各省价时不误给一类标价)
  const optionalVacNames = new Set(data.doses.filter((d) => d.klass === "optional").map((d) => d.vaccine));
  for (const p of data.prices) {
    assert.ok(REGIONS.has(p.region), `价格 region 合法: ${p.doseVaccine}`);
    assert.ok(typeof p.price === "number" && p.price > 0, `价格为正: ${p.doseVaccine}`);
    assert.ok(optionalVacNames.has(p.doseVaccine), `价格仅对二类且苗存在: ${p.doseVaccine}`);
  }
  console.log("vaccine fallback dataset tests passed");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
