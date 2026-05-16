# Progress Log

## Current Verified State

- Repository root: `/Users/yaoyibin/Documents/ai-baby-growth-companion`
- Branch: `main`
- Standard start path: `bash harness/init.sh`
- Standard smoke gate: `git diff --check`, `npm run build`, `npm run test:agent-benchmark`
- Full gate: `bash harness/init.sh --full`
- Cloud target: `120.55.188.242:8300`
- Current highest-priority active feature: none
- Current blocker: none recorded for harness creation

## Session Log

### Session 2026-05-16 Expense Fix Cloud And OTA Release

- Goal: Review the cross-session OTA upload/download path changes, then commit, push, and release the current backend plus a fresh OTA bundle.
- Completed:
  - Checked the OTA path chain: `build-mobile-update.sh` writes the local bundle/manifest, `upload-mobile-update-oss.sh` uploads the zip to OSS and rewrites manifest with `ossObjectKey`, `deploy-aliyun-ecs.sh` can sync only `manifest.json`, and `MobileUpdateService` signs a fresh OSS URL from `ossObjectKey`.
  - Confirmed the current cloud service has `APP_STORAGE_MODE=oss`, OSS endpoint/bucket/prefix configured, and the existing production manifest already uses `baby-companion/mobile-updates/...`.
  - Built fresh OTA version `0.1.0-20260516140358` with message `修复多图记账并优化OTA下载`.
  - Uploaded `app-0.1.0-20260516140358.zip` to OSS under `baby-companion/mobile-updates/` and deployed backend code plus manifest-only OTA metadata to Aliyun `120.55.188.242:8300` without syncing production data.
- Verification run:
  - `bash harness/init.sh`
  - `mvn test -q`
  - `npm run verify:frontend`
  - `MOBILE_UPDATE_MESSAGE='修复多图记账并优化OTA下载' MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
  - `MOBILE_UPDATE_OSS_SSH_TARGET=ai-baby-aliyun scripts/upload-mobile-update-oss.sh`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 SYNC_MOBILE_UPDATE_MANIFEST_ONLY=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - Cloud `/api/health`, OTA check, OSS signed URL download, checksum probe, and up-to-date probe.
- Evidence:
  - Backend full Maven tests passed.
  - Frontend smoke passed across desktop and six mobile viewports.
  - Cloud health returned `ok`.
  - Cloud OTA check returns version `0.1.0-20260516140358`, signed OSS host `ai-baby-growth-companion.oss-cn-hangzhou.aliyuncs.com`, and object path `/baby-companion/mobile-updates/app-0.1.0-20260516140358.zip`.
  - Downloaded bundle size was `2638963` bytes and SHA-256 matched manifest checksum `4a98ea216826e56cdde2115d8a721b9a6fb8b7a9463d73ed319fbaf9b093dde2`.
  - Up-to-date probe for current bundle `0.1.0-20260516140358` returned `updateAvailable=false`.
- Known risks:
  - The OTA URL is a signed temporary OSS URL; clients should download soon after each check, and later checks will receive a fresh URL.

### Session 2026-05-16 OTA Bundle OSS Download Optimization

- Goal: Fix slow OTA bundle downloads by reducing mobile OTA bundle size and serving bundles from OSS instead of ECS public bandwidth.
- Completed:
  - Added a mobile-only frontend entry (`frontend/src/main.mobile.tsx`) and Vite mobile entry transform so `build:mobile:update` excludes website-only `/official` code and large landing assets.
  - Updated `scripts/build-mobile-update.sh` to set `VITE_BUILD_TARGET=mobile` and support explicit external bundle URL/base configuration.
  - Added `scripts/upload-mobile-update-oss.sh` to upload the generated OTA zip to Aliyun OSS using the existing OSS SDK dependency and rewrite the manifest with an `ossObjectKey`.
  - Updated `MobileUpdateService` so manifests with an OSS object key return a fresh signed OSS download URL during `/api/mobile-updates/check`.
  - Updated deployment flow with `SYNC_MOBILE_UPDATE_MANIFEST_ONLY=1` for OSS-hosted OTA bundles.
  - Built and published OTA `0.1.0-20260516134621` with message `优化OTA下载速度`.
  - Uploaded `app-0.1.0-20260516134621.zip` to OSS under `baby-companion/mobile-updates/` and synced only the manifest to Aliyun ECS.
- Verification run:
  - `MOBILE_UPDATE_MESSAGE='优化OTA下载速度' MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
  - `MOBILE_UPDATE_OSS_SSH_TARGET=ai-baby-aliyun scripts/upload-mobile-update-oss.sh`
  - `mvn -Dtest=MobileUpdateControllerTests test`
  - `npm run verify:frontend`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 SYNC_MOBILE_UPDATE_MANIFEST_ONLY=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - Cloud `/api/health`, OTA check, OSS bundle download, checksum probe, and up-to-date probe
  - `mvn test`
  - `git diff --check`
- Evidence:
  - Mobile OTA zip reduced from `6088639` bytes to `2638968` bytes; the mobile bundle no longer includes `hero-companion` or `splash-mark`.
  - Cloud OTA check returns version `0.1.0-20260516134621` with a signed OSS URL.
  - OSS download probe returned `200`, downloaded `2638968` bytes in `0.291882s`, and SHA-256 matched manifest checksum `e8c4b04e614e4ac25b93ea4a8546de7cb96b5af3b161e026697be0097c883a4a`.
  - Previous ECS bundle path for `6088639` bytes took `48.134758s` locally; server-local `127.0.0.1` was fast, confirming the old bottleneck was ECS public bandwidth plus bundle size.
  - Backend full Maven test passed: 141 tests, 0 failures.
  - Frontend smoke passed across desktop plus iPhone SE, iPhone 13, iPhone Pro Max, Android compact, Android Pixel, and Android large viewports.
  - Cloud up-to-date check for current bundle `0.1.0-20260516134621` returned `updateAvailable=false`.
- Known risks:
  - OSS signed URLs currently use the existing OSS signed URL TTL, so clients should start the download soon after each OTA check; future checks receive a fresh URL.
  - One large in-app image (`alarm-scene`, about 1.6MB) remains in the mobile bundle and can be compressed in a later asset pass.

### Session 2026-05-16 Pro AI Usage Display

- Goal: Let users see family AI token usage in the app and expose a family-scoped usage API.
- Completed:
  - Added `GET /api/pro/usage` to return current-family AI usage for a requested day window.
  - Added family-scoped usage aggregation by total, feature, and model using existing `ai_usage_log` records.
  - Added the Pro profile card AI usage panel with recent token total, call count, input/output split, top feature chips, model note, and refresh action.
  - Added frontend smoke mock data for `/api/pro/usage`.
  - Deployed the backend code-only update to Aliyun and published OTA `0.1.0-20260516125242`.
- Verification run:
  - `bash harness/init.sh`
  - `mvn -Dtest=ProTrialControllerTests test`
  - `mvn test`
  - `npm run build`
  - `npm run verify:frontend`
  - `git diff --check`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - Cloud `/api/health`, unauthenticated `/api/pro/usage`, OTA check, and OTA bundle HEAD probes
- Evidence:
  - Backend full Maven test passed: 135 tests, 0 failures.
  - Frontend smoke passed across desktop plus iPhone SE, iPhone 13, iPhone Pro Max, Android compact, Android Pixel, and Android large viewports.
  - Cloud health returned `ok`.
  - Cloud unauthenticated `/api/pro/usage` returned `401`, confirming the route is present and protected.
  - OTA check returns version `0.1.0-20260516125242` with message `新增 AI 用量统计`.
  - Bundle `app-0.1.0-20260516125242.zip` returned HTTP 200 with `Content-Length: 6088639`.
- Known risks:
  - Some streaming provider calls still do not return token usage, so the panel separately notes unmetered stream calls when they exist.
  - Live authenticated `/api/pro/usage` was covered by backend tests, but not probed against a production user token in this session.

### Session 2026-05-16 Reminder Icon Polish

- Goal: Make reminder task icons clearer and less visually harsh on the reminders page.
- Completed:
  - Changed reminder list icons from strong filled color blocks to soft outlined badges in the warm theme.
  - Increased reminder card icon size slightly for better legibility.
- Verification run:
  - `npm run verify:frontend`
  - `git diff --check`
  - `MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 MOBILE_UPDATE_MESSAGE='优化提醒待办图标显示' npm run build:mobile:update`
  - Manual `rsync` of `backend/data/mobile-updates/` to `/var/lib/ai-baby-growth-companion/mobile-updates/`
  - Cloud OTA check and bundle HEAD request
- Evidence:
  - Frontend build passed.
  - Frontend smoke passed across desktop plus iPhone SE, iPhone 13, iPhone Pro Max, Android compact, Android Pixel, and Android large viewports.
  - OTA version `0.1.0-20260516123512` is available from `http://120.55.188.242:8300/api/mobile-updates/check`.
  - Bundle `app-0.1.0-20260516123512.zip` returned HTTP 200 with `Content-Length: 6087325`.
- Known risks:
  - Visual taste still needs confirmation on the user's real device because the smoke screenshots do not contain the exact production reminder content shown in the user screenshot.

### Session 2026-05-16 KISS Structure Refactor

- Goal: Reduce frontend/backend structural debt while preserving existing business behavior.
- Completed:
  - Extracted frontend option/config constants from `App.tsx` into `frontend/src/appOptions.ts`.
  - Extracted the reusable `StorySelect` control from `App.tsx` into `frontend/src/components/StorySelect.tsx`.
  - Split StorySelect base styles from `styles.css` into `frontend/src/styles/story-select.css`.
  - Extracted Agent prompt text from `AgentRuntime` into `AgentPrompts`.
  - Extracted attachment MIME, dataURL, size-limit, and kind-normalization rules from `AttachmentStorageService` into `AttachmentUploadRules`.
  - Split `frontend/src/styles.css` into ordered stylesheet modules under `frontend/src/styles/`, leaving `styles.css` as the import hub.
  - Moved app state normalization, reminder/date parsing, legacy local-state, and profile helper functions from `App.tsx` into `frontend/src/appStateDomain.ts`.
  - Extracted `StorybookScene` and `AlbumVideoThumbnail` from `App.tsx` into focused component files.
  - Kept the prior state hydration KISS cleanup in `AppStateService` and related controller test alignment.
- Verification run:
  - `bash harness/init.sh`
  - `npm run build`
  - `mvn test`
  - `npm run verify:frontend`
  - `git diff --check`
- Evidence:
  - Harness smoke passed before the additional refactor.
  - Frontend build passed after component/config extraction.
  - Frontend build passed after the stylesheet/domain/component split.
  - Backend full Maven test passed: 134 tests, 0 failures.
  - Frontend smoke passed across desktop plus iPhone SE, iPhone 13, iPhone Pro Max, Android compact, Android Pixel, and Android large viewports.
- Known risks:
  - This was intentionally a low-risk structural split; `App.tsx`, `styles.css`, `AgentRuntime`, and `AttachmentStorageService` are smaller but still large enough to justify future domain-by-domain extraction after behavior-specific coverage is in place.

### Session 2026-05-14 OTA Timeout Diagnosis

- Goal: Diagnose why the mobile OTA update failed in the installed app and patch the updater timeout path.
- Completed:
  - Verified the cloud OTA check endpoint returns an update for `0.1.0-20260514185558`.
  - Verified the cloud bundle endpoint returns `200`, `Content-Length: 6086147`, and the downloaded zip checksum matches the manifest.
  - Confirmed the zip archive is valid with `unzip -t`.
  - Checked cloud logs and found mobile bundle downloads completed with `200` but took about 25 seconds.
  - Identified the likely failure: Capgo Capacitor Updater defaults `responseTimeout` to 20 seconds, so the installed native plugin can time out before the slow bundle download finishes.
  - Raised Capacitor Updater `responseTimeout` to 120 seconds and improved user-facing OTA failure copy for timeout/checksum/unzip cases.
  - Synced native projects and rebuilt Android/iOS debug targets.
  - Published a fresh OTA bundle `0.1.0-20260514190632`.
- Verification run:
  - Cloud `POST /api/mobile-updates/check`
  - Cloud `HEAD /api/mobile-updates/bundles/app-0.1.0-20260514185558.zip`
  - Local download + `shasum -a 256` + `unzip -t`
  - `npm run mobile:sync`
  - `VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:android:debug`
  - `VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:ios:debug`
  - `MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 SKIP_BACKEND_BUILD=1 ECS_HOST=120.55.188.242 SSH_KEY=<configured-key> npm run deploy:aliyun`
  - Cloud `POST /api/mobile-updates/check`
- Evidence:
  - Manifest checksum `9438f6c348102ae41824c752edcc6b8bff4afb1d14a7280241201bcfb594e1c5` matched the downloaded `0.1.0-20260514185558` zip.
  - `unzip -t` reported no archive errors.
  - Cloud logs showed `GET /api/mobile-updates/bundles/app-0.1.0-20260514185558.zip status=200 durationMs=24981` and another successful download around 25 seconds.
  - Android debug APK built at `android/app/build/outputs/apk/debug/app-debug.apk`.
  - iOS simulator build completed with `BUILD SUCCEEDED`.
  - Cloud OTA check now returns version `0.1.0-20260514190632`.
- Known risks:
  - The timeout fix changes native plugin configuration, so already-installed old packages still need a new native install before OTA becomes reliable on slow downloads.
  - Real-device OTA should be re-tested after reinstalling the new native package.

### Session 2026-05-14 Official Site Port 80 Deployment

- Goal: Publish the current official website build to Aliyun `120.55.188.242` on port `80` without touching production data.
- Completed:
  - Ran the standard harness smoke gate before deployment.
  - Rebuilt the frontend with `VITE_AGENT_API_BASE_URL=` so browser API calls use same-origin `/api` instead of a local development host.
  - Uploaded the `dist/` build to the ECS and served it from `/var/www/xiaobaoji`.
  - Installed and enabled Nginx on the ECS.
  - Configured Nginx to listen on port `80`, serve the SPA with fallback to `index.html`, cache `/assets/`, and reverse-proxy `/api/` to `127.0.0.1:8300`.
  - Ran the frontend smoke gate, then rebuilt and republished the same-origin production bundle.
- Verification run:
  - `bash harness/init.sh`
  - `npm run verify:frontend`
  - `VITE_AGENT_API_BASE_URL= npm run build`
  - `rg "localhost:8080|120\\.55\\.188\\.242:8300|/api/health" dist -n || true`
  - Remote `nginx -t`
  - Remote `curl -fsSI http://127.0.0.1/official`
  - Remote `curl -fsS http://127.0.0.1/api/health`
  - Local `curl -fsSI http://120.55.188.242/official`
  - Local `curl -fsS http://120.55.188.242/api/health`
  - Playwright smoke against `http://120.55.188.242/official`
- Evidence:
  - Harness smoke passed.
  - Frontend smoke passed across desktop and configured mobile viewports.
  - Production frontend build passed and did not contain `localhost:8080`.
  - Nginx syntax check passed and service is active.
  - ECS listeners include `0.0.0.0:80`, `[::]:80`, and backend `*:8300`.
  - Public `http://120.55.188.242/official` returned `200 OK`.
  - Public `http://120.55.188.242/api/health` returned `ok`.
  - Playwright verified title `小宝记官网`, H1 `小宝记`, and mobile scroll changed from `0` to `900`; screenshot saved under `.verification/official-site/cloud-official-mobile.png`.
- Known risks:
  - Download QR links are still placeholders until real iOS and Android package URLs are provided.

### Session 2026-05-14 Pro Trial Daily Summary OpenSpec Implementation

- Goal: Implement the OpenSpec change `add-pro-trial-daily-summary` for Pro trial application, family-scoped Pro status, AI usage logging, Pro daily summary, conservative missing-item prompts, and account-level daily summary reminders.
- Completed:
  - Added OpenSpec artifacts under `openspec/changes/add-pro-trial-daily-summary/` and marked implementation tasks through verification.
  - Added SQLite persistence for `pro_trial_application`, `pro_trial_entitlement`, `ai_usage_log`, `daily_summary`, and `daily_summary_setting`.
  - Added backend Pro APIs under `/api/pro/*` and surfaced Pro state, current daily summary, and daily summary settings in `/api/app/state`.
  - Added AI usage logging across backend model invocation paths and daily summary generation.
  - Added deterministic daily summary generation from family-shared data only, with account-private reminders/pending items shown only as current-account prompts and not persisted into the family summary payload.
  - Added frontend Pro entry points in the Record Today page, My page, and visual AI trigger path; non-Pro visual AI triggers now submit/show Pro trial flow without calling the high-cost model.
  - Added account-level daily summary reminder settings, mobile local notification scheduling, and notification click navigation to the Record Today page.
  - Added backend Pro controller tests and Agent benchmark boundary cases for gentle missing-item copy and private-content exclusion.
  - Deployed the code-only backend update to Aliyun `120.55.188.242:8300` with `SYNC_DATA=0`, preserving cloud SQLite data and uploaded files.
  - Marked the OpenSpec implementation task list complete through commit/push handoff.
- Verification run:
  - `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" "/Applications/IntelliJ IDEA.app/Contents/plugins/maven/lib/maven3/bin/mvn" -Dtest=ProTrialControllerTests test -q`
  - `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" "/Applications/IntelliJ IDEA.app/Contents/plugins/maven/lib/maven3/bin/mvn" test -q`
  - `npm run test:agent-benchmark`
  - `npm run build`
  - `npm run verify:frontend`
  - `npm run mobile:sync`
  - `npm run build:android:debug`
  - `npm run build:ios:debug`
  - `bash harness/init.sh`
  - `SYNC_DATA=0 ECS_HOST=120.55.188.242 SSH_KEY=<configured-key> npm run deploy:aliyun`
  - `curl -fsS http://120.55.188.242:8300/api/health`
- Evidence:
  - Backend full Maven test passed.
  - `docs/agent-benchmark-results.md` reports PASS, 15 tests, 0 failures.
  - Frontend smoke passed across desktop and configured mobile viewports.
  - Android debug APK built at `android/app/build/outputs/apk/debug/app-debug.apk`.
  - iOS simulator build completed with `BUILD SUCCEEDED`.
  - Cloud health returned `ok` after deployment.
- Known risks:
  - Daily summary generation is currently deterministic rule-based rather than a paid model call; usage is still logged as `daily_summary` for cost pipeline compatibility.
  - Daily summary reminder delivery was build-verified only; real-device notification behavior should be validated on Android/iOS before inviting beta families.
  - OpenSpec change is implemented but not archived.

### Session 2026-05-14 Frontend Directory Release Flow Check

- Goal: Verify the current release flow after moving frontend source/config into `frontend/`, without changing cloud production state.
- Completed:
  - Confirmed the standard harness smoke gate still works from the repository root.
  - Built the web app through the new `frontend/vite.config.ts` path.
  - Built an OTA bundle with `MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300` and `VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300`.
  - Built Android debug APK with cloud API URL.
  - Built iOS simulator debug app with cloud API URL.
  - Confirmed the current cloud health endpoint returns `ok`.
- Verification run:
  - `git diff --check`
  - `bash harness/init.sh`
  - `npm run verify:frontend`
  - `MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
  - `VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:android:debug`
  - `VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:ios:debug`
  - `curl -fsS http://120.55.188.242:8300/api/health`
- Evidence:
  - Harness smoke passed, including frontend build and Agent benchmark.
  - Frontend verification passed across configured mobile/desktop viewports.
  - OTA bundle generated as `0.1.0-20260514151614`.
  - Android debug APK built at `android/app/build/outputs/apk/debug/app-debug.apk`.
  - iOS simulator build completed with `BUILD SUCCEEDED`.
  - Cloud health returned `ok`.
- Known risks:
  - Cloud deployment was intentionally not executed in this check because the deploy script has no dry-run mode and would restart the live service.

### Session 2026-05-14 OTA Progress Display

- Goal: Make OTA download progress truthful instead of showing a fake `0%` state until completion.
- Completed:
  - OTA download UI now starts in an indeterminate “下载中” state until the native updater emits a real positive percent.
  - Native download events are logged with their raw payload and parsed progress to help diagnose platform-specific progress behavior.
  - Frontend smoke now covers mobile update notice rendering for indeterminate and determinate progress.
  - Reminder sheet bottom spacing was widened slightly after the frontend gate exposed a 360px safe-area edge miss.
- Verification run:
  - `npm run build`
  - `npm run verify:frontend`
- Evidence:
  - `npm run build` passed.
  - `npm run verify:frontend` passed across desktop and six mobile viewports, including OTA progress notice smoke coverage.
- Known risks:
  - If the native updater only emits `0` and `100` on a platform/update path, the UI will honestly show an indeterminate download state and then completion; it will not invent intermediate percentages.

### Session 2026-05-13 Harness Baseline

- Goal: Build a repo-local harness based on the Learn Harness Engineering template, with only `AGENTS.md` at root and all new harness files under `harness/`.
- Completed:
  - Upgraded root `AGENTS.md` into the standard agent entrypoint.
  - Added harness files for feature tracking, progress, init, quality, cleanup, handoff, and evaluator rubric.
  - Kept existing frontend verification instructions and linked them into the harness rules.
- Verification run:
  - `bash harness/init.sh`
- Evidence:
  - Passed `git diff --check`.
  - Passed `npm run build`.
  - Passed `npm run test:agent-benchmark` with 13 tests, 0 failures, result written to `docs/agent-benchmark-results.md`.
- Known risks:
  - Existing uncommitted product changes predate this harness task and must not be reverted by the harness work.
- Next best action:
  - For the next feature, choose scope from `harness/feature_list.json` or add a new feature entry before implementation.

### Session 2026-05-15 Shared Contributor And Ledger Attachments

- Goal: Show a unified contributor label for records, ledger entries, and album media; hydrate and preview ledger attachments; verify the existing cloud expense `8887.24` for user `18915618653`.
- Completed:
  - Added runtime `recordedBy` metadata for family-shared state rows and care-log timeline events, using the family member role as the user-facing label.
  - Hydrated `attachmentId` and `attachmentIds` references into full attachment metadata so ledger entries can show clickable image/video/audio attachments.
  - Added frontend display for `记录人` in records, ledger, and album, plus ledger attachment preview buttons.
  - Preserved original creator attribution when existing shared rows are updated.
  - Confirmed cloud user `18915618653` belongs to family `family-eb3f4751-2df9-46b4-920e-6634c4013d50`; expense `expense-1` amount `8887.24` already has attachment `attachment-mp2lomag-chc0xt`, so no production DB mutation was needed.
  - Deployed code and OTA assets to Aliyun `120.55.188.242` with production data sync disabled.
- Verification run:
  - `npm run build`
  - `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" "/Applications/IntelliJ IDEA.app/Contents/plugins/maven/lib/maven3/bin/mvn" -q -f backend/pom.xml -Dtest=AppStateControllerTests test`
  - `npm run verify:frontend`
  - `MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/bytedance/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - `npm run test:cloud-e2e`
  - `bash harness/init.sh`
- Evidence:
  - Backend targeted test passed with contributor and expense attachment hydration coverage.
  - Frontend verification passed across desktop and configured mobile viewports.
  - Cloud health returned `ok` after deployment.
  - Cloud E2E passed 10/10 cases, including timeline `记录人`, ledger CRUD with attachment preview, album view, reminder flow, and real Agent text flow.
  - Final harness init passed with whitespace check, frontend build, and Agent benchmark.
  - Detailed iteration note is saved at `docs/record-contributor-attachment-e2e-plan.md`; E2E result is saved at `docs/automation-test-results.md`.
- Known risks:
  - The cloud `8887.24` expense fix depends on the existing linked attachment record remaining available in object/local storage; this run verified the DB relationship and new metadata hydration path, not manual visual review of the original receipt content.

### Session 2026-05-15 Album Gallery Metadata Placement

- Goal: Keep album gallery tiles visually clean and move title/date/category/recorded-by details into the click-through preview detail panel.
- Completed:
  - Removed the title and recorded-by block from album gallery tiles.
  - Added `记录人` to the album preview detail panel alongside date and category.
  - Published OTA bundle `0.1.0-20260515153705` to Aliyun `120.55.188.242`.
- Verification run:
  - `bash harness/init.sh`
  - `npm run verify:frontend`
  - `MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 SKIP_BACKEND_BUILD=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/bytedance/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - Cloud `POST /api/mobile-updates/check`
- Evidence:
  - Frontend smoke passed across desktop and configured mobile viewports.
  - Cloud update check returns version `0.1.0-20260515153705`.
  - Cloud health returned `ok`.

### Session 2026-05-16 Expense Image Chat Reliability

- Goal: Fix user `13777892890` chat expense-recognition issues: multi-image sends were capped too low, expense screenshot recognition triggered meaningless web search, and recognized amounts could still be followed by an amount clarification.
- Completed:
  - Raised chat visual attachment handling from 4 to 8 to match backend request validation, including model visual input forwarding, and added a clear notice when a browser selection exceeds the chat cap.
  - Suppressed `web_search` planning/tool routing for order, receipt, invoice, payment, or expense image recognition tasks while preserving web search for policy and reference-price questions.
  - Changed expense effect resolution so complete model-recognized expenses override the rule extractor's missing-amount question, and normalized final copy when a pending expense draft already exists.
  - Added planner, effect-policy, runtime, and benchmark tests for the expense image path.
- Verification run:
  - `mvn -q -Dtest=AgentPlannerTests,EffectPolicyTests,AgentRuntimeTests,AgentBenchmarkTests test`
  - `npm run test:agent-benchmark`
  - `npm run verify:frontend`
- Evidence:
  - Targeted backend tests passed with new coverage for no expense-image web search and no redundant amount question.
  - Agent benchmark passed and refreshed `docs/agent-benchmark-results.md`.
  - Frontend verification passed across desktop and six mobile viewports, with screenshots under `.verification/frontend-smoke/`.
- Known risks:
  - Chat still intentionally caps one message at 8 visual attachments because backend validation and model input forwarding are aligned to 8; selecting more than 8 now surfaces an explicit notice instead of silently dropping extras.

## Operational Notes

- Use `npm run test:agent-benchmark` for Agent behavior changes.
- Use `npm run verify:frontend` for UI or layout changes.
- Use `npm run mobile:sync` plus platform debug builds for native-risk changes.
- Use `SYNC_DATA=0 ECS_HOST=120.55.188.242 npm run deploy:aliyun` for code-only cloud updates unless the user explicitly requests data sync or reset.
