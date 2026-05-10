import { Capacitor } from "@capacitor/core";
import { CapacitorUpdater, BundleInfo } from "@capgo/capacitor-updater";
import { apiBaseUrl, apiFetch } from "./authApi";

const UPDATE_CHECK_DELAY_MS = 2500;
const LAST_CHECK_AT_KEY = "xiaobao-mobile-update-last-check-at";
const CHECK_INTERVAL_MS = 60 * 1000;
export const MOBILE_UPDATE_NOTICE_EVENT = "xiaobao-mobile-update-notice";

export type MobileUpdateNoticeTone = "info" | "success" | "warning";

export type MobileUpdateNoticeDetail = {
  message: string;
  tone?: MobileUpdateNoticeTone;
  durationMs?: number;
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

    emitMobileUpdateNotice(`发现新版本 ${update.version}，正在下载`);
    const existing = await findDownloadedBundle(update.version);
    if (existing) {
      emitMobileUpdateNotice(`新版本 ${update.version} 已下载，准备应用`);
    }
    const bundle = existing ?? (await CapacitorUpdater.download({
      version: update.version,
      url: update.url,
      ...(update.checksum ? { checksum: update.checksum } : {}),
    }));

    rememberCheckTime();
    console.info("[mobile-update] applying bundle", update.version);
    emitMobileUpdateNotice(`正在切换到新版本 ${update.version}`, "success", 1200);
    await sleep(900);
    await CapacitorUpdater.set({ id: bundle.id });
  } catch (error) {
    console.warn("[mobile-update] check failed", error);
    emitMobileUpdateNotice("更新检查暂时失败，稍后会再试", "warning");
  }
}

async function findDownloadedBundle(version: string): Promise<BundleInfo | undefined> {
  try {
    const list = await CapacitorUpdater.list();
    return list.bundles.find((bundle) => bundle.version === version && (bundle.status === "success" || bundle.status === "pending"));
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

function emitMobileUpdateNotice(message: string, tone: MobileUpdateNoticeTone = "info", durationMs = 2400) {
  window.dispatchEvent(new CustomEvent<MobileUpdateNoticeDetail>(MOBILE_UPDATE_NOTICE_EVENT, {
    detail: { message, tone, durationMs },
  }));
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
