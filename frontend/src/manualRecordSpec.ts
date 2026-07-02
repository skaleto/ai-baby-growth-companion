// 手动记录(喂奶 / 睡眠 / 便便 / 体温 / 辅食)的每类配置 + 保存校验的单一来源(评审 P5)。
//
// 原本散在 App.tsx 上帝文件里的:可手动记录的类型清单、各类快捷预设、草稿默认 note、以及保存前
// 的 if 链校验,统一收敛到这一处纯模块。加一种手动记录类型 = 在此加一条(其录入 UI 分区因布局各异
// ——奶量是步进+快捷、睡眠是时长步进、体温是温度步进、便便/辅食是状态选择——仍留在
// RecordsEntryDrawer 按 kind 渲染,数据从这里透传)。纯模块:不引 React / 资产,可被逻辑测试打包。
import type { CareLogEventType } from "./types";
import type { ManualRecordKind, ManualRecordTypeOption } from "./appContracts";

// 手动记录抽屉里可选的记录类型(CareLogEventType 的子集 milk/sleep/poop/temperature/solid)。
export const MANUAL_RECORD_TYPES: ManualRecordTypeOption[] = [
  { type: "milk", label: "喂奶", hint: "奶量、亲喂或配方奶" },
  { type: "sleep", label: "睡眠", hint: "睡了多久、醒来情况" },
  { type: "poop", label: "便便尿布", hint: "便便、尿布状态" },
  { type: "temperature", label: "体温", hint: "测量温度" },
  { type: "solid", label: "辅食", hint: "辅食品类和接受度" },
];

// 各类的快捷预设(RecordsEntryDrawer 的 chips / stepper 复用)。
export const MANUAL_TIME_PRESETS = [
  { label: "现在", offsetMinutes: 0 },
  { label: "15 分钟前", offsetMinutes: 15 },
  { label: "30 分钟前", offsetMinutes: 30 },
  { label: "1 小时前", offsetMinutes: 60 },
];

export const MANUAL_MILK_AMOUNTS = [60, 90, 120, 150, 180];
export const MANUAL_MILK_NOTES = ["母乳", "配方奶", "亲喂", "混合喂养"];
export const MANUAL_SLEEP_DURATIONS = [
  { label: "20 分钟", value: "0.33" },
  { label: "30 分钟", value: "0.5" },
  { label: "45 分钟", value: "0.75" },
  { label: "1 小时", value: "1" },
  { label: "1.5 小时", value: "1.5" },
  { label: "2 小时", value: "2" },
];
export const MANUAL_TEMPERATURE_OPTIONS = [36.5, 36.8, 37.0, 37.3, 37.5, 38.0];
export const MANUAL_POOP_NOTES = ["尿布偏湿", "尿布很满", "黄色软便", "绿色便便", "干硬便便"];
export const MANUAL_SOLID_NOTES = ["米粉少量", "南瓜泥", "苹果泥", "胡萝卜泥", "接受度不错", "少量尝试"];

// 草稿初值的默认 note:仅便便 / 辅食预选首项(与原 createCareEventDraft 的三元一致)。
export const manualCareNoteDefault = (type: CareLogEventType): string =>
  type === "poop" ? MANUAL_POOP_NOTES[0] : type === "solid" ? MANUAL_SOLID_NOTES[0] : "";

// 保存手动记录前的字段校验:命中返回中文错误文案(与原 App.tsx 的 if 链逐条等价),通过返回 null。
// 入参是已从草稿解析出的可选数值 + 已 trim 的 note,保持与原 saveManualCareEvent 相同的判定口径。
export const manualCareValidationError = (
  kind: ManualRecordKind,
  values: { amountMl?: number; durationHours?: number; temperature?: number; note: string },
): string | null => {
  if (
    kind === "milk" &&
    (typeof values.amountMl !== "number" || !Number.isFinite(values.amountMl) || values.amountMl <= 0)
  ) {
    return "请输入这次喂奶的奶量。";
  }
  if (
    kind === "sleep" &&
    (typeof values.durationHours !== "number" || !Number.isFinite(values.durationHours) || values.durationHours <= 0)
  ) {
    return "请输入这段睡眠的时长。";
  }
  if (
    kind === "temperature" &&
    (typeof values.temperature !== "number" ||
      !Number.isFinite(values.temperature) ||
      values.temperature < 34 ||
      values.temperature > 42)
  ) {
    return "请输入 34-42°C 之间的体温。";
  }
  if ((kind === "poop" || kind === "solid") && !values.note) {
    return "请选择这次记录的状态。";
  }
  return null;
};
