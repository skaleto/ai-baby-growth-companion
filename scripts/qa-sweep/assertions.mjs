const F = (seed, check, ok, detail = "") => ({ seed, check, ok, detail });

async function gotoTab(page, name) {
  await page.getByRole("button", { name }).last().click();
  await page.waitForTimeout(150);
}
async function visibleText(page, re) {
  try { return await page.getByText(re).first().isVisible({ timeout: 2000 }); } catch { return false; }
}

// 富:数据渲染 + 无 console 错 + 无溢出(溢出由驱动的 checkLayout 兜,这里查数据可见)
export async function assertRich(page, ctx) {
  const out = [];
  await gotoTab(page, "账本");
  out.push(F("caregiver-rich", "账本-数据可见", await visibleText(page, /奶粉|268/), "种子里有一笔奶粉支出"));
  await gotoTab(page, "记录");
  out.push(F("caregiver-rich", "无页面级 JS 错误", ctx.pageErrors.length === 0, ctx.pageErrors.join("; ")));
  // console 错误也要真断言——否则上面注释里「无 console 错」只是空话(终审补:harness 采了 consoleErrors 却没人校验)。
  out.push(F("caregiver-rich", "无 console 错误", ctx.consoleErrors.length === 0, ctx.consoleErrors.join("; ")));
  return out;
}

// 空:主要 tab 显示空态文案(暂无/还没有 之类),不崩
export async function assertEmpty(page, ctx) {
  const out = [];
  await gotoTab(page, "记录");
  const recordsEmpty = await visibleText(page, /还没有|暂无|先记一笔|先记录/);
  out.push(F("caregiver-empty", "记录-空态文案", recordsEmpty, "空数据应显示引导而非崩溃"));
  await gotoTab(page, "账本");
  out.push(F("caregiver-empty", "账本-空态不崩", ctx.pageErrors.length === 0, ctx.pageErrors.join("; ")));
  return out;
}

// 只读:手动/AI记录入口隐藏 + 写入入口不可见(抽查)
// 校准说明:app 的移动端导航栏无独立「对话」tab(对话面板在桌面左栏),
// 实际区分照护人 vs 仅查看的是:记录页写入按钮(手动记录/AI 自动记录)是否存在。
export async function assertViewer(page, ctx) {
  const out = [];
  // 记录页写入按钮:照护人有「手动记录」「AI 自动记录」;仅查看应无。
  await gotoTab(page, "记录");
  const writeRecordCount = await page.getByRole("button", { name: /手动记录|AI 自动记录/ }).count();
  out.push(F("viewer-readonly", "记录写入入口隐藏", writeRecordCount === 0, `手动/AI记录按钮数=${writeRecordCount}(仅查看应为 0)`));
  await gotoTab(page, "账本");
  const addExpense = await page.getByRole("button", { name: /记一笔支出|记一笔/ }).count();
  out.push(F("viewer-readonly", "账本写入入口隐藏", addExpense === 0, `记一笔按钮数=${addExpense}(应为 0)`));
  out.push(F("viewer-readonly", "仅查看无写入 PUT", ctx.upserts.length === 0, `upserts=${ctx.upserts.length}(只读不应产生写入)`));
  return out;
}

// 配额用尽:真实文案为「本月免费 AI 体验还剩 <b>N</b> / 10 次」。
// 必须验「还剩 0」这个具体值,不能只验配额行存在——否则 N=8 的「还剩 8 / 10 次」里的「10 次」也会被宽松正则误中(终审纠错)。
export async function assertQuota(page, ctx) {
  const out = [];
  await gotoTab(page, "我的");
  const exhausted = await visibleText(page, /还剩\s*0\b/);
  out.push(F("free-quota-exhausted", "我的页-剩余次数=0", exhausted, "freeCallsRemaining=0 应显示「还剩 0 …次」"));
  return out;
}

export const ASSERTIONS = {
  "caregiver-rich": assertRich,
  "caregiver-empty": assertEmpty,
  "viewer-readonly": assertViewer,
  "free-quota-exhausted": assertQuota,
};
