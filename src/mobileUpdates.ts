import { Capacitor } from "@capacitor/core";
import { CapacitorUpdater, BundleInfo } from "@capgo/capacitor-updater";
import { apiBaseUrl } from "./authApi";

const UPDATE_CHECK_DELAY_MS = 2500;
const LAST_CHECK_AT_KEY = "xiaobao-mobile-update-last-check-at";
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

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
    const current = await CapacitorUpdater.current();
    const currentBundle = current.bundle;
    const response = await fetch(`${apiBaseUrl}/api/mobile-updates/check`, {
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

    if (!response.ok) return;
    rememberCheckTime();
    const update = (await response.json()) as MobileUpdateCheckResponse;
    if (!update.enabled || !update.updateAvailable || !update.version || !update.url) return;
    if (currentBundle?.version === update.version) return;

    const existing = await findDownloadedBundle(update.version);
    const bundle = existing ?? (await CapacitorUpdater.download({
      version: update.version,
      url: update.url,
      ...(update.checksum ? { checksum: update.checksum } : {}),
    }));

    await CapacitorUpdater.next({ id: bundle.id });
    console.info("[mobile-update] queued bundle", update.version);
  } catch (error) {
    console.warn("[mobile-update] check failed", error);
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
