import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { startMobileUpdateRuntime } from "./mobileUpdates";
import "./styles.css";

startMobileUpdateRuntime();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
