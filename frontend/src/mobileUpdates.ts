import { Capacitor } from "@capacitor/core";
import { CapacitorUpdater, BundleInfo } from "@capgo/capacitor-updater";
import { apiBaseUrl, apiFetch } from "./authApi";
import { reportClientError } from "./errorReporting";

const UPDATE_CHECK_DELAY_MS = 2500;
const LAST_CHECK_AT_KEY = "xiaobao-mobile-update-last-check-at";
const CHECK_INTERVAL_MS = 60 * 1000;
export const MOBILE_UPDATE_NOTICE_EVENT = "xiaobao-mobile-update-notice";

export type MobileUpdateNoticeTone = "info" | "success" | "warning";

export type MobileUpdateNoticeDetail = {
  message: string;
  tone?: MobileUpdateNoticeTone;
  durationMs?: number;
  progress?: number | null;
  progressMode?: "determinate" | "indeterminate" | null;
};

type MobileUpdateCheckResponse = {
  enabled: boolean;
  updateAvailable: boolean;
  version?: string | null;
  url?: string | null;
  checksum?: string | null;
  minNativeVersion?: string | null;
  message?: string | null;
};

type DownloadProgressEvent = {
  percent?: number;
  progress?: number;
  downloadedBytes?: number;
  bytesDownloaded?: number;
  totalBytes?: number;
  totalBytesToDownload?: number;
};

export function startMobileUpdateRuntime() {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("CapacitorUpdater")) return;

  void CapacitorUpdater.notifyAppReady().catch((error) => {
    console.warn("[mobile-update] notifyAppReady failed", error);
  });

  window.setTimeout(() => {
    void checkAndQueueMobileUpdate();
  }, UPDATE_CHECK_DELAY_MS);
}

async function checkAndQueueMobileUpdate() {
  if (shouldSkipFrequentCheck()) return;

  try {
    emitMobileUpdateNotice("正在检查更新...");
    const current = await CapacitorUpdater.current();
    const currentBundle = current.bundle;
    const response = await apiFetch(`${apiBaseUrl}/api/mobile-updates/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appId: "com.xiaobao.growthcompanion",
        platform: Capacitor.getPlatform(),
        nativeVersion: current.native,
        currentBundleId: currentBundle?.id,
        currentBundleVersion: currentBundle?.version,
      }),
    });

    if (!response.ok) {
      emitMobileUpdateNotice("更新检查暂时失败，稍后会再试", "warning");
      return;
    }
    const update = (await response.json()) as MobileUpdateCheckResponse;
    if (!update.enabled || !update.updateAvailable || !update.version || !update.url) {
      rememberCheckTime();
      emitMobileUpdateNotice("当前已是最新版本", "success", 1800);
      return;
    }
    if (currentBundle?.version === update.version) {
      rememberCheckTime();
      emitMobileUpdateNotice(`当前已是最新版本 ${update.version}`, "success", 2000);
      return;
    }

    emitMobileUpdateNotice(`发现新版本 ${update.version}，准备下载`, "info", 0);
    const existing = await findDownloadedBundle(update.version);
    if (existing) {
      emitMobileUpdateNotice(`新版本 ${update.version} 已下载，准备应用`, "success", 1400, 100);
    }
    const bundle = existing ?? (await downloadBundleWithProgress(update.version, update.url, update.checksum));

    rememberCheckTime();
    console.info("[mobile-update] applying bundle", update.version);
    emitMobileUpdateNotice(`正在切换到新版本 ${update.version}`, "success", 1200, 100);
    await sleep(900);
    await CapacitorUpdater.set({ id: bundle.id });
  } catch (error) {
    console.warn("[mobile-update] check failed", error);
    // 上报原始错误(此前线上「解压失败」只有友好文案、无法定位真实原因)。
    reportClientError({
      kind: "ota_fail",
      message: error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? "unknown"),
      page: "mobile-update",
    });
    emitMobileUpdateNotice(readUpdateFailureMessage(error), "warning", 3600);
  }
}

async function downloadBundleWithProgress(version: string, url: string, checksum?: string | null): Promise<BundleInfo> {
  let listener: { remove: () => Promise<void> } | undefined;
  let lastProgress = 0;
  let hasDeterminateProgress = false;
  try {
    listener = await CapacitorUpdater.addListener("download", (state) => {
      const progress = readDownloadProgress(state as DownloadProgressEvent);
      console.info("[mobile-update] download progress", { version, progress, state });
      if (progress === null || progress <= 0) {
        if (!hasDeterminateProgress) {
          emitMobileUpdateNotice(`正在下载新版本 ${version}`, "info", 0, null, "indeterminate");
        }
        return;
      }
      if (progress > lastProgress) {
        lastProgress = progress;
      }
      if (lastProgress < 100) {
        hasDeterminateProgress = true;
        emitMobileUpdateNotice(`正在下载新版本 ${version}`, "info", 0, lastProgress, "determinate");
      }
    });
    emitMobileUpdateNotice(`正在下载新版本 ${version}`, "info", 0, null, "indeterminate");
    let bundle: BundleInfo;
    try {
      bundle = await CapacitorUpdater.download({
        version,
        url,
        ...(checksum ? { checksum } : {}),
      });
    } catch (firstError) {
      // 线上观测:偶发网络瞬态导致包下载不完整 → 解压失败,重试即成功。这里当场自动重试一次,
      // 免得用户要手动重开 App 才能更新。第二次仍失败才上抛(进 ota_fail 上报)。
      console.warn("[mobile-update] download failed, retrying once", firstError);
      emitMobileUpdateNotice(`下载中断，正在自动重试`, "info", 0, null, "indeterminate");
      await sleep(1500);
      bundle = await CapacitorUpdater.download({
        version,
        url,
        ...(checksum ? { checksum } : {}),
      });
    }
    emitMobileUpdateNotice(`新版本 ${version} 下载完成，准备应用`, "success", 1200, 100);
    return bundle;
  } finally {
    if (listener) {
      await listener.remove().catch(() => undefined);
    }
  }
}

async function findDownloadedBundle(version: string): Promise<BundleInfo | undefined> {
  try {
    const list = await CapacitorUpdater.list();
    // 只复用 success:pending 可能是上次下载/解压失败的残留,复用会陷入「应用坏包→失败→再复用」循环。
    return list.bundles.find((bundle) => bundle.version === version && bundle.status === "success");
  } catch {
    return undefined;
  }
}

function shouldSkipFrequentCheck() {
  try {
    const lastCheckAt = Number(window.localStorage.getItem(LAST_CHECK_AT_KEY) ?? "0");
    return Number.isFinite(lastCheckAt) && Date.now() - lastCheckAt < CHECK_INTERVAL_MS;
  } catch {
    return false;
  }
}

function rememberCheckTime() {
  try {
    window.localStorage.setItem(LAST_CHECK_AT_KEY, String(Date.now()));
  } catch {
    // Storage failures should not block updates.
  }
}

function emitMobileUpdateNotice(
  message: string,
  tone: MobileUpdateNoticeTone = "info",
  durationMs = 2400,
  progress?: number | null,
  progressMode?: MobileUpdateNoticeDetail["progressMode"],
) {
  window.dispatchEvent(new CustomEvent<MobileUpdateNoticeDetail>(MOBILE_UPDATE_NOTICE_EVENT, {
    detail: { message, tone, durationMs, progress, progressMode },
  }));
}

function clampProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function readDownloadProgress(state: DownloadProgressEvent) {
  const directProgress = normalizeDownloadProgress(state.percent ?? state.progress);
  if (directProgress !== null && directProgress > 0) return directProgress;

  const downloadedBytes = state.downloadedBytes ?? state.bytesDownloaded;
  const totalBytes = state.totalBytes ?? state.totalBytesToDownload;
  if (typeof downloadedBytes === "number" && typeof totalBytes === "number" && totalBytes > 0) {
    return clampProgress((downloadedBytes / totalBytes) * 100);
  }

  return directProgress;
}

function normalizeDownloadProgress(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value <= 0) return 0;
  if (value > 0 && value <= 1) return clampProgress(value * 100);
  return clampProgress(value);
}

function readUpdateFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/timeout|timed out|超时/i.test(message)) {
    return "更新下载超时，网络较慢时可以稍后再试";
  }
  if (/checksum|校验/i.test(message)) {
    return "更新包校验失败，我会稍后重新下载";
  }
  if (/unzip|zip|解压/i.test(message)) {
    return "更新包解压失败，我会稍后重新下载";
  }
  return "更新检查暂时失败，稍后会再试";
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
