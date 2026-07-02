import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const isMobileBuild = process.env.VITE_BUILD_TARGET === "mobile";

export default defineConfig({
  root: "frontend",
  plugins: [
    react(),
    {
      name: "xiaobao-mobile-entry",
      transformIndexHtml: {
        order: "pre",
        handler(html) {
          if (!isMobileBuild) return html;
          return html.replace("/src/main.tsx", "/src/main.mobile.tsx");
        },
      },
    },
  ],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // 评审 P1:把稳定的第三方(react/react-dom/scheduler、lucide 图标)拆成独立 vendor chunk,
        // 应用代码改动时不失效,浏览器可长缓存 + 并行加载。antd-mobile / Plyr / photoswipe 已由各自的
        // 动态 import 自动分割,这里不手动指派(避免把它们又拉回同步)。
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/scheduler/")) return "vendor-react";
          if (id.includes("/lucide-react/")) return "vendor-icons";
          return undefined;
        },
      },
    },
  },
});
