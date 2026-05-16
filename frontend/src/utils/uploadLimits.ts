import type { AttachmentKind } from "../types";

export const MAX_IMAGE_UPLOAD_BYTES = 100 * 1024 * 1024;
export const MAX_VIDEO_UPLOAD_BYTES = 300 * 1024 * 1024;
export const MAX_CHAT_ATTACHMENTS = 8;
export const MAX_ALBUM_PICKER_ATTACHMENTS = 20;
export const MAX_AGENT_ATTACHMENT_DATA_URL_CHARS = 8 * 1024 * 1024;
export const AGENT_IMAGE_TARGET_CHARS_SINGLE = 4 * 1024 * 1024;
export const AGENT_IMAGE_TARGET_CHARS_SMALL_BATCH = 2 * 1024 * 1024;
export const AGENT_IMAGE_TARGET_CHARS_LARGE_BATCH = 1400 * 1024;
export const AGENT_IMAGE_MAX_EDGE_SINGLE = 2200;
export const AGENT_IMAGE_MAX_EDGE_BATCH = 1800;
export const VIDEO_THUMBNAIL_TIMEOUT_MS = 8000;

export const maxMediaUploadBytes = (kind: AttachmentKind) =>
  kind === "video" ? MAX_VIDEO_UPLOAD_BYTES : MAX_IMAGE_UPLOAD_BYTES;

export const formatFileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
};
