import { Capacitor, registerPlugin } from "@capacitor/core";

type BarcodeScannerResult = {
  barcode?: string;
  format?: string;
  cancelled?: boolean;
};

type BarcodeScannerPlugin = {
  scan(options?: { prompt?: string }): Promise<BarcodeScannerResult>;
};

const BarcodeScanner = registerPlugin<BarcodeScannerPlugin>("BarcodeScanner");

export const isNativeBarcodeScannerAvailable = () =>
  Capacitor.isNativePlatform() &&
  (Capacitor.getPlatform() === "android" || Capacitor.getPlatform() === "ios") &&
  Capacitor.isPluginAvailable("BarcodeScanner");

export const scanBarcode = async () => {
  const result = await BarcodeScanner.scan({ prompt: "对准商品条形码" });
  if (result.cancelled) return "";
  return result.barcode?.trim() ?? "";
};

export const isBarcodeScanCancel = (error: unknown) =>
  error instanceof Error && /cancel/i.test(error.message);
