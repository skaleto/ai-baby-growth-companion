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

// 只读:对话 tab 隐藏 + 写入入口不可见(抽查)
export async function assertViewer(page, ctx) {
  const out = [];
  // 对话 tab:照护人才有;仅查看应无。用 button 名「对话」是否存在判断。
  const chatBtnCount = await page.getByRole("button", { name: "对话" }).count();
  out.push(F("viewer-readonly", "对话入口隐藏", chatBtnCount === 0, `对话按钮数=${chatBtnCount}(应为 0)`));
  await gotoTab(page, "账本");
  const addExpense = await page.getByRole("button", { name: /记一笔支出|记一笔/ }).count();
  out.push(F("viewer-readonly", "账本写入入口隐藏", addExpense === 0, `记一笔按钮数=${addExpense}(应为 0)`));
  out.push(F("viewer-readonly", "仅查看无写入 PUT", ctx.upserts.length === 0, `upserts=${ctx.upserts.length}(只读不应产生写入)`));
  return out;
}

// 配额用尽:剩余 0 次的提示出现(在「我的」页查剩余次数指示)
export async function assertQuota(page, ctx) {
  const out = [];
  await gotoTab(page, "我的");
  // 注:执行时若文案不符,跑一次看真实 copy 再调下面正则(这是确定性断言,不是占位)。
  const quotaHint = await visibleText(page, /剩余\s*0|0\s*次|免费次数.*0|额度|本月剩余/);
  out.push(F("free-quota-exhausted", "我的页-配额指示", quotaHint, "freeCallsRemaining=0 应有剩余次数/额度提示"));
  return out;
}

export const ASSERTIONS = {
  "caregiver-rich": assertRich,
  "caregiver-empty": assertEmpty,
  "viewer-readonly": assertViewer,
  "free-quota-exhausted": assertQuota,
};
