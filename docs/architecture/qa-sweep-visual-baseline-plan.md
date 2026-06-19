# 验收巡检 · 视觉基线 diff 闸门 实现计划(ROI #3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development(推荐)或 superpowers:executing-plans 逐任务实现。步骤用 `- [ ]` 勾选。

**Goal:** 给验收巡检补上「签名基线 + 感知 diff 闸门」——把 ROI#2 产出的截图语料先和**人工签过的基线**做 aHash/像素 diff,**只把"变了的/新的"截图喂给已有的 `vision-review.mjs`(LLM)**,避免每次重判全图、防审美结论飘。这是 4 层 oracle 的第②层(程序化视觉)+ 把第③层(LLM)接成"相对基线"而非"绝对评分"。

**Architecture:** 纯前端测试基建。新增一个**纯函数图像模块**(aHash + sha256 + 像素 diff,基于 pure-JS 的 pngjs+pixelmatch,无原生编译)+ 一个**基线/diff 驱动**(accept 模式签基线、diff 模式产出"变更集")。**复用现成的 `scripts/vision-review.mjs`** 评变更集,不重造 LLM 层。**首版不让 LLM 当硬门禁**(vision-review 的 fail-on 保持咨询),先把基线+diff 跑通。

**Tech Stack:** Node ESM、pngjs(纯 JS PNG 编解码)、pixelmatch(纯 JS 像素 diff)、现有 vision-review.mjs(Claude vision)。

**设计来源:** 记忆 `app-acceptance-sweep-design`(Claude×Codex);ROI#1/#2 已落地于 main / `feat/qa-sweep-seed-matrix`。

**现状(踩点):**
- ROI#2 语料:`.verification/acceptance/<seed>/<viewport>__<tab>/screen.png`(64 张)。
- `scripts/vision-review.mjs`:`node scripts/vision-review.mjs <dir>` 评 `<dir>` 顶层的 PNG(不递归),每张出 `{severity: ok|minor|major|broken, summary, issues[]}`,`VISION_REVIEW_FAIL_ON` 默认 major,claude-cli/anthropic-api 双后端。它是**绝对评分**,无基线概念。
- 仓库**无**图像 diff 库(sharp/jimp/pixelmatch/pngjs 都没有)。

---

## File Structure

| 文件 | 职责 | 动作 |
|---|---|---|
| `package.json` | 加 pngjs+pixelmatch 依赖、`qa:visual` / `qa:baseline:accept` 命令 | 修改 |
| `scripts/qa-sweep/image-hash.mjs` | 纯函数:`sha256` / `aHash`(8×8 灰度平均哈希)/ `hamming` / `pixelDiffRatio` | 新建 |
| `scripts/test-qa-image-hash.mjs` | image-hash 单测(自生成 PNG,确定性) | 新建 |
| `scripts/qa-sweep/visual-baseline.mjs` | accept(签基线)/ diff(对比产变更集)两模式 | 新建 |
| `.gitignore` | 确认 `.verification/` 已忽略(基线产物不入库) | 核对 |

**不动:** `scripts/vision-review.mjs`、ROI#2 的 4 个文件。

---

## Task 1: 纯图像模块 `image-hash.mjs` + 单测(TDD)

**Files:** Create `scripts/qa-sweep/image-hash.mjs`, `scripts/test-qa-image-hash.mjs`; Modify `package.json`

- [ ] **Step 1: 装纯 JS 图像库**

Run: `npm install --save-dev pngjs@7 pixelmatch@6`
Expected:装上(纯 JS,无原生编译)。若离线/装不上 → STOP 上报(这是硬前置,不能绕)。验证:`node -e "import('pngjs').then(()=>import('pixelmatch')).then(()=>console.log('img libs ok'))"` 打印 `img libs ok`。

- [ ] **Step 2: 写失败测试** `scripts/test-qa-image-hash.mjs`

```javascript
#!/usr/bin/env node
import assert from "node:assert/strict";
import { PNG } from "pngjs";
import { sha256, aHash, hamming, pixelDiffRatio } from "./qa-sweep/image-hash.mjs";

// 自生成两张 16x16 PNG:全黑,以及"右下角一块变白"。
function solid(w, h, r, g, b) {
  const png = new PNG({ width: w, height: h });
  for (let i = 0; i < w * h; i++) { png.data[i * 4] = r; png.data[i * 4 + 1] = g; png.data[i * 4 + 2] = b; png.data[i * 4 + 3] = 255; }
  return png;
}
function toBuf(png) { return PNG.sync.write(png); }
const black = solid(16, 16, 0, 0, 0);
const blackBuf = toBuf(black);
const patched = solid(16, 16, 0, 0, 0);
for (let y = 8; y < 16; y++) for (let x = 8; x < 16; x++) { const i = (y * 16 + x) * 4; patched.data[i] = patched.data[i + 1] = patched.data[i + 2] = 255; }
const patchedBuf = toBuf(patched);

// sha256:同内容同哈希,改了就变。
assert.equal(sha256(blackBuf), sha256(toBuf(solid(16, 16, 0, 0, 0))), "同图 sha256 相等");
assert.notEqual(sha256(blackBuf), sha256(patchedBuf), "改了 sha256 不等");
// aHash:同图距离 0,改了距离 > 0。
assert.equal(hamming(aHash(blackBuf), aHash(blackBuf)), 0, "同图 aHash 距离 0");
assert.ok(hamming(aHash(blackBuf), aHash(patchedBuf)) > 0, "右下变白 aHash 距离 > 0");
// 像素 diff:同图 0,改了约 25%(64/256),尺寸不同视为全变 1。
assert.equal(pixelDiffRatio(blackBuf, blackBuf), 0, "同图像素 diff 0");
const ratio = pixelDiffRatio(blackBuf, patchedBuf);
assert.ok(ratio > 0.2 && ratio < 0.3, `改 64/256 像素 ≈25%,实得 ${ratio}`);
assert.equal(pixelDiffRatio(blackBuf, toBuf(solid(8, 8, 0, 0, 0))), 1, "尺寸不同=全变 1");
console.log("qa image-hash tests passed");
```

- [ ] **Step 3: 跑测试确认失败**

Run: `node scripts/test-qa-image-hash.mjs`
Expected: FAIL(找不到 `image-hash.mjs`)。

- [ ] **Step 4: 写实现** `scripts/qa-sweep/image-hash.mjs`

```javascript
// 纯函数图像指纹:sha256(精确相等)、aHash(8×8 灰度平均哈希,抗微小渲染抖动)、像素 diff 比例。
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

export function sha256(buf) { return createHash("sha256").update(buf).digest("hex"); }

// aHash:解码 → 缩到 8×8 灰度均值 → 高于均值=1。返回 16 位十六进制(64 bit)。
export function aHash(pngBuf) {
  const png = PNG.sync.read(pngBuf);
  const N = 8;
  const cells = new Array(N * N).fill(0);
  for (let gy = 0; gy < N; gy++) {
    for (let gx = 0; gx < N; gx++) {
      const x0 = Math.floor((gx * png.width) / N), x1 = Math.max(x0 + 1, Math.floor(((gx + 1) * png.width) / N));
      const y0 = Math.floor((gy * png.height) / N), y1 = Math.max(y0 + 1, Math.floor(((gy + 1) * png.height) / N));
      let sum = 0, cnt = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = (y * png.width + x) * 4;
        sum += 0.299 * png.data[i] + 0.587 * png.data[i + 1] + 0.114 * png.data[i + 2];
        cnt++;
      }
      cells[gy * N + gx] = cnt ? sum / cnt : 0;
    }
  }
  const avg = cells.reduce((a, b) => a + b, 0) / cells.length;
  let bits = 0n;
  for (let k = 0; k < cells.length; k++) if (cells[k] > avg) bits |= 1n << BigInt(k);
  return bits.toString(16).padStart(16, "0");
}

export function hamming(hexA, hexB) {
  let x = BigInt("0x" + hexA) ^ BigInt("0x" + hexB), d = 0;
  while (x) { d += Number(x & 1n); x >>= 1n; }
  return d;
}

// 像素 diff 比例 [0,1];尺寸不同直接 1(无法逐像素比=全变)。
export function pixelDiffRatio(pngBufA, pngBufB) {
  const a = PNG.sync.read(pngBufA), b = PNG.sync.read(pngBufB);
  if (a.width !== b.width || a.height !== b.height) return 1;
  const total = a.width * a.height;
  const diff = pixelmatch(a.data, b.data, null, a.width, a.height, { threshold: 0.1 });
  return total ? diff / total : 0;
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `node scripts/test-qa-image-hash.mjs`
Expected: PASS `qa image-hash tests passed`。

- [ ] **Step 6: 注册** `package.json` 加 `"test:qa-image-hash": "node scripts/test-qa-image-hash.mjs",`(放 `qa:sweep` 旁)。

- [ ] **Step 7: 提交**

```bash
git add scripts/qa-sweep/image-hash.mjs scripts/test-qa-image-hash.mjs package.json package-lock.json
git commit -m "feat(qa-sweep): 纯图像指纹模块 image-hash(sha256/aHash/像素diff)+ 单测"
```

---

## Task 2: 基线/diff 驱动 `visual-baseline.mjs`

**Files:** Create `scripts/qa-sweep/visual-baseline.mjs`; Modify `package.json`

> 两模式:`accept`(把当前语料签成基线)、`diff`(默认,对比当前 vs 基线,产变更集)。基线存 `.verification/acceptance-baseline/`(manifest + PNG 副本)。变更集是一个**扁平目录** `.verification/acceptance/_changed/`,文件名编码原路径,供 vision-review 评。

- [ ] **Step 1: 写实现** `scripts/qa-sweep/visual-baseline.mjs`

```javascript
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
```

- [ ] **Step 2: 自检 diff 模式(无基线 → 全 no-baseline)**

先确保有语料:`npm run build && npm run qa:sweep`(若 `.verification/acceptance/` 已有 64 张可跳过)。
Run: `node scripts/qa-sweep/visual-baseline.mjs`
Expected:打印 `分布: no-baseline=64`、`送 LLM 复审…64 张`、并提示"还没有基线…"。`.verification/acceptance/_changed/` 下有 64 张扁平 PNG;`visual-diff.json` 生成。

- [ ] **Step 3: 自检 accept → 再 diff(应全 unchanged)**

Run: `node scripts/qa-sweep/visual-baseline.mjs accept`(打印"已签基线:64 张")
再 Run: `node scripts/qa-sweep/visual-baseline.mjs`
Expected:第二次 `分布: unchanged=64`、`送 LLM 复审…0 张`(签完没改→无变更)。贴两次真实输出。

- [ ] **Step 4: 提交**

```bash
git add scripts/qa-sweep/visual-baseline.mjs
git commit -m "feat(qa-sweep): 视觉基线闸门(accept 签基线 / diff 产变更集,aHash+像素双阈值)"
```

---

## Task 3: 接线 `qa:visual` + `qa:baseline:accept`(只把变更集喂给 LLM)

**Files:** Modify `package.json`;核对 `.gitignore`

- [ ] **Step 1: 核对 `.gitignore` 忽略 `.verification/`**

Run: `git check-ignore .verification/acceptance-baseline/baseline-manifest.json`
Expected:打印该路径(已忽略)。否则 `.gitignore` 加 `.verification/`。
> 注:基线 PNG 也在 `.verification/` 下、被忽略——基线是**本地/CI 工件**,不入 git(随 app 改而重签,不该塞进版本库)。

- [ ] **Step 2: `package.json` 加命令**

在 `qa:sweep` 旁加(`qa:visual` 先跑 diff 闸门,再把变更集喂给现成 vision-review):
```json
    "qa:baseline:accept": "node scripts/qa-sweep/visual-baseline.mjs accept",
    "qa:visual": "node scripts/qa-sweep/visual-baseline.mjs && node scripts/vision-review.mjs .verification/acceptance/_changed",
```
> `VISION_REVIEW_FAIL_ON` 默认 major——首版**先让它咨询不阻塞流水线**(即 `qa:visual` 即使报 major 也是给人看,不要接进 CI 硬门禁)。等基线稳定、误报压下来,再考虑让 `major/broken` 阻塞。

- [ ] **Step 3: 全链路自检(贴真实输出)**

依次 Run,贴每条输出:
1. `node scripts/test-qa-image-hash.mjs` → `qa image-hash tests passed`
2. `npm run build && npm run qa:sweep` → 8/8 ✔(产语料)
3. `npm run qa:baseline:accept` → `已签基线:64 张`
4. `npm run qa:visual` → diff 显示 `unchanged=64`、送 LLM `0 张`;vision-review 因 `_changed` 空而无图可评(打印 0 张或"no PNG")——这正是"没变就不烧 LLM"的预期。
> 若步骤 4 里 vision-review 对空目录报错而非优雅退出,在 `qa:visual` 里改成:diff 后用 `node -e` 判 `_changed` 是否有 png,空则跳过 vision-review。执行时按真实行为调,确保空变更集不报错。

- [ ] **Step 4: 提交**

```bash
git add package.json .gitignore
git commit -m "chore(qa-sweep): qa:visual(基线 diff→只评变更集)+ qa:baseline:accept 命令"
```

---

## Self-Review

- **Spec 覆盖**:aHash+sha256+像素 diff 纯模块(T1)✓;签基线 accept(T2)✓;diff 产变更集 + 双阈值 + 报告(T2)✓;只把变更/新增喂 LLM、复用 vision-review 不重造(T3)✓;首版 LLM 不当硬门禁(T3 注)✓;基线是本地工件不入库(T3 注)✓;无基线时的 bootstrap 提示人工签(T2 diff 分支)✓。4 层 oracle:本计划补第②层 + 把第③层接成"相对基线只评变更"。
- **占位扫描**:T3 步骤 4 的"vision-review 对空目录的行为按真实调"是带"跑一次看真实行为再定"的明确确定性步骤,非 TODO 占位。
- **类型一致**:`sha256/aHash/hamming/pixelDiffRatio` 在 T1 定义,T2 一致 import 调用;`baseline-manifest.entries[rel] = {sha256,aHash}` T2 accept 写、diff 读一致;`flatName(rel)` 在 accept(写副本)与 diff(读副本)一致;阈值 env `QA_VISUAL_AHASH/PIXEL` 单处定义。
- **已知边界**:像素 diff 要求基线与当前同尺寸(尺寸变=全变 1,合理);aHash 8×8 抗微抖但对细微文案改不敏感——所以保留 sha256 精确相等做"完全没变"快判 + 像素 diff 兜细节,双阈值取或。未做"LLM 当 CI 硬门禁"(刻意,留稳定后)。
