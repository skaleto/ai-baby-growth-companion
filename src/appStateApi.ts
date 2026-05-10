import { AppStateSnapshot, Attachment, AttachmentKind } from "./types";
import { apiBaseUrl, apiFetch, authHeaders, createRequestId, REQUEST_ID_HEADER, withAuthQuery } from "./authApi";

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
  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/api/uploads/")) return withAuthQuery(`${apiBaseUrl}${parsed.pathname}`);
  } catch {
    // Relative URLs are handled below.
  }
  if (/^https?:\/\//.test(url)) return url;
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
  const response = await apiFetch(`${apiBaseUrl}/api/app/state`, { headers: authHeaders() });
  if (!response.ok) throw new Error(await parseError(response, `读取本地数据失败（${response.status}）`));
  return withAbsoluteAttachmentUrls((await response.json()) as AppStateResponse);
}

export async function saveAppState(state: AppStateSnapshot): Promise<AppStateResponse> {
  const response = await apiFetch(`${apiBaseUrl}/api/app/state`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(state),
  });
  if (!response.ok) throw new Error(await parseError(response, `保存本地数据失败（${response.status}）`));
  return withAbsoluteAttachmentUrls((await response.json()) as AppStateResponse);
}

export async function importAppState(state: AppStateSnapshot): Promise<AppStateResponse> {
  const response = await apiFetch(`${apiBaseUrl}/api/app/state/import`, {
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
  const response = await apiFetch(`${apiBaseUrl}/api/app/state/${collection}/${encodeURIComponent(id)}${modeQuery}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(item),
  });
  if (!response.ok) throw new Error(await parseError(response, `保存记录失败（${response.status}）`));
  return withAbsoluteAttachmentUrls((await response.json()) as AppStateResponse);
}

export async function deleteAppRecord(collection: AppStateCollection, id: string): Promise<AppStateResponse> {
  const response = await apiFetch(`${apiBaseUrl}/api/app/state/${collection}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(await parseError(response, `删除记录失败（${response.status}）`));
  return withAbsoluteAttachmentUrls((await response.json()) as AppStateResponse);
}

export async function deleteAttachment(id: string): Promise<AppStateResponse> {
  const response = await apiFetch(`${apiBaseUrl}/api/app/state/attachments/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(await parseError(response, `删除素材失败（${response.status}）`));
  return withAbsoluteAttachmentUrls((await response.json()) as AppStateResponse);
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
    const isBackendRequest = options.url.startsWith(apiBaseUrl);
    const startedAt = performance.now();
    const requestId = isBackendRequest ? createRequestId("xhr") : "";
    xhr.open(options.method, options.url);
    const headers = new Headers(options.headers);
    if (isBackendRequest) {
      headers.set(REQUEST_ID_HEADER, requestId);
      console.info("[api] ->", { requestId, method: options.method, path: new URL(options.url).pathname });
    }
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
        if (isBackendRequest) {
          console.info("[api] <-", {
            requestId: xhr.getResponseHeader(REQUEST_ID_HEADER) || requestId,
            method: options.method,
            path: new URL(options.url).pathname,
            status: xhr.status,
            durationMs: Math.round(performance.now() - startedAt),
          });
        }
        resolve(xhr.responseText || "");
        return;
      }
      if (isBackendRequest) {
        console.warn("[api] <-", {
          requestId: xhr.getResponseHeader(REQUEST_ID_HEADER) || requestId,
          method: options.method,
          path: new URL(options.url).pathname,
          status: xhr.status,
          durationMs: Math.round(performance.now() - startedAt),
        });
      }
      reject(new Error(`上传失败（${xhr.status}）`));
    };
    xhr.onerror = () => {
      if (isBackendRequest) {
        console.warn("[api] xx", {
          requestId,
          method: options.method,
          path: new URL(options.url).pathname,
          durationMs: Math.round(performance.now() - startedAt),
          message: "上传网络异常",
        });
      }
      reject(new Error("上传网络异常"));
    };
    xhr.ontimeout = () => {
      if (isBackendRequest) {
        console.warn("[api] xx", {
          requestId,
          method: options.method,
          path: new URL(options.url).pathname,
          durationMs: Math.round(performance.now() - startedAt),
          message: "上传超时",
        });
      }
      reject(new Error("上传超时"));
    };
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

async function uploadMultipartAttachment(input: {
  id: string;
  name: string;
  kind: AttachmentKind;
  file: File;
  thumbnailDataUrl?: string;
  onProgress?: UploadProgressHandler;
}): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", input.file, input.name);
  formData.append("id", input.id);
  formData.append("kind", input.kind);
  if (input.thumbnailDataUrl) formData.append("thumbnailDataUrl", input.thumbnailDataUrl);
  const body = await xhrUpload({
    method: "POST",
    url: `${apiBaseUrl}/api/uploads`,
    body: formData,
    headers: authHeaders(),
    onProgress: input.onProgress,
  });
  const payload = JSON.parse(body) as UploadResponse;
  return { ...payload, url: toAbsoluteUrl(payload.url || payload.publicUrl), thumbnailUrl: toAbsoluteUrl(payload.thumbnailUrl) };
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
  let presign: UploadPresignResponse;
  try {
    presign = await presignAttachmentUpload({
      id: input.id,
      name: input.name,
      kind: input.kind,
      mimeType,
      sizeBytes: input.file.size,
    });
  } catch {
    return uploadMultipartAttachment(input);
  }
  try {
    await uploadToPresignedUrl(presign, input.file, input.onProgress);
    input.onProgress?.(100);
    return await completeAttachmentUpload({
      id: presign.id || input.id,
      name: input.name,
      kind: input.kind,
      mimeType,
      objectKey: presign.objectKey,
      sizeBytes: input.file.size,
      thumbnailDataUrl: input.thumbnailDataUrl,
    });
  } catch {
    input.onProgress?.(1);
    return uploadMultipartAttachment(input);
  }
}

export async function confirmPendingEffectOnServer(id: string): Promise<AppStateResponse> {
  const response = await apiFetch(`${apiBaseUrl}/api/app/state/pending-effects/${encodeURIComponent(id)}/confirm`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(await parseError(response, `确认记录失败（${response.status}）`));
  return withAbsoluteAttachmentUrls((await response.json()) as AppStateResponse);
}

export async function discardPendingEffectOnServer(id: string): Promise<AppStateResponse> {
  const response = await apiFetch(`${apiBaseUrl}/api/app/state/pending-effects/${encodeURIComponent(id)}/discard`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(await parseError(response, `丢弃记录失败（${response.status}）`));
  return withAbsoluteAttachmentUrls((await response.json()) as AppStateResponse);
}
