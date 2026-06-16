#!/usr/bin/env node
// 从 frontend/src/data/vaccineSchedule.fallback.ts 的 VACCINE_FALLBACK 生成 backend/data/vaccine-data.json
// (供 OSS 上传)。兜底数据即唯一真源,改了它重跑本脚本再上传 OSS 即可。
import { build } from "esbuild";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outJson = path.join(rootDir, "backend/data/vaccine-data.json");
const tmp = await mkdtemp(path.join(tmpdir(), "vac-json-"));
try {
  const out = path.join(tmp, "f.mjs");
  await build({
    entryPoints: [path.join(rootDir, "frontend/src/data/vaccineSchedule.fallback.ts")],
    bundle: true, platform: "node", format: "esm", outfile: out, logLevel: "silent",
  });
  const m = await import(pathToFileURL(out).href);
  const data = m.VACCINE_FALLBACK;
  if (!data || typeof data.version !== "string" || !Array.isArray(data.doses)) {
    throw new Error("VACCINE_FALLBACK 结构异常");
  }
  await writeFile(outJson, JSON.stringify(data, null, 2) + "\n");
  console.log("OK 已生成 " + outJson);
  console.log(`version=${data.version} asOf=${data.asOf} doses=${data.doses.length} prices=${data.prices.length}`);
} finally {
  await rm(tmp, { recursive: true, force: true });
}
