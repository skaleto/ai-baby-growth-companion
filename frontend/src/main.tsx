import React from "react";
import ReactDOM from "react-dom/client";
import { startMobileUpdateRuntime } from "./mobileUpdates";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { installGlobalErrorHandlers, primeRuntimeVersions } from "./errorReporting";
import { shouldRenderOfficialSite } from "./siteRouting";
import "./styles.css";

const shouldRenderOfficial = shouldRenderOfficialSite({
  pathname: window.location.pathname,
  hostname: window.location.hostname,
  buildTarget: import.meta.env.VITE_BUILD_TARGET,
});

// 尽早安装全局错误监听 + 预取运行时版本，确保崩溃上报能附带 OTA/原生版本。
installGlobalErrorHandlers();
void primeRuntimeVersions();

const root = ReactDOM.createRoot(document.getElementById("root")!);

async function renderApp() {
  startMobileUpdateRuntime();
  const { default: App } = await import("./App");
  root.render(
    <React.StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </React.StrictMode>,
  );
}

async function renderOfficialSite() {
  document.documentElement.classList.add("official-page-root");
  document.body.classList.add("official-page");
  document.title = "小宝记官网";
  const { default: OfficialSite } = await import("./OfficialSite");
  root.render(
    <React.StrictMode>
      <AppErrorBoundary>
        <OfficialSite />
      </AppErrorBoundary>
    </React.StrictMode>,
  );
}

void (shouldRenderOfficial ? renderOfficialSite() : renderApp());
