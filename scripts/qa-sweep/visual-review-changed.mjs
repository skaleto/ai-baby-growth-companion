#!/usr/bin/env node
// 只在"有变更截图"时才烧 LLM 视觉复审;变更集为空(没变)直接跳过——这正是基线闸门省钱的点。
import { readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const changedDir = path.join(rootDir, ".verification/acceptance/_changed");
let pngs = [];
try { pngs = (await readdir(changedDir)).filter((f) => f.endsWith(".png")); } catch {}
if (!pngs.length) { console.log("变更集为空(无截图变化),跳过 LLM 视觉复审。"); process.exit(0); }
console.log(`变更集 ${pngs.length} 张,送 vision-review 复审…`);
const child = spawn("node", [path.join(rootDir, "scripts/vision-review.mjs"), changedDir], { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
