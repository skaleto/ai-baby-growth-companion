import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import OfficialSite from "./OfficialSite";
import { startMobileUpdateRuntime } from "./mobileUpdates";
import "./styles.css";

const officialPaths = new Set(["/official", "/landing", "/website"]);
const normalizedPath = window.location.pathname.replace(/\/$/, "") || "/";
const shouldRenderOfficialSite = officialPaths.has(normalizedPath);

if (!shouldRenderOfficialSite) {
  startMobileUpdateRuntime();
} else {
  document.documentElement.classList.add("official-page-root");
  document.body.classList.add("official-page");
  document.title = "小宝记官网";
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {shouldRenderOfficialSite ? <OfficialSite /> : <App />}
  </React.StrictMode>,
);
