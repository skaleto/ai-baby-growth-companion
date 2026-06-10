#!/usr/bin/env node
// 大图预览滑动手势的模拟回归测试:短划/快甩/慢拖/纵向/动画中抓住/翻页完成竞态。
// 起因:2026-06-10 「抓住动画」版把『翻页已完成、React 未复位』的整屏残余当成拖动基准,
// 造成「短划好几下不动、划了又缩回去」的线上事故——本测试把这些手势固化为断言。

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const tempDir = await mkdtemp(path.join(tmpdir(), "xiaobao-swipe-math-"));
const bundlePath = path.join(tempDir, "previewSwipeMath.mjs");

try {
  await build({
    entryPoints: [path.join(rootDir, "frontend/src/components/previewSwipeMath.ts")],
    bundle: true,
    format: "esm",
    platform: "neutral",
    outfile: bundlePath,
  });
  const { captureBaseOffset, composeSwipeDelta, resolveSwipeOutcome } = await import(pathToFileURL(bundlePath).href);

  const VW = 390; // iPhone 级视口宽
  const both = () => true;
  const none = () => false;
  const swipe = (over) =>
    resolveSwipeOutcome({ baseOffset: 0, fingerDeltaX: 0, fingerDeltaY: 0, velocityX: 0, viewportWidth: VW, hasAdjacent: both, ...over });

  // ---- captureBaseOffset:何时允许「抓住画面」 ----
  assert.equal(captureBaseOffset(0, VW), 0, "静止时基准为 0");
  assert.equal(captureBaseOffset(3, VW), 0, "微小残余(<2%屏宽)视为静止");
  assert.equal(captureBaseOffset(-150, VW), -150, "动画中段(2%~98%)可抓住,基准=实时位置");
  assert.equal(captureBaseOffset(150, VW), 150, "正向动画中段同样可抓住");
  assert.equal(captureBaseOffset(-VW, VW), 0, "翻页已完成(残余=一整屏)绝不接管——线上事故回归");
  assert.equal(captureBaseOffset(-VW * 0.99, VW), 0, "残余>98% 屏宽按已完成处理");
  assert.equal(captureBaseOffset(Number.NaN, VW), 0, "非法输入安全归零");

  // ---- 基础手势 ----
  assert.deepEqual(
    swipe({ fingerDeltaX: -40, fingerDeltaY: 4, velocityX: -0.6 }),
    { action: "page", direction: 1 },
    "短而快的轻扫(flick)应翻到下一张",
  );
  assert.deepEqual(
    swipe({ fingerDeltaX: 40, fingerDeltaY: -3, velocityX: 0.6 }),
    { action: "page", direction: -1 },
    "反向轻扫应翻到上一张",
  );
  assert.deepEqual(
    swipe({ fingerDeltaX: -30, fingerDeltaY: 2, velocityX: -0.1 }),
    { action: "snap" },
    "短且慢的拖动应回弹(不足以翻页)",
  );
  assert.deepEqual(
    swipe({ fingerDeltaX: -90, fingerDeltaY: 10, velocityX: -0.05 }),
    { action: "page", direction: 1 },
    "慢拖超过 18% 屏宽应翻页",
  );
  assert.deepEqual(
    swipe({ fingerDeltaX: -80, fingerDeltaY: -90, velocityX: -0.2 }),
    { action: "snap" },
    "纵向为主的手势不应横向翻页",
  );
  assert.deepEqual(
    swipe({ fingerDeltaX: -120, fingerDeltaY: 0, velocityX: -0.8, hasAdjacent: none }),
    { action: "snap" },
    "没有相邻图(最后一张)时快甩也只回弹",
  );

  // ---- 线上事故场景:settle 后整屏残余若被当基准,短划会误判为翻页 ----
  const badBase = -VW; // 坏版本会把它当 baseOffset
  const eventDelta = -30; // 用户只是短划 30px(慢)
  assert.deepEqual(
    swipe({ baseOffset: captureBaseOffset(badBase, VW), fingerDeltaX: eventDelta, fingerDeltaY: 2, velocityX: -0.1 }),
    { action: "snap" },
    "翻页完成竞态窗口内短划:基准必须为 0 → 正常回弹(坏版本会整屏漂移误翻页)",
  );

  // ---- 动画中抓住:合成位移贯通判定 ----
  assert.equal(composeSwipeDelta(-150, -50), -200);
  assert.deepEqual(
    swipe({ baseOffset: captureBaseOffset(-150, VW), fingerDeltaX: -50, fingerDeltaY: 4, velocityX: -0.2 }),
    { action: "page", direction: 1 },
    "抓住前进中的动画再补一段:合成位移过阈值 → 继续翻页",
  );
  assert.deepEqual(
    swipe({ baseOffset: captureBaseOffset(-150, VW), fingerDeltaX: 120, fingerDeltaY: 4, velocityX: 0.5 }),
    { action: "snap" },
    "抓住后拖回:合成位移不足且速度与合成方向相反 → 回弹当前张",
  );

  console.log("preview swipe gesture simulation tests passed");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
