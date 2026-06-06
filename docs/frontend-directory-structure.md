# 前端目录整理记录

更新时间：2026-06-06

## Summary

为降低仓库根目录噪声，前端源码和前端专用构建配置统一收敛到 `frontend/`。根目录继续保留仓库级脚本、移动端工程、后端工程、文档和部署入口。

## 当前结构

| 路径 | 职责 |
| --- | --- |
| `frontend/index.html` | Vite Web 入口。 |
| `frontend/src/` | React、TypeScript、样式和 Web 资产。 |
| `frontend/vite.config.ts` | 前端 Vite 构建配置。 |
| `frontend/tsconfig.json` | 前端 TypeScript 配置。 |
| `package.json` | 仓库级 npm 脚本入口，仍从根目录执行。 |
| `dist/` | 前端构建产物，仍输出到根目录供 Capacitor 和 OTA 使用。 |
| `capacitor.config.ts` | Capacitor 原生壳配置，继续使用 `webDir: "dist"`。 |

## 约定

- 日常命令不变：继续在仓库根目录运行 `npm run dev`、`npm run build`、`npm run verify:frontend`。
- Vite 通过 `frontend/vite.config.ts` 构建，产物写入根目录 `dist/`。
- Android/iOS 原生工程不直接引用 `frontend/`，只消费构建后的 `dist/`。
- 后续新增 Web 组件、hooks、样式和 Web 资产应放在 `frontend/src/` 下。
