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
  },
});
