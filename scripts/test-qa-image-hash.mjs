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
// 像素 diff:同图 0,改了约 25%(64/256),尺寸不同视为全变 1。band 留宽以防 pixelmatch 小版本 AA 计数微调。
assert.equal(pixelDiffRatio(blackBuf, blackBuf), 0, "同图像素 diff 0");
const ratio = pixelDiffRatio(blackBuf, patchedBuf);
assert.ok(ratio > 0.15 && ratio < 0.35, `改 64/256 像素 ≈25%,实得 ${ratio}`);
assert.equal(pixelDiffRatio(blackBuf, toBuf(solid(8, 8, 0, 0, 0))), 1, "尺寸不同=全变 1");
console.log("qa image-hash tests passed");
