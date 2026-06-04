#!/usr/bin/env node
import assert from "node:assert/strict";

import { evaluateStructural } from "./l2-benchmark/assertions.mjs";

const scenario = {
  expect: {
    noEffectMutation: true,
    aiTextAssertions: [
      { op: "contains", value: "社区医院疫苗预约" },
      { op: "notContains", value: "我再帮你设置" },
      { op: "notContains", value: "这个提醒想定" },
    ],
  },
};

const bad = evaluateStructural(
  scenario,
  {
    aiText: "今天有一个提醒：社区医院疫苗预约。\n\n这个提醒想定在什么时候？告诉我具体时间后，我再帮你设置。",
    effectDecisions: [],
  },
  [],
);

assert.equal(bad.pass, false, "bad read-only aiText must fail hard assertions");
assert.ok(bad.checks.some((check) => check.label.includes("aiText notContains") && !check.pass));

const good = evaluateStructural(
  scenario,
  {
    aiText: "今天有一个提醒：社区医院疫苗预约，时间是今天 15:30。目前我不会新增或修改提醒。",
    effectDecisions: [],
  },
  [],
);

assert.equal(good.pass, true, "good read-only aiText should pass hard assertions");

console.log("L2 assertion tests passed");
