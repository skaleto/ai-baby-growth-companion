// 相册分类图标(独立于 albumDomain:逻辑测试用 esbuild 打包 albumDomain,
// 纯逻辑模块不得引入资产文件,否则 esbuild 无 PNG loader 直接红)。
import type { AlbumItemCategory } from "../types";
import growthIcon from "../assets/storybook-icons/growth.png";
import milkIcon from "../assets/storybook-icons/milk.png";
import recordsIcon from "../assets/storybook-icons/records.png";
import reminderIcon from "../assets/storybook-icons/reminder.png";
import sleepIcon from "../assets/storybook-icons/sleep.png";
import temperatureIcon from "../assets/storybook-icons/temperature.png";

export const albumCategoryIconSrc = (category: AlbumItemCategory): string => {
  if (category === "growth") return growthIcon;
  if (category === "feeding") return milkIcon;
  if (category === "sleep") return sleepIcon;
  if (category === "health") return temperatureIcon;
  if (category === "reminder") return reminderIcon;
  return recordsIcon;
};
