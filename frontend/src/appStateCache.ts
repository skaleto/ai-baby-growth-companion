// 冷启动「本地快照秒开」缓存(架构债 D11)。
//
// 为什么需要:杀进程冷启动时,bootstrapAuth 必须先等 /api/auth/me + /api/app/state 两个网络
// 往返才能渲染首页,弱网/离线下表现为长时间停在登录确认 splash。这里把上一次成功拉取的
// app-state 快照落进 IndexedDB(快照可能很大——含 messages/careLogs/albumItems,不能用
// localStorage),冷启动若命中则先用缓存即时渲染首页,再在后台刷新后端并对账。
//
// 账号隔离红线:缓存按账号(user id)分键,绝不跨账号串台。但启动时 readCurrentUser 尚未返回,
// 此刻还不知道当前 user id,因此把「上一次写缓存的账号键」也存进 localStorage(只是个短 id 串,
// 适合 localStorage),启动读缓存只需 readCachedSnapshotForBoot() 一个调用,无需先知道身份。
//
// 纯模块红线(tech-debt D2 同款,对齐 appStateContract.ts / mediaCache.ts):本模块会被
// esbuild 逻辑测试在 Node 中打包,不得 import React / 资产文件 / import.meta.env;
// 形态校验交由调用方用 normalizeAppStateResponse 兜底(损坏缓存绝不能白屏)。

const DB_NAME = "xiaobao-app-state-cache";
const DB_VERSION = 1;
const SNAPSHOT_STORE = "snapshots"; // accountKey -> { savedAt, snapshot }
// 「上一次写缓存的账号键」落 localStorage:启动读缓存时还拿不到 user id,用它定位 IDB 记录。
const LAST_ACCOUNT_KEY_STORAGE = "baby-companion-app-state-cache-account";

/** 落库记录:savedAt 仅用于诊断/未来按时效淘汰;snapshot 是 buildAppSnapshot() 的产物。 */
export type CachedSnapshotRecord = {
  accountKey: string;
  savedAt: number;
  snapshot: unknown;
};

// ---------- localStorage:仅存「上一次账号键」(短串,IDB 记录的定位用) ----------

function readLastAccountKey(): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(LAST_ACCOUNT_KEY_STORAGE) || null;
  } catch {
    return null;
  }
}

function writeLastAccountKey(accountKey: string): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(LAST_ACCOUNT_KEY_STORAGE, accountKey);
  } catch {
    // localStorage 不可用时仅退化为「无秒开」,不影响功能。
  }
}

function clearLastAccountKey(): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(LAST_ACCOUNT_KEY_STORAGE);
  } catch {
    // 忽略。
  }
}

// ---------- IndexedDB(失败即整体降级为「无缓存秒开」,不影响功能) ----------

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) db.createObjectStore(SNAPSHOT_STORE);
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

function idbGet<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((resolve) => {
    try {
      const req = db.transaction(SNAPSHOT_STORE, "readonly").objectStore(SNAPSHOT_STORE).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

function idbPut(db: IDBDatabase, key: string, value: unknown): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(SNAPSHOT_STORE, "readwrite");
      tx.objectStore(SNAPSHOT_STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

function idbDelete(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(SNAPSHOT_STORE, "readwrite");
      tx.objectStore(SNAPSHOT_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

// ---------- 对外 API(全部失败即返回 null/无副作用,绝不抛) ----------

/**
 * 读指定账号的缓存快照;未命中或无库返回 null。
 * 通常用 readCachedSnapshotForBoot();此重载留给已知账号键的场景。
 */
export async function readCachedSnapshot(accountKey?: string | null): Promise<unknown | null> {
  if (!accountKey) return null;
  const db = await openDb();
  if (!db) return null;
  const record = await idbGet<CachedSnapshotRecord>(db, accountKey);
  if (!record || typeof record !== "object") return null;
  return record.snapshot ?? null;
}

/**
 * 冷启动读缓存:用 localStorage 里「上一次写缓存的账号键」定位 IDB 记录。
 * 返回 { accountKey, snapshot } 或 null。调用方拿到 snapshot 后务必先过
 * normalizeAppStateResponse 校验形态,损坏的缓存按未命中处理(白屏防护)。
 */
export async function readCachedSnapshotForBoot(): Promise<{ accountKey: string; snapshot: unknown } | null> {
  const accountKey = readLastAccountKey();
  if (!accountKey) return null;
  const snapshot = await readCachedSnapshot(accountKey);
  if (snapshot == null) return null;
  return { accountKey, snapshot };
}

/**
 * 写指定账号的缓存快照,并把该账号键记为「上一次账号」(供下次冷启动定位)。
 * 成功返回 true;无库/失败返回 false(仅退化为无秒开)。
 */
export async function writeCachedSnapshot(accountKey: string | null | undefined, snapshot: unknown): Promise<boolean> {
  if (!accountKey || snapshot == null) return false;
  const db = await openDb();
  if (!db) return false;
  const record: CachedSnapshotRecord = { accountKey, savedAt: Date.now(), snapshot };
  const stored = await idbPut(db, accountKey, record);
  if (stored) writeLastAccountKey(accountKey);
  return stored;
}

/**
 * 清缓存:删上一次账号的 IDB 记录 + 清掉 localStorage 里的账号键(下次冷启动无秒开)。
 * 退出登录 / token 过期时调用,避免上一个账号的快照泄漏给登录页之后的任何账号。
 */
export async function clearCachedSnapshot(): Promise<void> {
  const accountKey = readLastAccountKey();
  clearLastAccountKey();
  if (!accountKey) return;
  const db = await openDb();
  if (!db) return;
  await idbDelete(db, accountKey);
}
