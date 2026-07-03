// 领域拆分 P7:从 appStateDomain 抽出的「附件/记录人/相册项」归一化。normalizeAttachment 是多个记录类型的公共依赖。
// 纯模块红线:除 window.location/URL 外不 import 宿主 API;依赖底层 coerce + 外部 data/appOptions/albumDomain,不反向依赖上层 normalize*。
import { todayISO } from "../data";
import { ALBUM_CATEGORY_VALUES } from "../appOptions";
import { dedupeAlbumItems } from "../albumDomain";
import type {
  AlbumPrompt,
  AlbumItem,
  AlbumItemCategory,
  Attachment,
  RecordedBy,
} from "../types";
import { numberValue, stringList, stringMember, textValue } from "./coerce";

export const normalizeAttachment = (value: Partial<Attachment> | null | undefined, index: number): Attachment => ({
  id: textValue(value?.id, `attachment-${index}`),
  name: textValue(value?.name, "附件"),
  kind: value?.kind === "video" || value?.kind === "audio" ? value.kind : "image",
  url: textValue(value?.url) || undefined,
  dataUrl: textValue(value?.dataUrl) || undefined,
  mimeType: textValue(value?.mimeType) || undefined,
  filePath: textValue(value?.filePath) || undefined,
  publicUrl: textValue(value?.publicUrl) || undefined,
  thumbnailPath: textValue(value?.thumbnailPath) || undefined,
  thumbnailUrl: textValue(value?.thumbnailUrl) || undefined,
  width: numberValue(value?.width),
  height: numberValue(value?.height),
  createdAt: textValue(value?.createdAt) || undefined,
  capturedAt: textValue(value?.capturedAt) || undefined,
});

export const normalizeRecordedBy = (value: Partial<RecordedBy> | null | undefined): RecordedBy | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const label = textValue(value.label) || textValue(value.roleName);
  const userId = textValue(value.userId);
  if (!label && !userId) return undefined;
  return {
    userId: userId || undefined,
    roleName: textValue(value.roleName) || label || undefined,
    label: label || "家庭成员",
    caregiver: typeof value.caregiver === "boolean" ? value.caregiver : undefined,
  };
};

export const recordedByLabel = (recordedBy?: RecordedBy) => recordedBy?.label || recordedBy?.roleName || "家庭成员";

export const creatorMetaText = (recordedBy?: RecordedBy) => `记录人：${recordedByLabel(recordedBy)}`;

export const stripAttachmentUrlForStorage = (url?: string) => {
  if (!url || url.startsWith("data:")) return undefined;
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.pathname.startsWith("/api/uploads/")) return parsed.pathname;
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url.split("?")[0];
  }
};

export const normalizeAlbumCategory = (value: unknown): AlbumItemCategory =>
  stringMember(ALBUM_CATEGORY_VALUES, value) ? value : "daily";

export const normalizeAlbumItem = (value: Partial<AlbumItem> | null | undefined, index: number): AlbumItem => ({
  id: textValue(value?.id, `album-${index}`),
  kind: value?.kind === "media" ? "media" : "keyEvent",
  title: textValue(value?.title, "成长片段"),
  date: textValue(value?.date, todayISO()),
  occurredAt: textValue(value?.occurredAt) || undefined,
  category: normalizeAlbumCategory(value?.category),
  tags: stringList(value?.tags),
  attachmentId: textValue(value?.attachmentId) || undefined,
  attachment: value?.attachment ? normalizeAttachment(value.attachment, index) : undefined,
  linkedType:
    value?.linkedType === "chatMessage" ||
    value?.linkedType === "careLogEvent" ||
    value?.linkedType === "growthEvent" ||
    value?.linkedType === "reminder"
      ? value.linkedType
      : undefined,
  linkedId: textValue(value?.linkedId) || undefined,
  source: value?.source === "agent" || value?.source === "manual" ? value.source : "rule",
  recordedBy: normalizeRecordedBy(value?.recordedBy),
  createdByUserId: textValue(value?.createdByUserId) || undefined,
});

// Guards against the silent loss of optimistic album items (e.g. chat auto_save)
// whose persistRecord PUT failed and therefore never made it into a backend
// snapshot. applyAppSnapshot would otherwise replace album state wholesale and
// drop them. Here the backend snapshot stays authoritative — including for
// deletes — except that any LOCAL item still awaiting confirmed persistence
// (its id is in pendingPersistIds) survives even when the snapshot omits it.
// dedupeAlbumItems keys media by attachmentId, so once the backend catches up
// the protected item collapses into its backend twin instead of duplicating.
export const mergeAlbumItemsFromSnapshot = (
  localItems: AlbumItem[],
  snapshotItems: AlbumItem[],
  pendingPersistIds: ReadonlySet<string>,
): AlbumItem[] => {
  if (pendingPersistIds.size === 0) return snapshotItems;
  const snapshotIds = new Set(snapshotItems.map((item) => item.id));
  const survivors = localItems.filter(
    (item) => pendingPersistIds.has(item.id) && !snapshotIds.has(item.id),
  );
  if (survivors.length === 0) return snapshotItems;
  return dedupeAlbumItems([...snapshotItems, ...survivors]);
};

export const normalizeAlbumPrompt = (value: Partial<AlbumPrompt> | null | undefined, index: number): AlbumPrompt => ({
  id: textValue(value?.id, `album-prompt-${index}`),
  attachmentId: textValue(value?.attachmentId),
  sourceMessageId: textValue(value?.sourceMessageId),
  title: textValue(value?.title, "值得收藏的素材"),
  category: normalizeAlbumCategory(value?.category),
  reason: textValue(value?.reason, "这段素材可能值得保存到相册。"),
  tags: stringList(value?.tags),
  status: value?.status === "saved" || value?.status === "ignored" ? value.status : "pending",
  createdAt: textValue(value?.createdAt, new Date().toISOString()),
});
