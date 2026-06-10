// 相册媒体本地缓存(IndexedDB 存 blob)。
//
// 为什么需要:生产附件走 OSS 签名 URL,每次拉 app-state 签名都会轮换(Expires/Signature 变),
// HTTP 缓存以完整 URL 为键,因此 WebView 磁盘缓存永远命不中——杀进程回来相册全量重新下载。
// 这里改为:以「剥掉签名后的稳定地址」为键,把 blob 落进 IndexedDB(WebView 数据落磁盘,
// 跨进程存活,且无需新增 Capacitor 原生插件,可随 OTA 发布)。
//
// 范围:相册网格图、视频海报、大图预览。视频流本身不缓存(Range/206,由海报兜底首帧)。

const DB_NAME = "xiaobao-media-cache";
const DB_VERSION = 1;
const MEDIA_STORE = "media"; // key -> blob
const META_STORE = "meta"; // key -> { bytes, lastUsed }
const MAX_TOTAL_BYTES = 300 * 1024 * 1024;
const LAST_USED_TOUCH_MS = 60_000; // lastUsed 写入节流,避免每次渲染都写库

export type CacheMeta = { key: string; bytes: number; lastUsed: number };

/**
 * 稳定缓存键:剥掉 query/hash(OSS 签名参数),本地上传路径只保留 pathname。
 * data: URL 与空值返回 null(无需缓存)。与 appStateDomain.stripAttachmentUrlForStorage
 * 同思路,但不依赖 window,便于在 Node 测试中使用。
 */
export function stableMediaKey(url?: string | null): string | null {
  if (!url || url.startsWith("data:") || url.startsWith("blob:")) return null;
  try {
    const parsed = new URL(url, "http://local.placeholder");
    if (parsed.pathname.startsWith("/api/uploads/")) return parsed.pathname;
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url.split("?")[0] || null;
  }
}

/** LRU 淘汰计划:按 lastUsed 从旧到新淘汰,直到总量 ≤ maxBytes。纯函数,可单测。 */
export function planEviction(entries: CacheMeta[], maxBytes: number): string[] {
  let total = entries.reduce((sum, e) => sum + (e.bytes || 0), 0);
  if (total <= maxBytes) return [];
  const evict: string[] = [];
  for (const entry of [...entries].sort((a, b) => a.lastUsed - b.lastUsed)) {
    if (total <= maxBytes) break;
    evict.push(entry.key);
    total -= entry.bytes || 0;
  }
  return evict;
}

// ---------- IndexedDB(失败即整体降级为直连远程,不影响功能) ----------

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(MEDIA_STORE)) db.createObjectStore(MEDIA_STORE);
        if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function idbGet<T>(db: IDBDatabase, store: string, key: string): Promise<T | undefined> {
  return new Promise((resolve) => {
    try {
      const req = db.transaction(store, "readonly").objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

function idbPut(db: IDBDatabase, store: string, key: string, value: unknown): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

function idbDelete(db: IDBDatabase, store: string, key: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

function idbAllMeta(db: IDBDatabase): Promise<CacheMeta[]> {
  return new Promise((resolve) => {
    try {
      const out: CacheMeta[] = [];
      const req = db.transaction(META_STORE, "readonly").objectStore(META_STORE).openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return resolve(out);
        const value = cursor.value as { bytes?: number; lastUsed?: number };
        out.push({ key: String(cursor.key), bytes: value?.bytes || 0, lastUsed: value?.lastUsed || 0 });
        cursor.continue();
      };
      req.onerror = () => resolve(out);
    } catch {
      resolve([]);
    }
  });
}

// ---------- 缓存核心 ----------

// objectURL 会话级复用:同一 blob 不重复创建,也不主动 revoke(随页面生命周期释放)。
const objectUrls = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();
const lastTouched = new Map<string, number>();

function blobToObjectUrl(key: string, blob: Blob): string {
  const existing = objectUrls.get(key);
  if (existing) return existing;
  const url = URL.createObjectURL(blob);
  objectUrls.set(key, url);
  return url;
}

async function touchLastUsed(db: IDBDatabase, key: string, bytes: number) {
  const now = Date.now();
  const last = lastTouched.get(key) || 0;
  if (now - last < LAST_USED_TOUCH_MS) return;
  lastTouched.set(key, now);
  await idbPut(db, META_STORE, key, { bytes, lastUsed: now });
}

async function evictIfNeeded(db: IDBDatabase) {
  const metas = await idbAllMeta(db);
  for (const key of planEviction(metas, MAX_TOTAL_BYTES)) {
    await idbDelete(db, MEDIA_STORE, key);
    await idbDelete(db, META_STORE, key);
    objectUrls.delete(key);
  }
}

/** 同步查会话内已建好的 objectURL(用于 React 首帧避免闪烁);无则 null。 */
export function getMemoizedLocalUrl(remoteUrl?: string | null): string | null {
  const key = stableMediaKey(remoteUrl);
  return key ? objectUrls.get(key) || null : null;
}

/** 仅查本地:命中返回 objectURL,未命中返回 null。 */
export async function getLocalMediaUrl(remoteUrl?: string | null): Promise<string | null> {
  const key = stableMediaKey(remoteUrl);
  if (!key) return null;
  const memo = objectUrls.get(key);
  if (memo) return memo;
  const db = await openDb();
  if (!db) return null;
  const blob = await idbGet<Blob>(db, MEDIA_STORE, key);
  if (!(blob instanceof Blob) || blob.size === 0) return null;
  void touchLastUsed(db, key, blob.size);
  return blobToObjectUrl(key, blob);
}

/** 下载并落库(并发去重);成功返回 objectURL,失败返回 null(调用方继续用远程 URL)。 */
export function cacheMediaFromRemote(remoteUrl?: string | null): Promise<string | null> {
  const key = stableMediaKey(remoteUrl);
  if (!key || !remoteUrl) return Promise.resolve(null);
  const running = inflight.get(key);
  if (running) return running;
  const task = (async () => {
    try {
      const db = await openDb();
      if (!db) return null;
      const response = await fetch(remoteUrl);
      if (!response.ok) return null;
      const blob = await response.blob();
      if (!blob || blob.size === 0) return null;
      const stored = await idbPut(db, MEDIA_STORE, key, blob);
      if (stored) {
        lastTouched.set(key, Date.now());
        await idbPut(db, META_STORE, key, { bytes: blob.size, lastUsed: Date.now() });
        void evictIfNeeded(db);
      }
      return blobToObjectUrl(key, blob);
    } catch {
      return null;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, task);
  return task;
}
