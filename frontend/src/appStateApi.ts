import { AiUsageSummary, AppStateSnapshot, Attachment, AttachmentKind, ProTrialStatus } from "./types";
import { apiBaseUrl, apiFetch, authHeaders, parseError, withAuthQuery } from "./authApi";
import { normalizeAppStateResponse } from "./appStateContract";
import { reportClientError } from "./errorReporting";

export type AppStateCollection =
  | "profile"
  | "messages"
  | "growthEvents"
  | "growthMeasurements"
  | "careLogs"
  | "reminders"
  | "memories"
  | "pendingEffects"
  | "albumItems"
  | "expenses"
  | "conversationSummary";

export type AppStateResponse = {
  empty: boolean;
  state: Partial<AppStateSnapshot>;
};

// persistRecord / deleteAppRecord 的精确签名(实现由 useAppStore 提供、经 App 注入各领域 hook)。
// 单一来源(评审 P9):6 个领域 hook 原先各自内联抄了一遍同一签名,统一到这里(与 upsertAppRecord/
// AppStateCollection 同源),签名改动只此一处。各 hook 已 import 本模块,无新依赖、无循环。
export type PersistRecord = <T,>(
  collection: AppStateCollection,
  id: string,
  item: T,
  options?: { applyResponse?: boolean; mode?: "merge" | "replace" },
) => Promise<AppStateResponse>;

export type DeleteAppRecord = (collection: AppStateCollection, id: string) => Promise<AppStateResponse>;

export type UploadResponse = Attachment & {
  mimeType: string;
  filePath: string;
  publicUrl: string;
  thumbnailPath?: string;
  thumbnailUrl?: string;
  createdAt: string;
};

export type UploadPresignResponse = {
  id: string;
  method: "PUT";
  uploadUrl: string;
  objectKey: string;
  publicUrl: string;
  expiresAt: string;
  headers?: Record<string, string>;
  maxUploadBytes: number;
};

export type UploadProgressHandler = (progress: number) => void;

const toAbsoluteUrl = (url?: string) => {
  if (!url) return url;
  if (url.startsWith("data:")) return url;
  // REQ-AUTH-005: only media downloads under /api/uploads/ may carry a ?token= query, because the
  // browser cannot attach an Authorization header to <img>/<video> src. Everything else stays
  // token-free in the URL and authenticates via the Bearer header on its fetch/XHR.
  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/api/uploads/")) return withAuthQuery(`${apiBaseUrl}${parsed.pathname}`);
  } catch {
    // Relative URLs are handled below.
  }
  if (/^https?:\/\//.test(url)) return url;
  const absolute = `${apiBaseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
  return url.startsWith("/api/uploads/") ? withAuthQuery(absolute) : absolute;
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


// D10 契约防护:所有 app/state 形态的响应统一过归一化(白屏防护),
// 偏离契约时上报一次 state_contract_drift(同类漂移会话内去重,避免刷量)。
const reportedDriftSignatures = new Set<string>();

async function parseAppStateResponse(response: Response): Promise<AppStateResponse> {
  const { value, problems } = normalizeAppStateResponse(await response.json());
  if (problems.length) {
    const signature = problems.slice(0, 5).join("|");
    if (!reportedDriftSignatures.has(signature)) {
      reportedDriftSignatures.add(signature);
      reportClientError({
        kind: "state_contract_drift",
        message: `app/state 契约漂移:${problems.slice(0, 8).join("; ")}`,
        page: "appStateApi",
      });
    }
  }
  return withAbsoluteAttachmentUrls(value as AppStateResponse);
}


export async function readAppState(): Promise<AppStateResponse> {
  const response = await apiFetch(`${apiBaseUrl}/api/app/state`, { headers: authHeaders() });
  if (!response.ok) throw new Error(await parseError(response, `读取本地数据失败（${response.status}）`));
  return parseAppStateResponse(response);
}

export async function saveAppState(state: AppStateSnapshot): Promise<AppStateResponse> {
  const response = await apiFetch(`${apiBaseUrl}/api/app/state`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(state),
  });
  if (!response.ok) throw new Error(await parseError(response, `保存本地数据失败（${response.status}）`));
  return parseAppStateResponse(response);
}

export async function importAppState(state: AppStateSnapshot): Promise<AppStateResponse> {
  const response = await apiFetch(`${apiBaseUrl}/api/app/state/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(state),
  });
  if (!response.ok) throw new Error(await parseError(response, `导入本地数据失败（${response.status}）`));
  return parseAppStateResponse(response);
}

export async function upsertAppRecord<T>(
  collection: AppStateCollection,
  id: string,
  item: T,
  options: { mode?: "merge" | "replace" } = {},
): Promise<AppStateResponse> {
  const modeQuery = options.mode ? `?mode=${encodeURIComponent(options.mode)}` : "";
  const response = await apiFetch(`${apiBaseUrl}/api/app/state/${collection}/${encodeURIComponent(id)}${modeQuery}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(item),
  });
  if (!response.ok) throw new Error(await parseError(response, `保存记录失败（${response.status}）`));
  return parseAppStateResponse(response);
}

export async function deleteAppRecord(collection: AppStateCollection, id: string): Promise<AppStateResponse> {
  const response = await apiFetch(`${apiBaseUrl}/api/app/state/${collection}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(await parseError(response, `删除记录失败（${response.status}）`));
  return parseAppStateResponse(response);
}

export async function deleteAttachment(id: string): Promise<AppStateResponse> {
  const response = await apiFetch(`${apiBaseUrl}/api/app/state/attachments/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(await parseError(response, `删除素材失败（${response.status}）`));
  return parseAppStateResponse(response);
}

export async function submitProTrialApplication(source: string): Promise<ProTrialStatus> {
  const response = await apiFetch(`${apiBaseUrl}/api/pro/trial/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ source }),
  });
  if (!response.ok) throw new Error(await parseError(response, `申请 Pro 内测失败（${response.status}）`));
  return (await response.json()) as ProTrialStatus;
}

export async function redeemProCode(code: string): Promise<ProTrialStatus> {
  const response = await apiFetch(`${apiBaseUrl}/api/pro/redeem`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ code }),
  });
  if (!response.ok) throw new Error(await parseError(response, `兑换失败（${response.status}）`));
  return (await response.json()) as ProTrialStatus;
}

export async function readAiUsageSummary(days = 30): Promise<AiUsageSummary> {
  const response = await apiFetch(`${apiBaseUrl}/api/pro/usage?days=${encodeURIComponent(String(days))}`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(await parseError(response, `读取 AI 用量失败（${response.status}）`));
  return (await response.json()) as AiUsageSummary;
}

export async function uploadDataUrlAttachment(input: {
  id: string;
  name: string;
  kind: AttachmentKind;
  dataUrl: string;
  thumbnailDataUrl?: string;
}): Promise<UploadResponse> {
  const response = await apiFetch(`${apiBaseUrl}/api/uploads`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await parseError(response, `上传附件失败（${response.status}）`));
  const payload = (await response.json()) as UploadResponse;
  return { ...payload, url: toAbsoluteUrl(payload.url || payload.publicUrl), thumbnailUrl: toAbsoluteUrl(payload.thumbnailUrl) };
}

async function presignAttachmentUpload(input: {
  id: string;
  name: string;
  kind: AttachmentKind;
  mimeType: string;
  sizeBytes: number;
}): Promise<UploadPresignResponse> {
  const response = await apiFetch(`${apiBaseUrl}/api/uploads/presign`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await parseError(response, `准备上传失败（${response.status}）`));
  return (await response.json()) as UploadPresignResponse;
}

async function completeAttachmentUpload(input: {
  id: string;
  name: string;
  kind: AttachmentKind;
  mimeType: string;
  objectKey: string;
  sizeBytes: number;
  thumbnailDataUrl?: string;
}): Promise<UploadResponse> {
  const response = await apiFetch(`${apiBaseUrl}/api/uploads/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await parseError(response, `保存上传记录失败（${response.status}）`));
  const payload = (await response.json()) as UploadResponse;
  return { ...payload, url: toAbsoluteUrl(payload.url || payload.publicUrl), thumbnailUrl: toAbsoluteUrl(payload.thumbnailUrl) };
}

function xhrUpload(options: {
  method: "PUT" | "POST";
  url: string;
  body: XMLHttpRequestBodyInit;
  headers?: HeadersInit;
  onProgress?: UploadProgressHandler;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(options.method, options.url);
    const headers = new Headers(options.headers);
    headers.forEach((value, key) => {
      if (value) xhr.setRequestHeader(key, value);
    });
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        options.onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.responseText || "");
        return;
      }
      reject(new Error(`OSS 上传失败（${xhr.status}）`));
    };
    xhr.onerror = () => reject(new Error("OSS 上传网络异常"));
    xhr.ontimeout = () => reject(new Error("OSS 上传超时"));
    xhr.send(options.body);
  });
}

async function uploadToPresignedUrl(
  presign: UploadPresignResponse,
  file: File,
  onProgress?: UploadProgressHandler,
): Promise<void> {
  await xhrUpload({
    method: "PUT",
    url: presign.uploadUrl,
    body: file,
    headers: presign.headers,
    onProgress,
  });
}

export async function uploadFileAttachment(input: {
  id: string;
  name: string;
  kind: AttachmentKind;
  file: File;
  thumbnailDataUrl?: string;
  onProgress?: UploadProgressHandler;
}): Promise<UploadResponse> {
  const mimeType = input.file.type || "application/octet-stream";
  const presign = await presignAttachmentUpload({
    id: input.id,
    name: input.name,
    kind: input.kind,
    mimeType,
    sizeBytes: input.file.size,
  });
  await uploadToPresignedUrl(presign, input.file, input.onProgress);
  input.onProgress?.(100);
  return completeAttachmentUpload({
    id: presign.id || input.id,
    name: input.name,
    kind: input.kind,
    mimeType,
    objectKey: presign.objectKey,
    sizeBytes: input.file.size,
    thumbnailDataUrl: input.thumbnailDataUrl,
  });
}

export async function confirmPendingEffectOnServer(id: string): Promise<AppStateResponse> {
  const response = await apiFetch(`${apiBaseUrl}/api/app/state/pending-effects/${encodeURIComponent(id)}/confirm`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(await parseError(response, `确认记录失败（${response.status}）`));
  return parseAppStateResponse(response);
}

export async function discardPendingEffectOnServer(id: string): Promise<AppStateResponse> {
  const response = await apiFetch(`${apiBaseUrl}/api/app/state/pending-effects/${encodeURIComponent(id)}/discard`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(await parseError(response, `丢弃记录失败（${response.status}）`));
  return parseAppStateResponse(response);
}
