#!/usr/bin/env node
// 评审 P6 单测:agentContract / authContract 的 FE/BE 契约归一(呼应 test-app-state-contract 的 D10 防线)。
// 后端返回 null / 缺字段 / 畸形条目时,归一化必须降级成「下游可安全 .map/.filter」的形状,杜绝白屏。

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const tempDir = await mkdtemp(path.join(tmpdir(), "xiaobao-api-contract-"));

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
  // ---- agentContract:AgentChatResponse 数组字段恒为数组、aiText 恒为字符串 ----
  const { normalizeAgentChatResponse } = await bundle("frontend/src/agentContract.ts", "agentContract.mjs");
  const AGENT_ARRAYS = ["tags", "reminders", "memories", "expenses", "sources", "safetyAlerts", "effectDecisions", "usedSkills"];

  for (const bad of [null, undefined, 42, "x", []]) {
    const out = normalizeAgentChatResponse(bad);
    assert.equal(out.aiText, "", `畸形输入 ${JSON.stringify(bad)} 的 aiText 应为空串`);
    for (const field of AGENT_ARRAYS) {
      assert.ok(Array.isArray(out[field]), `${field} 应恒为数组(输入 ${JSON.stringify(bad)})`);
      assert.equal(out[field].length, 0, `${field} 应为空数组`);
    }
  }

  // 关键崩溃路径:effectDecisions 为 null → 归一为 [],下游 .filter 安全。
  assert.deepEqual(normalizeAgentChatResponse({ effectDecisions: null }).effectDecisions, []);
  assert.deepEqual(normalizeAgentChatResponse({ reminders: undefined }).reminders, []);

  // 正常响应语义不变:数组原样保留,aiText 原样,对象/标量字段透传。
  const ok = normalizeAgentChatResponse({
    aiText: "好的,已记录",
    effectDecisions: [{ type: "careLog" }, { type: "albumItem" }],
    tags: ["记账"],
    growthEvent: { title: "会翻身了" },
    careLogPatch: null,
    traceId: "trace-1",
    model: "deepseek",
  });
  assert.equal(ok.aiText, "好的,已记录");
  assert.equal(ok.effectDecisions.length, 2);
  assert.deepEqual(ok.tags, ["记账"]);
  assert.deepEqual(ok.growthEvent, { title: "会翻身了" }, "对象字段原样透传");
  assert.equal(ok.careLogPatch, null, "null 对象字段不臆造");
  assert.equal(ok.traceId, "trace-1");
  assert.equal(ok.model, "deepseek");

  // ---- authContract:邀请码角色 / 家庭成员的数组与布尔归一 ----
  const { normalizeInviteRoleOptions, normalizeFamilyMembers } = await bundle(
    "frontend/src/authContract.ts",
    "authContract.mjs",
  );

  // 邀请码角色:三组数组恒为字符串数组,existingMember 恒布尔,member 缺失/畸形 → null。
  for (const bad of [null, undefined, {}, "x"]) {
    const out = normalizeInviteRoleOptions(bad);
    assert.equal(out.familyName, "");
    for (const field of ["occupiedRoles", "uniqueRoles", "repeatableRoles"]) {
      assert.deepEqual(out[field], [], `${field} 应为空数组(输入 ${JSON.stringify(bad)})`);
    }
    assert.equal(out.existingMember, false);
    assert.equal(out.member, null);
  }
  // 崩溃路径:occupiedRoles 为 null → [],下游 .filter 安全;非字符串条目被剔除。
  assert.deepEqual(normalizeInviteRoleOptions({ occupiedRoles: null }).occupiedRoles, []);
  assert.deepEqual(normalizeInviteRoleOptions({ occupiedRoles: ["爸爸", 5, null, "妈妈"] }).occupiedRoles, ["爸爸", "妈妈"]);
  const existing = normalizeInviteRoleOptions({
    familyName: "小宝家",
    existingMember: 1,
    member: { roleName: "爷爷", caregiver: 1 },
  });
  assert.equal(existing.familyName, "小宝家");
  assert.equal(existing.existingMember, true, "真值应归一为 true");
  assert.deepEqual(existing.member, { roleName: "爷爷", caregiver: true });
  assert.equal(normalizeInviteRoleOptions({ member: "garbage" }).member, null, "非对象 member → null");

  // 家庭成员:members 恒为数组,剔除非对象条目;canManage 恒布尔。
  for (const bad of [null, undefined, {}, "x", { members: null }]) {
    const out = normalizeFamilyMembers(bad);
    assert.ok(Array.isArray(out.members), `members 应恒为数组(输入 ${JSON.stringify(bad)})`);
    assert.equal(out.members.length, 0);
    assert.equal(out.canManage, false);
  }
  const fam = normalizeFamilyMembers({ members: [{ userId: "1" }, null, "x", 3], canManage: 1 });
  assert.equal(fam.members.length, 1, "非对象条目被剔除");
  assert.equal(fam.members[0].userId, "1");
  assert.equal(fam.canManage, true);

  console.log("api contract normalization tests passed");
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
