#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const tempDir = await mkdtemp(path.join(tmpdir(), "xiaobao-media-cache-"));
const bundlePath = path.join(tempDir, "mediaCache.mjs");

try {
  await build({
    entryPoints: [path.join(rootDir, "frontend/src/mediaCache.ts")],
    bundle: true,
    format: "esm",
    platform: "neutral",
    outfile: bundlePath,
  });
  const { stableMediaKey, planEviction } = await import(pathToFileURL(bundlePath).href);

  // ---- stableMediaKey:签名轮换必须映射到同一个键 ----
  const signedA =
    "https://bucket.oss-cn-hangzhou.aliyuncs.com/baby-companion/uploads/2026-06-09/photo.jpg?Expires=1778000000&OSSAccessKeyId=AAA&Signature=sig-one";
  const signedB =
    "https://bucket.oss-cn-hangzhou.aliyuncs.com/baby-companion/uploads/2026-06-09/photo.jpg?Expires=1779999999&OSSAccessKeyId=BBB&Signature=sig-two";
  assert.equal(stableMediaKey(signedA), stableMediaKey(signedB), "不同签名的同一对象必须同键");
  assert.equal(
    stableMediaKey(signedA),
    "https://bucket.oss-cn-hangzhou.aliyuncs.com/baby-companion/uploads/2026-06-09/photo.jpg",
    "键应为剥掉 query 的稳定地址",
  );

  // 本地上传路径只保留 pathname(与 stripAttachmentUrlForStorage 行为一致)
  assert.equal(
    stableMediaKey("http://120.55.188.242:8300/api/uploads/2026-06-09/a.jpg?sig=x"),
    "/api/uploads/2026-06-09/a.jpg",
  );

  // data: / blob: / 空值不缓存
  assert.equal(stableMediaKey("data:image/png;base64,xxxx"), null);
  assert.equal(stableMediaKey("blob:https://localhost/abc"), null);
  assert.equal(stableMediaKey(undefined), null);
  assert.equal(stableMediaKey(""), null);

  // ---- planEviction:LRU 按 lastUsed 从旧到新淘汰,直到不超额 ----
  const entries = [
    { key: "old", bytes: 100, lastUsed: 1 },
    { key: "mid", bytes: 100, lastUsed: 2 },
    { key: "new", bytes: 100, lastUsed: 3 },
  ];
  assert.deepEqual(planEviction(entries, 300), [], "未超额不淘汰");
  assert.deepEqual(planEviction(entries, 250), ["old"], "超额先淘汰最旧");
  assert.deepEqual(planEviction(entries, 150), ["old", "mid"], "持续淘汰直到达标");
  assert.deepEqual(planEviction(entries, 0), ["old", "mid", "new"], "上限 0 全部淘汰");
  assert.deepEqual(planEviction([], 100), [], "空集合无淘汰");

  console.log("media cache key + LRU eviction tests passed");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
