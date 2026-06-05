# 生产事故复盘：OTA 包 base URL 配错导致全量 load failed

- 日期：2026-06-05
- 等级：严重（生产 App 登录/全功能不可用）
- 状态：已修复 + 已加防护

## 现象

用户用手机号 + 邀请码登录提示 `load failed`。排查发现登录请求根本没到后端（后端日志无 `POST /api/auth/login`，无 4xx/5xx）。

## 根因

OTA 包 `0.1.0-20260604235729`（昨晚发布的相册修复包）**构建时漏设 `VITE_AGENT_API_BASE_URL`**。`scripts/build-mobile-update.sh` 的旧逻辑在 base URL 为空时**静默 fallback**（不注入），前端代码 `apiBaseUrl = VITE_AGENT_API_BASE_URL ?? "http://localhost:8080"` 就编译进了 `localhost:8080`。

解压 bundle 验证：该包编译进的是 `localhost:8080`；历史所有正常包都是 `120.55.188.242:8300`。

## 影响链（为什么严重）

- 更新到该包的 App，所有 WebView 请求打到手机本地 `localhost:8080`（不存在）→ 全部 `load failed`。
- **OTA check 也走同一个 `apiBaseUrl`**（`mobileUpdates.ts`），所以中招设备连"检查新版本"都失败 → **拉不到修复包，只能重装**。
- 没中招设备的 App 会继续 check 到坏包 → 更新 → 跟着中招 → **故障扩散**。

## 时间线（修复）

1. 确认后端健康、login endpoint 正常（curl 0.17s 返回业务错误）——排除后端问题。
2. 确认根因：bundle base URL = localhost；构建脚本静默 fallback。
3. **止扩散**：生产 `manifest.json` `enabled=false`，check 立即返回 `updateAvailable:false`。
4. **重构正确包**：从相册修复 commit `ec0ece9` 用 `VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300` 构建 `0.1.0-20260605122812`，解压验证 base URL = `120.55.188.242:8300`。
5. **发布**：上传 + manifest 指向新包 + `enabled=true`；check API 返回正确 url+checksum，下载 checksum 匹配。
6. **防复发**：`build-mobile-update.sh` 改为 base URL 为空时报错退出（commit `8e1b206`）。

## 预防（已落地）

- `scripts/build-mobile-update.sh`：base URL 为空时 `exit 1`，不再静默 fallback。
- `AGENTS.md` Project Rules 增加 OTA 高危准则：必须显式传生产 base URL、发布后必须验证 base URL、OTA 只升不降、紧急止扩散先置 `enabled=false`。

## 遗留

- 已中招设备（base URL=localhost）需**重装 App** 恢复（重装用内置包，base URL 正确，再 OTA 到新包）。`@capgo` 自动 revert 行为未确认，不能依赖。
- 待办：把"构建后自动 grep 验证 bundle base URL"接进发布流程，作为机器化 gate。
