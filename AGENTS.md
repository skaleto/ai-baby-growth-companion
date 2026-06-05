# AGENTS.md

This repository uses a repo-local harness for long-running agent work. The goal is not to move fast by memory; the goal is to let the next session restart from files in the repo, run the same gates, and continue without guessing.

All harness files live under `harness/` except this root entry file.

## Start Every Session

1. Confirm the repository root with `pwd`.
2. Read `harness/project-index.md` for the repository navigation map.
3. Read `harness/claude-progress.md` for the latest verified state and next step.
4. Read `harness/feature_list.json` before choosing or changing feature scope.
5. Check `git status --short` and `git log --oneline -5`.
6. Run the standard harness entrypoint:

```bash
bash harness/init.sh
```

If the baseline gate fails, fix the baseline first or clearly record the blocker before stacking more work on top.

## Required Harness Files

- `harness/feature_list.json`: feature state and evidence tracker.
- `harness/project-index.md`: top-level repository navigation map.
- `harness/claude-progress.md`: current progress, validated state, and next action.
- `harness/init.sh`: standard repo initialization and verification entrypoint.
- `harness/quality-document.md`: quality snapshot by product area and architecture layer.
- `harness/clean-state-checklist.md`: final handoff checklist.
- `harness/session-handoff.md`: optional long-session handoff note.
- `harness/evaluator-rubric.md`: review rubric before accepting work.

## Project Rules

- This is a mobile-first React + Capacitor app with a Java/Spring backend.
- Preserve user or prior-agent changes. Never revert unrelated work to make your diff cleaner.
- One active feature at a time. Do not widen scope unless it removes a direct blocker.
- Major product iterations should leave a concise markdown plan or record under `docs/`.
- Agent behavior changes must update or run the agent benchmark:

```bash
npm run test:agent-benchmark
```

- UI, styling, mobile layout, navigation, forms, keyboard behavior, or user-facing interaction changes must follow `docs/frontend-verification.md`.
- Build success alone is not enough evidence for UI work. Use:

```bash
npm run verify:frontend
```

- Native-risk changes touching `capacitor.config.ts`, `ios/`, `android/`, native plugins, permissions, camera/media/file/audio/haptics/notifications, safe areas, keyboard, or WebView-only logic must run:

```bash
npm run mobile:sync
```

Then attempt the relevant native build when the local environment supports it:

```bash
npm run build:ios:debug
npm run build:android:debug
```

## Cloud And Data Safety

- Current Aliyun host is `120.55.188.242`; older `8.210.235.155` references are stale unless the user explicitly says otherwise.
- Default backend port is `8300`.
- Deployment script defaults are in `scripts/deploy-aliyun-ecs.sh`.
- Do not overwrite or sync production data unless the user explicitly asks for data migration/reset. For code-only deployment, prefer:

```bash
SYNC_DATA=0 ECS_HOST=120.55.188.242 npm run deploy:aliyun
```

- Production evidence should include service health plus persisted behavior when relevant; `/api/health` alone does not prove Agent, reminder, media, or state persistence behavior.
- **⚠️ 移动热更新（OTA）发布是高危操作，必须显式注入 API base URL（2026-06-05 生产事故教训）。** 构建 OTA 包时若不设 `VITE_AGENT_API_BASE_URL`，前端会静默 fallback 到 `http://localhost:8080`，导致**所有更新到该包的 App 全量 `load failed`**——而且 OTA check 也走同一个 base URL，中招用户连修复包都拉不到（只能重装），没中招用户会继续 check 到坏包跟着中招、故障扩散。硬性规则：
  - 构建 OTA 必须传生产地址：`VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`。`scripts/build-mobile-update.sh` 已加防护——base URL 为空时报错退出，不再静默 fallback。
  - 发布后**必须验证 base URL**：解压 bundle 用 `grep` 确认编译进去的是 `120.55.188.242:8300` 而非 `localhost:8080`，再确认 OTA check API 返回正确 url+checksum，且下载的 bundle checksum 匹配。
  - OTA 只升不降：发了坏包要回滚，必须构建一个**版本号更高**的正确包覆盖，不能简单把 manifest 指回旧版本（已更新的设备不会降级）。
  - 紧急止扩散：第一时间把生产 `mobile-updates/manifest.json` 的 `enabled` 置 false，阻止未中招设备继续更新到坏包。
  - **native app 内置包同理**：`build:ios:debug` / `build:android:debug` / `mobile:sync` 内部的 `npm run build` 同样会 fallback 到 localhost。这些脚本已改为默认注入生产 base URL（可被 `VITE_AGENT_API_BASE_URL` override，本地联调时设 localhost）。Xcode / Android Studio 直接 build 前，务必先用注入了生产 URL 的命令 `npm run build && npx cap sync` 刷新内置包，并确认 `ios/App/App/public/assets/*.js`（或 android assets）里的 base URL 是生产地址，否则真机装上去也是 `load failed`。

## Definition Of Done

A feature is done only when:

- the target behavior is implemented;
- the appropriate verification was actually run;
- evidence is recorded in `harness/feature_list.json`, `harness/claude-progress.md`, or the relevant `docs/` result file;
- known gaps and blocked checks are explicit;
- the repo can be restarted through `bash harness/init.sh`.

## End Every Session

Before final handoff:

1. Update harness progress or feature evidence when the work is substantial.
2. Run `git diff --check`.
3. Run the smallest verification that matches the risk.
4. Mention commands run, blocked checks, and residual risk.
5. Leave the worktree state clear in the final answer.
