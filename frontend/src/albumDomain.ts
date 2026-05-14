import { makeId } from "./data";
import type {
  AlbumItem,
  AlbumItemCategory,
  AlbumPrompt,
  Attachment,
  ChatMessage,
  EffectDecision,
} from "./types";

// Keep album rules pure: UI components, agent effects, and persistence can share them without React coupling.
export const ALBUM_CATEGORIES: Array<{ id: AlbumItemCategory | "all"; label: string }> = [
  { id: "all", label: "全部" },
  { id: "growth", label: "成长" },
  { id: "feeding", label: "喂养" },
  { id: "sleep", label: "睡眠" },
  { id: "health", label: "健康" },
  { id: "reminder", label: "提醒/疫苗" },
];

export type AlbumMediaDecision = {
  id: string;
  mode: "auto_save" | "ask" | "ignore";
  category: AlbumItemCategory;
  reason: string;
  title?: string;
  tags: string[];
  attachmentId: string;
  sourceMessageId: string;
  createdAt: string;
};

type AlbumEffectPayload = {
  intent?: string;
  targetScope?: "current" | "previous" | "recent" | "unspecified";
  targetKind?: "image" | "video" | "media" | "any";
  refHint?: string;
  category?: AlbumItemCategory;
  reason?: string;
  title?: string;
  tags?: string[];
};

const albumAutoSavePattern =
  /第一次|里程碑|翻身|抬头|爬|站|走路|走了|说话|叫妈妈|叫爸爸|满月|百天|生日|疫苗本|接种证|接种凭证|体检报告|医生通知|病历|留念|纪念|珍贵|成长瞬间|保存到相册|存到相册|收藏/;
const albumAskPattern =
  /宝宝|小宝|孩子|娃|亲子|妈妈抱|爸爸抱|奶瓶|辅食|玩具|衣服|小床|婴儿床|医院|诊室|候诊|社区医院|疫苗|体检|药|药盒|用品|照片|图片|相册/;
const explicitAlbumSavePattern = /保存到相册|存到相册|加入相册|放进相册|收藏|留念|纪念/;
const screenshotTextPattern = /截图|截屏|屏幕|页面|界面|聊天记录|App|APP|网页|浏览器|localhost|图里面有啥|图里有啥|这图里面|这个图里面|这张图里面|图里有什么|看一下图/;
const likelyScreenshotNamePattern = /screenshot|screen|localhost|截屏|截图|网页|浏览器|simulator|emulator/i;
const internalReferencePattern = /\b(?:msg|message|attachment|att|album|decision)-[a-z0-9._-]+\b/i;

const uniqueTexts = (items: string[]) => Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));

export const albumCategoryLabel = (category: AlbumItemCategory | "all") =>
  ALBUM_CATEGORIES.find((item) => item.id === category)?.label ?? "日常";

export const albumCategoryFromTags = (tags: string[], text = ""): AlbumItemCategory => {
  const source = [...tags, text].join(" ");
  if (/奶|喂养|辅食/.test(source)) return "feeding";
  if (/睡|夜醒|哄睡/.test(source)) return "sleep";
  if (/体温|发热|药|过敏|疫苗|医院|体检|健康/.test(source)) return "health";
  if (/提醒|待办|复诊/.test(source)) return "reminder";
  if (/成长|里程碑|第一次|翻身|抬头|爬|走|笑/.test(source)) return "growth";
  return "daily";
};

export const albumMonthLabel = (month: string) => {
  const [year, value] = month.split("-");
  const monthNumber = Number(value);
  return year && monthNumber ? `${year}年${monthNumber}月` : "未归档";
};

const albumItemKey = (item: AlbumItem) => `${item.kind}|${item.linkedType ?? ""}|${item.linkedId ?? ""}|${item.attachmentId ?? ""}|${item.date}|${item.title}`;
const albumMediaItemKey = (item: AlbumItem) =>
  item.kind === "media" && item.attachmentId ? `media|attachment|${item.attachmentId}` : albumItemKey(item);

export const dedupeAlbumItems = (items: AlbumItem[]) => {
  const byKey = new Map<string, AlbumItem>();
  items.forEach((item) => {
    const key = albumMediaItemKey(item);
    if (!byKey.has(key)) byKey.set(key, item);
  });
  return Array.from(byKey.values()).sort((left, right) => {
    const leftTime = left.occurredAt ?? `${left.date}T00:00:00`;
    const rightTime = right.occurredAt ?? `${right.date}T00:00:00`;
    return rightTime.localeCompare(leftTime);
  });
};

const imageAspectRatio = (attachment: Attachment) => {
  if (!attachment.width || !attachment.height) return undefined;
  return Math.max(attachment.width / attachment.height, attachment.height / attachment.width);
};

export const isLikelyScreenshotAttachment = (attachment: Attachment, text = "") => {
  if (attachment.kind !== "image") return false;
  const ratio = imageAspectRatio(attachment);
  const pngLike = attachment.mimeType === "image/png" || /\.png$/i.test(attachment.name);
  return (
    likelyScreenshotNamePattern.test(attachment.name) ||
    screenshotTextPattern.test(text) ||
    (pngLike && ratio !== undefined && ratio > 2.15)
  );
};

export const classifyAlbumCategoryFromText = (text: string): AlbumItemCategory => {
  if (/疫苗|接种|体检|医生|医院|病历|报告|药|健康/.test(text)) return "health";
  if (/奶|奶瓶|辅食|米粉|吃/.test(text)) return "feeding";
  if (/睡|小睡|夜醒|哄睡/.test(text)) return "sleep";
  if (/提醒|复诊/.test(text)) return "reminder";
  if (/第一次|里程碑|翻身|抬头|爬|站|走|笑|满月|百天|生日|成长/.test(text)) return "growth";
  return "daily";
};

export const isAlbumMediaAttachment = (attachment: Attachment) => attachment.kind === "image" || attachment.kind === "video";

export const mediaKindLabel = (attachment: Attachment) => (attachment.kind === "video" ? "视频" : "照片");

export const attachmentListSrc = (attachment: Attachment) => attachment.thumbnailUrl || attachment.url;

const compactDateLabel = (dateText?: string) => {
  const parsed = dateText ? new Date(dateText) : new Date();
  if (Number.isNaN(parsed.getTime())) return "";
  return `${parsed.getMonth() + 1}月${parsed.getDate()}日`;
};

const defaultAlbumTitle = (category: AlbumItemCategory, attachment: Attachment, occurredAt?: string) => {
  const date = compactDateLabel(occurredAt);
  const prefix = date ? `${date}` : "宝宝";
  const media = mediaKindLabel(attachment);
  if (category === "growth") return `${prefix}成长${media}`;
  if (category === "feeding") return `${prefix}喂养${media}`;
  if (category === "sleep") return `${prefix}睡眠${media}`;
  if (category === "health") return `${prefix}健康${media}`;
  if (category === "reminder") return `${prefix}提醒${media}`;
  return `${prefix}宝宝日常${media}`;
};

export const albumTitleFromText = (text: string, attachment: Attachment, category: AlbumItemCategory = "daily", occurredAt?: string) => {
  const clean = text
    .replace(/保存到相册|存到相册|加入相册|放进相册|收藏|留念|纪念|记录到相册/g, "")
    .replace(/刚才的?|这个|这张|这段|上个|上一条|再看一下|看一下|视频|照片|图片|素材|呢|啦|哦/g, "")
    .replace(/[，。！？,.!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tooGeneric = !clean || clean.length <= 1 || internalReferencePattern.test(clean);
  return tooGeneric ? defaultAlbumTitle(category, attachment, occurredAt) : clean.slice(0, 18);
};

const attachmentExtension = (attachment: Attachment) => {
  const fromName = attachment.name.match(/\.([a-z0-9]{2,5})$/i)?.[1];
  if (fromName) return fromName.toLowerCase();
  if (attachment.mimeType?.includes("mp4")) return "mp4";
  if (attachment.mimeType?.includes("quicktime")) return "mov";
  if (attachment.mimeType?.includes("webm")) return "webm";
  if (attachment.mimeType?.includes("png")) return "png";
  if (attachment.mimeType?.includes("webp")) return "webp";
  if (attachment.mimeType?.includes("gif")) return "gif";
  return attachment.kind === "video" ? "mp4" : "jpg";
};

export const generatedAlbumFileName = (title: string, attachment: Attachment) => {
  const safeTitle = title.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "").slice(0, 28) || `宝宝${mediaKindLabel(attachment)}`;
  return `${safeTitle}.${attachmentExtension(attachment)}`;
};

const standaloneAlbumTitle = (attachment: Attachment, category: AlbumItemCategory, occurredAt?: string) => {
  const baseName = attachment.name
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const genericName = /^(img|image|photo|video|mov|dsc|pxl|screenshot|screen)\b/i.test(baseName) || /^[a-f0-9]{12,}$/i.test(baseName);
  return baseName && !genericName ? baseName.slice(0, 18) : defaultAlbumTitle(category, attachment, occurredAt);
};

export const decideAlbumMedia = (message: ChatMessage, attachment: Attachment): AlbumMediaDecision => {
  const text = message.text === "上传了新的成长素材" ? "" : message.text;
  const source = `${text} ${attachment.name}`;
  const createdAt = new Date().toISOString();
  const base = {
    id: makeId("album-decision"),
    attachmentId: attachment.id,
    sourceMessageId: message.id,
    createdAt,
  };
  if (!isAlbumMediaAttachment(attachment)) {
    return { ...base, mode: "ignore", category: "daily", reason: "第一版相册只自动处理照片和视频。", tags: ["忽略"] };
  }
  if (isLikelyScreenshotAttachment(attachment, text)) {
    return { ...base, mode: "ignore", category: "daily", reason: "这看起来是 App、网页或聊天截图，不会保存到成长相册。", tags: ["截图"] };
  }
  const category = classifyAlbumCategoryFromText(source);
  if (albumAutoSavePattern.test(source) || explicitAlbumSavePattern.test(text)) {
    return {
      ...base,
      mode: "auto_save",
      category,
      reason: "用户表达了明确的留念或成长记录意图。",
      title: albumTitleFromText(text, attachment, category, message.createdAt),
      tags: [albumCategoryLabel(category), mediaKindLabel(attachment)],
    };
  }
  if (albumAskPattern.test(source)) {
    return {
      ...base,
      mode: "ask",
      category,
      reason: "这段素材可能和宝宝照护有关，但还不确定是否值得长期保存。",
      title: albumTitleFromText(text, attachment, category, message.createdAt),
      tags: [albumCategoryLabel(category), "待确认"],
    };
  }
  return { ...base, mode: "ignore", category: "daily", reason: "没有识别到值得保存到相册的明确生活或成长信号。", tags: ["忽略"] };
};

export const albumPromptFromDecision = (decision: AlbumMediaDecision): AlbumPrompt => ({
  id: decision.id,
  attachmentId: decision.attachmentId,
  sourceMessageId: decision.sourceMessageId,
  title: decision.title || "值得收藏的素材",
  category: decision.category,
  reason: decision.reason,
  tags: decision.tags,
  status: "pending",
  createdAt: decision.createdAt,
});

export const albumItemFromDecision = (decision: AlbumMediaDecision, message: ChatMessage, attachment: Attachment): AlbumItem => {
  const title = decision.title || albumTitleFromText(message.text, attachment, decision.category, message.createdAt);
  return {
    id: `album-media-${message.id}-${attachment.id}`,
    kind: "media",
    title,
    date: message.createdAt.slice(0, 10),
    occurredAt: message.createdAt,
    category: decision.category,
    tags: decision.tags.length ? decision.tags : [albumCategoryLabel(decision.category), mediaKindLabel(attachment)],
    attachmentId: attachment.id,
    attachment: {
      ...attachment,
      name: generatedAlbumFileName(title, attachment),
    },
    linkedType: "chatMessage",
    linkedId: message.id,
    source: "rule",
  };
};

export const albumItemFromStandaloneAttachment = (attachment: Attachment, occurredAt = attachment.createdAt ?? new Date().toISOString()): AlbumItem => {
  const category = classifyAlbumCategoryFromText(attachment.name);
  const title = standaloneAlbumTitle(attachment, category, occurredAt);
  return {
    id: `album-upload-${attachment.id}`,
    kind: "media",
    title,
    date: occurredAt.slice(0, 10),
    occurredAt,
    category,
    tags: ["上传", mediaKindLabel(attachment)],
    attachmentId: attachment.id,
    attachment: {
      ...attachment,
      name: generatedAlbumFileName(title, attachment),
    },
    source: "manual",
  };
};

export const isVisibleAlbumMedia = (item: AlbumItem) =>
  item.kind === "media" &&
  Boolean(
    item.attachment &&
      isAlbumMediaAttachment(item.attachment) &&
      (item.attachment.url || item.attachment.publicUrl) &&
      !isLikelyScreenshotAttachment(item.attachment, item.title),
  );

const normalizeAlbumCategoryValue = (value: unknown): AlbumItemCategory =>
  value === "growth" ||
  value === "feeding" ||
  value === "sleep" ||
  value === "health" ||
  value === "reminder" ||
  value === "daily"
    ? value
    : "daily";

const albumEffectPayload = (decision: EffectDecision): AlbumEffectPayload => {
  if (!decision.payload || typeof decision.payload !== "object") return {};
  const raw = decision.payload as Record<string, unknown>;
  const tags = Array.isArray(raw.tags) ? raw.tags.filter((item): item is string => typeof item === "string") : [];
  return {
    intent: typeof raw.intent === "string" ? raw.intent : undefined,
    targetScope:
      raw.targetScope === "current" || raw.targetScope === "previous" || raw.targetScope === "recent" || raw.targetScope === "unspecified"
        ? raw.targetScope
        : undefined,
    targetKind:
      raw.targetKind === "image" || raw.targetKind === "video" || raw.targetKind === "media" || raw.targetKind === "any"
        ? raw.targetKind
        : undefined,
    refHint: typeof raw.refHint === "string" ? raw.refHint : undefined,
    category: normalizeAlbumCategoryValue(raw.category),
    reason: typeof raw.reason === "string" ? raw.reason : decision.reason,
    title: typeof raw.title === "string" ? raw.title : undefined,
    tags,
  };
};

const albumEffectAllowsAttachment = (payload: AlbumEffectPayload, attachment: Attachment) => {
  if (!isAlbumMediaAttachment(attachment)) return false;
  if (payload.targetKind === "video" && attachment.kind !== "video") return false;
  if (payload.targetKind === "image" && attachment.kind !== "image") return false;
  return true;
};

export const resolveAlbumEffectTarget = (
  decision: EffectDecision,
  candidateMessages: ChatMessage[],
): { message: ChatMessage; attachment: Attachment; payload: AlbumEffectPayload } | null => {
  const payload = albumEffectPayload(decision);
  if (payload.intent && payload.intent !== "save_to_album") return null;
  const orderedMessages = [...candidateMessages].reverse();
  for (const message of orderedMessages) {
    const orderedAttachments = [...(message.attachments ?? [])].reverse();
    for (const attachment of orderedAttachments) {
      if (!albumEffectAllowsAttachment(payload, attachment)) continue;
      if (isLikelyScreenshotAttachment(attachment, `${payload.refHint ?? ""} ${message.text}`)) continue;
      return { message, attachment, payload };
    }
  }
  return null;
};

export const albumPromptFromEffectDecision = (
  decision: EffectDecision,
  sourceMessage: ChatMessage,
  attachment: Attachment,
): AlbumPrompt => {
  const payload = albumEffectPayload(decision);
  const category = payload.category ?? classifyAlbumCategoryFromText(`${sourceMessage.text} ${payload.refHint ?? ""}`);
  return {
    id: decision.id || makeId("album-decision"),
    attachmentId: attachment.id,
    sourceMessageId: sourceMessage.id,
    title: albumTitleFromText(payload.title || payload.refHint || sourceMessage.text, attachment, category, sourceMessage.createdAt),
    category,
    reason: payload.reason || decision.reason || `这段${mediaKindLabel(attachment)}可能值得保存到相册。`,
    tags: uniqueTexts([albumCategoryLabel(category), mediaKindLabel(attachment), ...(payload.tags ?? [])]).slice(0, 6),
    status: "pending",
    createdAt: new Date().toISOString(),
  };
};

export const buildDerivedAlbumItems = (messages: ChatMessage[]): AlbumItem[] => {
  const messageById = new Map(messages.map((message) => [message.id, message]));
  const mediaItems = messages.flatMap((message) =>
    (message.albumPrompts ?? [])
      .filter((prompt) => prompt.status === "saved")
      .map((prompt) => {
        const sourceMessage = messageById.get(prompt.sourceMessageId);
        const attachment = sourceMessage?.attachments?.find((item) => item.id === prompt.attachmentId);
        return sourceMessage && attachment ? albumItemFromDecision({ ...prompt, mode: "auto_save" }, sourceMessage, attachment) : null;
      })
      .filter((item): item is AlbumItem => Boolean(item)),
  );

  return dedupeAlbumItems(mediaItems);
};
