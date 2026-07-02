#!/usr/bin/env node
// 评审 P5 单测:manualRecordSpec 的手动记录校验/默认 note,与 appStateDomain 护理标题的单一来源。
// 这两块从 App.tsx 上帝文件抽出并数据驱动,校验直接守护「生产端手动记账」链路,故逐条钉死其判定口径。

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const tempDir = await mkdtemp(path.join(tmpdir(), "xiaobao-manual-record-spec-"));

const bundle = async (entry, name) => {
  const outfile = path.join(tempDir, name);
  await build({
    entryPoints: [path.join(rootDir, entry)],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    logLevel: "silent",
  });
  return import(pathToFileURL(outfile).href);
};

try {
  const spec = await bundle("frontend/src/manualRecordSpec.ts", "manualRecordSpec.mjs");
  const {
    MANUAL_RECORD_TYPES,
    MANUAL_POOP_NOTES,
    MANUAL_SOLID_NOTES,
    manualCareNoteDefault,
    manualCareValidationError,
  } = spec;

  // 手动记录类型清单:恰好 5 种,label/hint 非空。
  const MANUAL_KINDS = ["milk", "sleep", "poop", "temperature", "solid"];
  assert.equal(MANUAL_RECORD_TYPES.length, MANUAL_KINDS.length, "手动记录类型应恰好 5 种");
  for (const kind of MANUAL_KINDS) {
    const def = MANUAL_RECORD_TYPES.find((item) => item.type === kind);
    assert.ok(def, `MANUAL_RECORD_TYPES 缺少 ${kind}`);
    assert.ok(def.label && def.hint, `${kind} 的 label/hint 必须非空`);
  }

  // 默认 note:仅便便/辅食预选首项,其余空串。
  assert.equal(manualCareNoteDefault("poop"), MANUAL_POOP_NOTES[0], "poop 默认 note = 首项");
  assert.equal(manualCareNoteDefault("solid"), MANUAL_SOLID_NOTES[0], "solid 默认 note = 首项");
  for (const kind of ["milk", "sleep", "temperature", "note", "wake", "soothing"]) {
    assert.equal(manualCareNoteDefault(kind), "", `${kind} 默认 note 应为空串`);
  }

  // 校验:与原 App.tsx if 链逐条等价。命中→错误文案,通过→null。
  const err = (kind, values) => manualCareValidationError(kind, { note: "", ...values });
  // milk:奶量必须为有限正数。
  assert.equal(err("milk", {}), "请输入这次喂奶的奶量。");
  assert.equal(err("milk", { amountMl: 0 }), "请输入这次喂奶的奶量。");
  assert.equal(err("milk", { amountMl: -5 }), "请输入这次喂奶的奶量。");
  assert.equal(err("milk", { amountMl: Number.NaN }), "请输入这次喂奶的奶量。");
  assert.equal(err("milk", { amountMl: 120 }), null);
  assert.equal(err("milk", { amountMl: 120, note: "" }), null, "milk 不要求 note");
  // sleep:时长必须为有限正数。
  assert.equal(err("sleep", {}), "请输入这段睡眠的时长。");
  assert.equal(err("sleep", { durationHours: 0 }), "请输入这段睡眠的时长。");
  assert.equal(err("sleep", { durationHours: 1.5 }), null);
  // temperature:必须为 34~42 的有限数(含端点)。
  assert.equal(err("temperature", {}), "请输入 34-42°C 之间的体温。");
  assert.equal(err("temperature", { temperature: 33.9 }), "请输入 34-42°C 之间的体温。");
  assert.equal(err("temperature", { temperature: 42.1 }), "请输入 34-42°C 之间的体温。");
  assert.equal(err("temperature", { temperature: 34 }), null, "34 是下端点应通过");
  assert.equal(err("temperature", { temperature: 42 }), null, "42 是上端点应通过");
  assert.equal(err("temperature", { temperature: 37 }), null);
  // poop / solid:必须选状态(note 非空)。
  assert.equal(err("poop", { note: "" }), "请选择这次记录的状态。");
  assert.equal(err("poop", { note: "黄色软便" }), null);
  assert.equal(err("solid", { note: "" }), "请选择这次记录的状态。");
  assert.equal(err("solid", { note: "米粉少量" }), null);

  // 护理标题单一来源:CARE_EVENT_TITLES 与 canonicalCareEventTitle 完全一致(等价重构不改文案)。
  const domain = await bundle("frontend/src/appStateDomain.ts", "appStateDomain.mjs");
  const { CARE_EVENT_TITLES, canonicalCareEventTitle } = domain;
  const EXPECTED = {
    milk: "喝奶",
    sleep: "睡觉",
    wake: "醒来",
    poop: "便便",
    solid: "辅食",
    temperature: "体温",
    soothing: "哄睡",
    note: "照护记录",
  };
  for (const [kind, label] of Object.entries(EXPECTED)) {
    assert.equal(CARE_EVENT_TITLES[kind], label, `CARE_EVENT_TITLES.${kind} 应为 ${label}`);
  }
  // 已知非 note 类型:返回固定标题,忽略 fallback。
  for (const kind of ["milk", "sleep", "wake", "poop", "solid", "temperature", "soothing"]) {
    assert.equal(canonicalCareEventTitle(kind), EXPECTED[kind], `${kind} 标题查表`);
    assert.equal(canonicalCareEventTitle(kind, "别的"), EXPECTED[kind], `${kind} 已知类型应忽略 fallback`);
  }
  // note / 未知类型:fallback || 照护记录。
  assert.equal(canonicalCareEventTitle("note"), "照护记录");
  assert.equal(canonicalCareEventTitle("note", "自定义标题"), "自定义标题");
  assert.equal(canonicalCareEventTitle("totally-unknown"), "照护记录");
  assert.equal(canonicalCareEventTitle("totally-unknown", "兜底"), "兜底");

  console.log("manual record spec + care-title single-source tests passed");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
