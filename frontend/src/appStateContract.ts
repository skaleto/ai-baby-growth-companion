// FE/BE 契约防护(架构债 D10)。
// 背景:前后端异构(TS↔Java)、无 codegen、types.ts 手抄 DTO——后端改字段名/删字段时,
// 前端会静默拿到 undefined 并在深处运行时炸(白屏),mock 测试永远发现不了。
// 本模块在 /api/app/state 水合点做「归一化 + 漂移清单」:
//   - 保证 10 个集合字段恒为数组、畸形条目被过滤(白屏防护,安全降级);
//   - 把每一处偏离作为 problem 返回,由调用方(appStateApi)上报 state_contract_drift。
// 纯模块红线(tech-debt D2 附带规则):会被 esbuild 逻辑测试在 Node 中打包,
// 不得 import React / window / import.meta.env / 资产文件;上报逻辑留在调用方。

type UnknownRecord = Record<string, unknown>;

export type AppStateContractResult = {
  /** 归一化后的响应:形状保证可被 App 安全水合(集合恒为数组,畸形条目已剔除)。 */
  value: { empty: boolean; state: UnknownRecord };
  /** 偏离契约的清单;为空表示完全符合预期。 */
  problems: string[];
};

// 与 types.ts 的 AppStateSnapshot 对齐的权威键表(改 Snapshot 必须同步这里——单测守护)。
export const APP_STATE_ARRAY_COLLECTIONS = [
  "messages",
  "growthEvents",
  "growthMeasurements",
  "careLogs",
  "reminders",
  "memories",
  "pendingEffects",
  "albumItems",
  "expenses",
] as const;

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** 集合条目的最低成立条件:对象 + 可定位主键(careLogs 以 date 定位,其余以 id)。 */
const isViableItem = (collection: string, item: unknown): boolean => {
  if (!isRecord(item)) return false;
  if (collection === "careLogs") return typeof item.date === "string" || typeof item.id === "string";
  return typeof item.id === "string" && item.id.length > 0;
};

export function normalizeAppStateResponse(input: unknown): AppStateContractResult {
  const problems: string[] = [];

  if (!isRecord(input)) {
    problems.push(`response: expected object, got ${input === null ? "null" : typeof input}`);
    return { value: { empty: true, state: {} }, problems };
  }

  if (typeof input.empty !== "boolean") {
    problems.push(`response.empty: expected boolean, got ${typeof input.empty}`);
  }
  const empty = Boolean(input.empty);

  let state: UnknownRecord;
  if (isRecord(input.state)) {
    state = { ...input.state };
  } else {
    // empty=true 时后端可不带 state,不算漂移;empty=false 却没有 state 才是事故。
    if (!empty) problems.push(`response.state: expected object, got ${input.state === null ? "null" : typeof input.state}`);
    state = {};
  }

  for (const collection of APP_STATE_ARRAY_COLLECTIONS) {
    const raw = state[collection];
    if (raw === undefined || raw === null) {
      if (!empty) problems.push(`state.${collection}: missing (expected array)`);
      state[collection] = [];
      continue;
    }
    if (!Array.isArray(raw)) {
      problems.push(`state.${collection}: expected array, got ${typeof raw}`);
      state[collection] = [];
      continue;
    }
    const viable = raw.filter((item) => isViableItem(collection, item));
    if (viable.length !== raw.length) {
      problems.push(`state.${collection}: dropped ${raw.length - viable.length}/${raw.length} malformed item(s)`);
      state[collection] = viable;
    }
  }

  // profile:App 对 undefined 有默认值兜底;但「存在却不是对象/缺关键字段」必须暴露。
  if (state.profile !== undefined) {
    if (!isRecord(state.profile)) {
      problems.push(`state.profile: expected object, got ${typeof state.profile}`);
      delete state.profile;
    } else if (typeof state.profile.nickname !== "string") {
      problems.push(`state.profile.nickname: expected string, got ${typeof state.profile.nickname}`);
    }
  }

  // 标量字段:类型错就纠正为安全值并记账(App 直读这些值,曾因缺失白屏)。
  if (state.thinkingEnabled !== undefined && typeof state.thinkingEnabled !== "boolean") {
    problems.push(`state.thinkingEnabled: expected boolean, got ${typeof state.thinkingEnabled}`);
    state.thinkingEnabled = false;
  }
  if (state.selectedModel !== undefined && typeof state.selectedModel !== "string") {
    problems.push(`state.selectedModel: expected string, got ${typeof state.selectedModel}`);
    delete state.selectedModel;
  }
  if (state.proTrial !== undefined && state.proTrial !== null && !isRecord(state.proTrial)) {
    problems.push(`state.proTrial: expected object|null, got ${typeof state.proTrial}`);
    delete state.proTrial;
  }

  return { value: { empty, state }, problems };
}
