import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 构建产物直接输出到 ../public,由 Node 管理后台服务作为静态文件托管。
export default defineConfig({
  plugins: [react()],
  build: { outDir: "../public", emptyOutDir: true },
  server: { proxy: { "/admin-api": "http://localhost:8400" } },
});
