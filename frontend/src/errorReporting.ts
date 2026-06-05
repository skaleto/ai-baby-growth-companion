import { Capacitor } from "@capacitor/core";
import { apiBaseUrl } from "./authApi";

type ClientErrorKind = "crash" | "whitescreen" | "ota_fail" | "api_fail" | "unknown";

const OTA_VERSION = (import.meta.env.VITE_MOBILE_UPDATE_VERSION as string | undefined) ?? "dev";

// error boundary 在渲染时不能 await，这里启动时异步缓存运行时版本供同步上报取用。
let otaVersion = OTA_VERSION;
let nativeVersion = "";

/** 预取运行时版本（OTA bundle + 原生包），失败不影响上报。 */
export async function primeRuntimeVersions(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("CapacitorUpdater")) {
      const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
      const current = await CapacitorUpdater.current();
      nativeVersion = current?.native ?? "";
      otaVersion = current?.bundle?.version ?? OTA_VERSION;
    }
  } catch {
    // 拿不到版本不影响上报
  }
}

// 防止崩溃循环把后端刷爆：每分钟最多上报 5 条。
let windowStart = 0;
let windowCount = 0;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

function detectPlatform(): string {
  try {
    return Capacitor.getPlatform();
  } catch {
    return "web";
  }
}

/**
 * 上报一条客户端错误到后端 /api/client-errors。
 * 用裸 fetch（不走 apiFetch），避免 auth/刷新链路本身出错时连上报都失败；
 * keepalive 让页面卸载/崩溃时也尽量发出；任何异常都静默，绝不在错误处理里再抛错。
 */
export function reportClientError(input: { kind: ClientErrorKind; message: string; page?: string }): void {
  const now = Date.now();
  if (now - windowStart > WINDOW_MS) {
    windowStart = now;
    windowCount = 0;
  }
  if (windowCount >= MAX_PER_WINDOW) {
    return;
  }
  windowCount += 1;

  const page = input.page ?? (typeof window !== "undefined" ? window.location?.pathname : "") ?? "";
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const deviceInfo = `${detectPlatform()} | ${ua}`;

  const body = JSON.stringify({
    kind: input.kind,
    message: (input.message ?? "").slice(0, 2000),
    page: page.slice(0, 500),
    appVersion: otaVersion.slice(0, 100),
    bundleVersion: nativeVersion.slice(0, 100),
    deviceInfo: deviceInfo.slice(0, 500),
  });

  try {
    void fetch(`${apiBaseUrl}/api/client-errors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // 上报失败必须静默
    });
  } catch {
    // 同步异常也静默
  }
}

let handlersInstalled = false;

/** 安装全局未捕获错误监听：覆盖 React 渲染树之外的错误（事件回调、异步 Promise）。 */
export function installGlobalErrorHandlers(): void {
  if (handlersInstalled || typeof window === "undefined") {
    return;
  }
  handlersInstalled = true;

  window.addEventListener("error", (event: ErrorEvent) => {
    const message =
      event.error instanceof Error
        ? `${event.error.name}: ${event.error.message}`
        : event.message || "unknown window error";
    reportClientError({ kind: "crash", message, page: window.location?.pathname });
  });

  window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const message =
      reason instanceof Error ? `${reason.name}: ${reason.message}` : `unhandledrejection: ${String(reason)}`;
    reportClientError({ kind: "unknown", message, page: window.location?.pathname });
  });
}
