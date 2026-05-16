import React from "react";
import ReactDOM from "react-dom/client";
import { startMobileUpdateRuntime } from "./mobileUpdates";
import "./styles.css";

const officialPaths = new Set(["/official", "/landing", "/website"]);
const normalizedPath = window.location.pathname.replace(/\/$/, "") || "/";
const shouldRenderOfficialSite = officialPaths.has(normalizedPath);
const isMobileBuild = import.meta.env.VITE_BUILD_TARGET === "mobile";

const root = ReactDOM.createRoot(document.getElementById("root")!);

async function renderApp() {
  startMobileUpdateRuntime();
  const { default: App } = await import("./App");
  root.render(
    <React.StrictMode>
      <App />
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
      <OfficialSite />
    </React.StrictMode>,
  );
}

void (shouldRenderOfficialSite && !isMobileBuild ? renderOfficialSite() : renderApp());
