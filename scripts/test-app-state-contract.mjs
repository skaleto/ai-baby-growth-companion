#!/usr/bin/env node
// D10 契约防护单测:normalizeAppStateResponse 的归一化与漂移清单。
// 它是前端唯一的 FE/BE 漂移防护网——后端改字段名/删字段时,这里保证:
// ① App 拿到的集合恒为数组(白屏防护);② 每处偏离都进 problems(驱动 drift 上报)。

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const tempDir = await mkdtemp(path.join(tmpdir(), "xiaobao-state-contract-"));
const bundlePath = path.join(tempDir, "appStateContract.mjs");

try {
  await build({
    entryPoints: [path.join(rootDir, "frontend/src/appStateContract.ts")],
    bundle: true,
    format: "esm",
    platform: "neutral",
    outfile: bundlePath,
  });
  const { normalizeAppStateResponse, APP_STATE_ARRAY_COLLECTIONS } = await import(pathToFileURL(bundlePath).href);

  // 1) 完全合规的响应:零 problems、数据原样通过。
  const good = {
    empty: false,
    state: {
      profile: { nickname: "小宝", birthDate: "2026-02-01" },
      messages: [{ id: "m1", role: "parent", text: "hi" }],
      growthEvents: [], growthMeasurements: [], careLogs: [{ date: "2026-06-12" }],
      reminders: [], memories: [], pendingEffects: [], albumItems: [], expenses: [],
      conversationSummary: null, thinkingEnabled: false, selectedModel: "auto", proTrial: null,
    },
  };
  const goodResult = normalizeAppStateResponse(good);
  assert.equal(goodResult.problems.length, 0, `合规响应不应有 problems:${goodResult.problems.join("; ")}`);
  assert.equal(goodResult.value.state.messages.length, 1);

  // 2) 后端删掉集合字段(empty=false):必须补成 [] 且记账——这就是「白屏」事故的形状。
  const missing = normalizeAppStateResponse({ empty: false, state: { profile: { nickname: "小宝" } } });
  for (const collection of APP_STATE_ARRAY_COLLECTIONS) {
    assert.ok(Array.isArray(missing.value.state[collection]), `${collection} 必须被补成数组`);
  }
  assert.ok(missing.problems.length >= APP_STATE_ARRAY_COLLECTIONS.length, "每个缺失集合都应记账");

  // 3) empty=true 的空响应:补数组但不算漂移(后端合法形态)。
  const emptyResp = normalizeAppStateResponse({ empty: true });
  assert.equal(emptyResp.problems.length, 0, `empty 响应不应记漂移:${emptyResp.problems.join("; ")}`);
  assert.ok(Array.isArray(emptyResp.value.state.albumItems));

  // 4) 字段类型漂移:字符串当数组、数字当昵称——纠正为安全值并记账。
  const drifted = normalizeAppStateResponse({
    empty: false,
    state: { ...good.state, albumItems: "not-an-array", profile: { nickname: 42 }, thinkingEnabled: "yes" },
  });
  assert.deepEqual(drifted.value.state.albumItems, [], "类型错的集合应归一为 []");
  assert.equal(drifted.value.state.thinkingEnabled, false, "类型错的标量应回安全默认值");
  assert.ok(drifted.problems.some((p) => p.includes("albumItems")), "albumItems 漂移应记账");
  assert.ok(drifted.problems.some((p) => p.includes("nickname")), "nickname 漂移应记账");

  // 5) 畸形条目过滤:缺 id 的相册项 / null 项被剔除,合法项保留。
  const dirtyItems = normalizeAppStateResponse({
    empty: false,
    state: { ...good.state, albumItems: [{ id: "a1", kind: "media" }, { kind: "no-id" }, null, "junk"] },
  });
  assert.equal(dirtyItems.value.state.albumItems.length, 1, "只保留有 id 的合法项");
  assert.equal(dirtyItems.value.state.albumItems[0].id, "a1");
  assert.ok(dirtyItems.problems.some((p) => p.includes("dropped 3/4")), "过滤数量应记账");

  // 6) careLogs 以 date 定位(没有 id 也合法)。
  const care = normalizeAppStateResponse({
    empty: false,
    state: { ...good.state, careLogs: [{ date: "2026-06-12" }, { feedings: [] }] },
  });
  assert.equal(care.value.state.careLogs.length, 1, "careLogs 保留有 date 的项");

  // 7) 整个响应不是对象(网关 502 文本之类):安全空态 + 记账,绝不抛。
  const garbage = normalizeAppStateResponse("Bad Gateway");
  assert.equal(garbage.value.empty, true);
  assert.ok(Array.isArray(garbage.value.state?.messages ?? []) );
  assert.ok(garbage.problems.length >= 1);

  // 8) 键表守护:types.ts 的 AppStateSnapshot 数组字段必须与权威键表一致(改一处必改两处)。
  const fs = await import("node:fs");
  const typesSource = fs.readFileSync(path.join(rootDir, "frontend/src/types.ts"), "utf8");
  const snapshotBlock = typesSource.slice(typesSource.indexOf("interface AppStateSnapshot"));
  for (const collection of APP_STATE_ARRAY_COLLECTIONS) {
    assert.ok(
      new RegExp(`${collection}: \\w+\\[\\]`).test(snapshotBlock.slice(0, snapshotBlock.indexOf("}"))),
      `AppStateSnapshot 应声明数组字段 ${collection}(键表与类型漂移)`,
    );
  }

  console.log("app state contract tests passed");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
