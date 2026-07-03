#!/usr/bin/env node
// 评审 P8 单测:chatHistoryWindow 的窗口边界。窗口化直接决定长会话渲染量,故把 WINDOW/WINDOW+1
// 边界、展开态、以及「可见集始终含最新一条」(保证流式增量/自动滚动到底不受影响)逐条钉死。

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const tempDir = await mkdtemp(path.join(tmpdir(), "xiaobao-chat-window-"));
const outfile = path.join(tempDir, "chatHistoryWindow.mjs");

const seq = (n) => Array.from({ length: n }, (_, i) => ({ id: `m${i}` }));

try {
  await build({
    entryPoints: [path.join(rootDir, "frontend/src/features/chat/chatHistoryWindow.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    logLevel: "silent",
  });
  const { chatHistoryWindow, CHAT_HISTORY_WINDOW } = await import(pathToFileURL(outfile).href);

  assert.equal(CHAT_HISTORY_WINDOW, 80, "默认窗口 80");

  // 少于/等于窗口:不折叠,可见=全部。
  for (const n of [0, 1, 79, 80]) {
    const { visible, hiddenEarlierCount } = chatHistoryWindow(seq(n), false);
    assert.equal(hiddenEarlierCount, 0, `${n} 条不应折叠`);
    assert.equal(visible.length, n, `${n} 条应全渲染`);
  }

  // 超过窗口:折叠最早的,可见=最近 80 条且含最新。
  const over = chatHistoryWindow(seq(81), false);
  assert.equal(over.hiddenEarlierCount, 1, "81 条应折叠 1 条");
  assert.equal(over.visible.length, 80, "可见 80 条");
  assert.equal(over.visible[0].id, "m1", "折叠掉最早的 m0");
  assert.equal(over.visible[79].id, "m80", "可见集必须含最新一条 m80");

  const big = chatHistoryWindow(seq(500), false);
  assert.equal(big.hiddenEarlierCount, 420, "500 条折叠 420");
  assert.equal(big.visible.length, 80);
  assert.equal(big.visible[big.visible.length - 1].id, "m499", "始终含最新一条");

  // 展开态:不折叠,可见=全部(即便远超窗口)。
  const expanded = chatHistoryWindow(seq(500), true);
  assert.equal(expanded.hiddenEarlierCount, 0, "展开后不折叠");
  assert.equal(expanded.visible.length, 500, "展开后全渲染");

  // 自定义窗口尺寸。
  const custom = chatHistoryWindow(seq(10), false, 3);
  assert.equal(custom.hiddenEarlierCount, 7);
  assert.deepEqual(custom.visible.map((m) => m.id), ["m7", "m8", "m9"]);

  console.log("chat history window tests passed");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
