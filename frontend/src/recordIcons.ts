// 记录类型的图标资产绑定(独立于 recordTypes 纯逻辑:逻辑测试用 esbuild 打包 recordTypes,
// 纯模块不得引入 PNG,否则 esbuild 无 loader 直接红——同 components/albumIcons.ts 的分离范式)。
import { recordEventIconKey, type RecordEventKind, type RecordIconKey } from "./recordTypes";
import growthIcon from "./assets/storybook-icons/growth.png";
import milkIcon from "./assets/storybook-icons/milk.png";
import poopIcon from "./assets/storybook-icons/poop.png";
import recordsIcon from "./assets/storybook-icons/records.png";
import reminderIcon from "./assets/storybook-icons/reminder.png";
import sleepIcon from "./assets/storybook-icons/sleep.png";
import solidIcon from "./assets/storybook-icons/solid.png";
import temperatureIcon from "./assets/storybook-icons/temperature.png";

const ICON_BY_KEY: Record<RecordIconKey, string> = {
  milk: milkIcon,
  sleep: sleepIcon,
  poop: poopIcon,
  solid: solidIcon,
  temperature: temperatureIcon,
  growth: growthIcon,
  reminder: reminderIcon,
  records: recordsIcon,
};

/** 时间线事件 → 图标资产 URL(替代 App.tsx 旧的 recordEventIconSrc if 链)。 */
export const recordEventIconSrc = (kind: RecordEventKind): string => ICON_BY_KEY[recordEventIconKey(kind)];
