import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

const runNativeHaptic = (task: () => Promise<void>) => {
  if (!Capacitor.isNativePlatform()) return;
  void task().catch(() => undefined);
};

export const hapticSelection = () => {
  runNativeHaptic(async () => {
    await Haptics.selectionStart();
    await Haptics.selectionChanged();
    await Haptics.selectionEnd();
  });
};

export const hapticLight = () => {
  runNativeHaptic(() => Haptics.impact({ style: ImpactStyle.Light }));
};

export const hapticMedium = () => {
  runNativeHaptic(() => Haptics.impact({ style: ImpactStyle.Medium }));
};

export const hapticSuccess = () => {
  runNativeHaptic(() => Haptics.notification({ type: NotificationType.Success }));
};

export const hapticWarning = () => {
  runNativeHaptic(() => Haptics.notification({ type: NotificationType.Warning }));
};
