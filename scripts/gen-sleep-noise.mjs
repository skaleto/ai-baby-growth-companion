#!/usr/bin/env node
// 生成可无缝循环的噪音 WAV(免版税,代码造):white=白噪音,brown≈子宫声,pink≈吹风机。
// 16-bit PCM 单声道 22050Hz 15s。白噪音随机,循环天然无缝。
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const outDir = path.join(rootDir, "frontend/public/sleep-audio");
const SR = 22050, SECONDS = 15, N = SR * SECONDS;

function pcmToWav(samples) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, samples[i] | 0)), 44 + i * 2);
  return buf;
}
const white = () => { const s = new Float32Array(N); for (let i = 0; i < N; i++) s[i] = Math.random() * 2 - 1; return s; };
const brown = () => { const s = new Float32Array(N); let last = 0; for (let i = 0; i < N; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; s[i] = last * 3.5; } return s; };
const pink = () => { const s = new Float32Array(N); let b0 = 0, b1 = 0, b2 = 0; for (let i = 0; i < N; i++) { const w = Math.random() * 2 - 1; b0 = 0.997 * b0 + 0.0299 * w; b1 = 0.985 * b1 + 0.0750 * w; b2 = 0.950 * b2 + 0.1538 * w; s[i] = (b0 + b1 + b2 + 0.18 * w) * 0.5; } return s; };
const toI16 = (f) => { const o = new Int16Array(f.length); for (let i = 0; i < f.length; i++) o[i] = f[i] * 9000; return o; };

await mkdir(outDir, { recursive: true });
for (const [key, gen] of [["white", white], ["womb", brown], ["fan", pink]]) {
  await writeFile(path.join(outDir, `${key}.wav`), pcmToWav(toI16(gen())));
  console.log("wrote", key + ".wav");
}
console.log("sleep noise generated");
