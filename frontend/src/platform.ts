// Web↔原生端口层(架构债 D11)。
// 红线:业务代码(尤其 App.tsx)不得直接 import @capacitor/core——平台差异只允许
// 从这里或六个原生封装(nativeAlarm/nativeMediaPicker/mobileUpdates/haptics/
// audioPermission/errorReporting)进出,否则 `if(isNative)` 会重新散落回业务里。
// 守护:tech-debt.md D11 验收 `grep -c "Capacitor\\." frontend/src/App.tsx` 必须为 0。
import { Capacitor } from "@capacitor/core";

export const isNativePlatform = (): boolean => Capacitor.isNativePlatform();

export const getPlatform = (): string => Capacitor.getPlatform();

export const isAndroidPlatform = (): boolean => isNativePlatform() && getPlatform() === "android";

export const isIOSPlatform = (): boolean => isNativePlatform() && getPlatform() === "ios";

export const isPluginAvailable = (name: string): boolean => Capacitor.isPluginAvailable(name);

/** 「我的页/诊断」展示用的运行环境标签。 */
export const platformDisplayLabel = (): string =>
  !isNativePlatform() ? "浏览器预览" : getPlatform() === "ios" ? "iOS App" : "Android App";
