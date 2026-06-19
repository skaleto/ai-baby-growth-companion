// 纯函数图像指纹:sha256(精确相等)、aHash(8×8 灰度平均哈希,抗微小渲染抖动)、像素 diff 比例。
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

export function sha256(buf) { return createHash("sha256").update(buf).digest("hex"); }

// aHash(平均哈希,注意:不是 DCT 的 pHash):解码 → 缩到 8×8 灰度 → 高于全图均值=1。返回 16 位十六进制(64 bit)。
// 汉明阈值按本实现经验定(QA_VISUAL_AHASH),不要直接套 pHash 文献的阈值。
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
