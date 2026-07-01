#!/usr/bin/env node
// 架构适应度守卫(architecture fitness function)——防「上帝类/上帝文件」复发 + 强制分层单向依赖。
//
// 背景:2026-07 大拆分轮把 App.tsx 从 9690→3684 行(上帝类 → 容器 + 8 个领域 hook + 视图组件 + appContracts 类型层)。
// 光靠「App.tsx 一个文件的行数棘轮」(test-product-simplification 里的 APP_TSX_LINE_CEILING)不够——任何文件都可能长成新的上帝类。
// 本守卫把纪律泛化到整个 frontend/src,接进 verify:frontend 当 CI 门。见 docs/architecture/cross-platform-principles.md §5。
//
// 业界对标(调研现成前端仓库规范):
//   - ESLint:max-lines / max-lines-per-function / complexity(文件与函数体量硬上限)
//   - import/no-cycle、dependency-cruiser、eslint-plugin-boundaries(禁循环依赖 + 分层边界规则)
//   - 《Building Evolutionary Architectures》的 architecture fitness functions(把架构约束写成可执行、进 CI 的测试)
// 本仓库无 ESLint / dependency-cruiser,沿用既有 scripts/test-*.mjs 的 fitness-function 风格:零重依赖、直接编码本轮成果与教训。
//
// 三条规则:
//   R1 文件行数棘轮:frontend/src 下每个文件 ≤ 其上限(已知大文件在 CEILINGS 里逐个钉死,其余默认 ≤ DEFAULT_MAX)。
//      只许降不许升。合理新增导致某文件涨:在同一改动里把它的上限「有意识」调到新值并注明;新文件超 DEFAULT_MAX:要么拆,要么登记进 CEILINGS。
//   R2 分层单向依赖:features/** 与 screens/** 不得从 "App" import(值或类型)。共享类型走 appContracts,共享逻辑走 utils/features。
//      强制「容器 App → 功能 hook → 视图组件」单向依赖,消灭反向依赖与环(本轮已把这个数从 6 降到 0)。
//   R3 useState 密度:单文件 useState 调用数 ≤ USESTATE_MAX(上帝类最直观信号——拆分前 App.tsx 有 104 个)。

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const SRC = "frontend/src";

// ── R1:文件行数上限(split("\n").length,与 test-product-simplification 棘轮同口径)。只许降不许升。
const DEFAULT_MAX = 400;
// 当前 > DEFAULT_MAX 的文件,逐个钉在当前行数(2026-07-01 大拆分收尾态)。降了就把这里也调低。
const CEILINGS = {
  "App.tsx": 3685, // 容器/编排根(9690→3684,仍是最大文件;继续降是好事,但已非上帝类)
  "features/chat/useChatState.ts": 1878, // chat 逻辑 hook(最大功能簇,后续可再分 voice/media 子 hook)
  "appStateDomain.ts": 1024,
  "screens/ChatScreen.tsx": 1001,
  "screens/RecordsScreen.tsx": 789,
  "features/preview/usePreviewState.ts": 606,
  "features/session/useSessionState.ts": 600,
  "screens/ProfileScreen.tsx": 547,
  "screens/RecordsEntryDrawer.tsx": 536,
  "albumPhotoSwipe.ts": 491,
  "types.ts": 462,
  "screens/RemindersScreen.tsx": 439,
  "features/records/useRecordsState.ts": 437,
  "views/LedgerView.tsx": 432,
  "albumDomain.ts": 417,
  "mediaCache.ts": 416,
  "features/pendingEffects/usePendingEffects.ts": 412,
};

// ── R2:这些目录下的文件禁止从 App import(单向依赖)。
const LAYER_NO_APP_IMPORT = ["features", "screens", "views", "components"];

// ── R3:单文件 useState 上限(上帝类信号)。当前最高 useSessionState=34。
const USESTATE_MAX = 40;

const walk = (dir, acc = []) => {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx)$/.test(entry)) acc.push(p);
  }
  return acc;
};

const files = walk(SRC);
const rel = (f) => f.slice(SRC.length + 1);
const violations = [];

for (const file of files) {
  const r = rel(file);
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n").length;

  // R1
  const cap = CEILINGS[r] ?? DEFAULT_MAX;
  if (lines > cap) {
    violations.push(
      `R1 行数超限:${r} = ${lines} 行 > 上限 ${cap}。` +
        (CEILINGS[r]
          ? `拆出代码后请把 CEILINGS["${r}"] 调到新行数;确需扩张则有意识上调并注明原因(防上帝类复发)。`
          : `新文件超默认上限 ${DEFAULT_MAX}——拆成更小的内聚单元,或显式登记进 test-architecture-guard 的 CEILINGS 并注明。`),
    );
  }

  // R2
  if (LAYER_NO_APP_IMPORT.some((d) => r.startsWith(d + "/"))) {
    // 忽略注释/字符串里的 "App";只看真实 import 语句(含多行 import type 的收尾)。
    const importsApp = /(^|\n)\s*import\s[\s\S]*?from\s+["'](\.\.\/)+App["']/.test(src) ||
      /(^|\n)\s*}\s+from\s+["'](\.\.\/)+App["']/.test(src) && /import\s+type\s*{[\s\S]*?}\s+from\s+["'](\.\.\/)+App["']/.test(src);
    if (importsApp) {
      violations.push(
        `R2 反向依赖:${r} 从 "App" import——功能/视图层不得依赖容器 App(会成环/耦合)。` +
          `共享类型放 appContracts.ts,共享逻辑放 utils/ 或对应 feature。`,
      );
    }
  }

  // R3
  const useStateCount = (src.match(/useState[<(]/g) || []).length;
  if (useStateCount > USESTATE_MAX) {
    violations.push(
      `R3 useState 密度:${r} 有 ${useStateCount} 个 useState > 上限 ${USESTATE_MAX}——上帝类信号,` +
        `把相关状态+操作内聚进 useXxxState() 领域 hook(见 §3.3「领域 hook」)。`,
    );
  }
}

if (violations.length) {
  console.error("架构守卫失败:\n" + violations.map((v) => "  ✗ " + v).join("\n"));
  assert.fail(`${violations.length} 条架构规则违规(见上)。防上帝类复发:拆分 / 归位 / 或有意识调棘轮并注明。`);
}

console.log(
  `architecture guard passed:${files.length} 文件全部满足 R1 行数棘轮(${Object.keys(CEILINGS).length} 个已登记大文件 + 默认 ≤${DEFAULT_MAX})、` +
    `R2 分层单向依赖(features/screens/views/components 零 App 反向依赖)、R3 useState 密度 ≤${USESTATE_MAX}。`,
);
