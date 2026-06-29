#!/usr/bin/env node
// D13 记录类型注册表单测:守护「加 kind 必须加条目」+ 复刻旧 recordEventIconSrc 的映射(防回归)。

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const tempDir = await mkdtemp(path.join(tmpdir(), "xiaobao-record-types-"));
const bundlePath = path.join(tempDir, "recordTypes.mjs");

try {
  await build({
    entryPoints: [path.join(rootDir, "frontend/src/recordTypes.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: bundlePath,
    logLevel: "silent",
  });

  const m = await import(pathToFileURL(bundlePath).href);
  const { RECORD_EVENT_TYPES, recordEventTypeOf, recordEventIconKey, recordEventLabel } = m;

  // RecordEvent.kind 全集(= CareLogEventType + growth + reminder)。新增 kind 时这里和注册表必须同步。
  const KINDS = ["milk", "sleep", "wake", "poop", "solid", "temperature", "soothing", "note", "growth", "reminder"];
  const ICON_KEYS = new Set(["milk", "sleep", "poop", "solid", "temperature", "growth", "reminder", "records"]);

  // 完整性:每个 kind 都有条目,label 非空,iconKey 合法。
  for (const k of KINDS) {
    const def = RECORD_EVENT_TYPES[k];
    assert.ok(def, `RECORD_EVENT_TYPES 缺少 kind「${k}」——加记录类型必须在注册表加一行`);
    assert.ok(typeof def.label === "string" && def.label.length > 0, `${k} 必须有非空 label`);
    assert.ok(ICON_KEYS.has(def.iconKey), `${k} 的 iconKey 非法:${def.iconKey}`);
  }
  assert.equal(Object.keys(RECORD_EVENT_TYPES).length, KINDS.length, "注册表条目数应与 kind 全集一致(不多不少)");

  // 复刻旧 recordEventIconSrc 的 if 链映射(防迁移回归)。
  const ICON_EXPECT = {
    milk: "milk",
    sleep: "sleep",
    wake: "sleep",
    soothing: "sleep",
    poop: "poop",
    solid: "solid",
    temperature: "temperature",
    growth: "growth",
    reminder: "reminder",
    note: "records",
  };
  for (const [kind, iconKey] of Object.entries(ICON_EXPECT)) {
    assert.equal(recordEventIconKey(kind), iconKey, `${kind} 应映射到图标键 ${iconKey}`);
  }

  // 未知 kind 兜底到 note/records(与旧默认 recordsIcon 一致)。
  assert.equal(recordEventTypeOf("totally-unknown").iconKey, "records", "未知 kind 应兜底到 note(records 图标)");
  assert.equal(recordEventLabel("milk"), "喂奶", "label 查表");

  console.log("record types registry tests passed");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
