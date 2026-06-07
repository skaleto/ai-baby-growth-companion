import { Capacitor, registerPlugin } from "@capacitor/core";
import type { AttachmentKind } from "./types";

export type NativePickedMediaItem = {
  uri: string;
  webPath?: string;
  name?: string;
  mimeType?: string;
  kind?: AttachmentKind;
  size?: number;
  width?: number;
  height?: number;
  durationMs?: number;
  capturedAt?: string;
};

export type NativePickedMediaFile = File & {
  capturedAt?: string;
};

type NativeMediaPickerResult = {
  items?: NativePickedMediaItem[];
};

type NativeMediaPickerPlugin = {
  pickMedia(options: { limit?: number }): Promise<NativeMediaPickerResult>;
};

const NativeMediaPicker = registerPlugin<NativeMediaPickerPlugin>("NativeMediaPicker");

export const isNativeMediaPickerAvailable = () =>
  Capacitor.isNativePlatform() &&
  (Capacitor.getPlatform() === "ios" || Capacitor.getPlatform() === "android") &&
  Capacitor.isPluginAvailable("NativeMediaPicker");

const fallbackName = (item: NativePickedMediaItem, index: number) => {
  const extension = item.mimeType?.includes("quicktime")
    ? "mov"
    : item.mimeType?.startsWith("video/")
      ? "mp4"
      : item.mimeType?.includes("png")
        ? "png"
        : "jpg";
  return `media-${index + 1}.${extension}`;
};

export async function nativePickedMediaToFile(item: NativePickedMediaItem, index: number): Promise<File> {
  const sources = [item.webPath, Capacitor.convertFileSrc(item.uri), item.uri]
    .filter((source): source is string => Boolean(source))
    .filter((source, sourceIndex, list) => list.indexOf(source) === sourceIndex);

  let lastError: unknown;
  for (const source of sources) {
    try {
      const response = await fetch(source);
      if (!response.ok && response.status !== 0) throw new Error(`无法读取本地素材（${response.status}）`);
      const blob = await response.blob();
      const mimeType = item.mimeType || blob.type || "application/octet-stream";
      const name = item.name?.trim() || fallbackName({ ...item, mimeType }, index);
      const capturedAtMs = item.capturedAt ? Date.parse(item.capturedAt) : NaN;
      const file = new File([blob], name, {
        type: mimeType,
        lastModified: Number.isNaN(capturedAtMs) ? Date.now() : capturedAtMs,
      }) as NativePickedMediaFile;
      if (item.capturedAt) {
        Object.defineProperty(file, "capturedAt", {
          configurable: true,
          enumerable: false,
          value: item.capturedAt,
        });
      }
      return file;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("无法读取本地素材");
}

export async function pickNativeMediaFiles(options: { limit: number }) {
  const result = await NativeMediaPicker.pickMedia({ limit: options.limit });
  const items = Array.isArray(result.items) ? result.items : [];
  const files = await Promise.all(items.map(nativePickedMediaToFile));
  return files.filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"));
}

export const isNativeMediaPickerCancel = (error: unknown) =>
  /cancel|cancelled|canceled|用户取消|已取消/i.test(error instanceof Error ? error.message : String(error));
