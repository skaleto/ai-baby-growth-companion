import { AppStateSnapshot, Attachment, AttachmentKind } from "./types";
import { apiBaseUrl, authHeaders, withAuthQuery } from "./authApi";

export type AppStateCollection =
  | "profile"
  | "messages"
  | "growthEvents"
  | "careLogs"
  | "reminders"
  | "memories"
  | "pendingEffects"
  | "albumItems"
  | "conversationSummary";

export type AppStateResponse = {
  empty: boolean;
  state: Partial<AppStateSnapshot>;
};

export type UploadResponse = Attachment & {
  mimeType: string;
  filePath: string;
  publicUrl: string;
  thumbnailPath?: string;
  thumbnailUrl?: string;
  createdAt: string;
};

const toAbsoluteUrl = (url?: string) => {
  if (!url) return url;
  if (url.startsWith("data:")) return url;
  if (/^https?:\/\//.test(url)) return withAuthQuery(url);
  return withAuthQuery(`${apiBaseUrl}${url.startsWith("/") ? "" : "/"}${url}`);
};

const withAbsoluteAttachmentUrls = <T>(value: T): T => {
  const visit = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(visit);
    if (!node || typeof node !== "object") return node;
    const record = node as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    Object.entries(record).forEach(([key, item]) => {
      next[key] = visit(item);
    });
    if (typeof next.url === "string") {
      next.url = toAbsoluteUrl(next.url);
    } else if (typeof next.publicUrl === "string") {
      next.url = toAbsoluteUrl(next.publicUrl);
    }
    if (typeof next.thumbnailUrl === "string") next.thumbnailUrl = toAbsoluteUrl(next.thumbnailUrl);
    return next;
  };
  return visit(value) as T;
};

async function parseError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { code?: string; message?: string };
    return `${body.code ? `${body.code}: ` : ""}${body.message || fallback}`;
  } catch {
    return fallback;
  }
}

export async function readAppState(): Promise<AppStateResponse> {
  const response = await fetch(`${apiBaseUrl}/api/app/state`, { headers: authHeaders() });
  if (!response.ok) throw new Error(await parseError(response, `读取本地数据失败（${response.status}）`));
  return withAbsoluteAttachmentUrls((await response.json()) as AppStateResponse);
}

export async function saveAppState(state: AppStateSnapshot): Promise<AppStateResponse> {
  const response = await fetch(`${apiBaseUrl}/api/app/state`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(state),
  });
  if (!response.ok) throw new Error(await parseError(response, `保存本地数据失败（${response.status}）`));
  return withAbsoluteAttachmentUrls((await response.json()) as AppStateResponse);
}

export async function importAppState(state: AppStateSnapshot): Promise<AppStateResponse> {
  const response = await fetch(`${apiBaseUrl}/api/app/state/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(state),
  });
  if (!response.ok) throw new Error(await parseError(response, `导入本地数据失败（${response.status}）`));
  return withAbsoluteAttachmentUrls((await response.json()) as AppStateResponse);
}

export async function upsertAppRecord<T>(
  collection: AppStateCollection,
  id: string,
  item: T,
  options: { mode?: "merge" | "replace" } = {},
): Promise<AppStateResponse> {
  const modeQuery = options.mode ? `?mode=${encodeURIComponent(options.mode)}` : "";
  const response = await fetch(`${apiBaseUrl}/api/app/state/${collection}/${encodeURIComponent(id)}${modeQuery}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(item),
  });
  if (!response.ok) throw new Error(await parseError(response, `保存记录失败（${response.status}）`));
  return withAbsoluteAttachmentUrls((await response.json()) as AppStateResponse);
}

export async function deleteAppRecord(collection: AppStateCollection, id: string): Promise<AppStateResponse> {
  const response = await fetch(`${apiBaseUrl}/api/app/state/${collection}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(await parseError(response, `删除记录失败（${response.status}）`));
  return withAbsoluteAttachmentUrls((await response.json()) as AppStateResponse);
}

export async function uploadDataUrlAttachment(input: {
  id: string;
  name: string;
  kind: AttachmentKind;
  dataUrl: string;
  thumbnailDataUrl?: string;
}): Promise<UploadResponse> {
  const response = await fetch(`${apiBaseUrl}/api/uploads`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await parseError(response, `上传附件失败（${response.status}）`));
  const payload = (await response.json()) as UploadResponse;
  return { ...payload, url: toAbsoluteUrl(payload.url || payload.publicUrl), thumbnailUrl: toAbsoluteUrl(payload.thumbnailUrl) };
}

export async function confirmPendingEffectOnServer(id: string): Promise<AppStateResponse> {
  const response = await fetch(`${apiBaseUrl}/api/app/state/pending-effects/${encodeURIComponent(id)}/confirm`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(await parseError(response, `确认记录失败（${response.status}）`));
  return withAbsoluteAttachmentUrls((await response.json()) as AppStateResponse);
}

export async function discardPendingEffectOnServer(id: string): Promise<AppStateResponse> {
  const response = await fetch(`${apiBaseUrl}/api/app/state/pending-effects/${encodeURIComponent(id)}/discard`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(await parseError(response, `丢弃记录失败（${response.status}）`));
  return withAbsoluteAttachmentUrls((await response.json()) as AppStateResponse);
}
