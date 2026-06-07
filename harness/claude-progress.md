# Progress Log

## Current Verified State

- Repository root: `/Users/bytedance/Documents/ai-baby-growth-companion`
- Branch: `main`
- Standard start path: `bash harness/init.sh`
- Standard smoke gate: `git diff --check`, `npm run build`, `npm run test:agent-benchmark`
- Full gate: `bash harness/init.sh --full`
- Cloud target: `120.55.188.242:8300`
- Current product source of truth: `harness/app-development-roadmap.md`
- Current implementation input set:
  - `docs/superpowers/specs/2026-06-06-module-native-ai-records-album-ledger-spec.md`
  - `docs/superpowers/specs/2026-06-06-agent-tool-first-recording-architecture-spec.md`
  - `docs/superpowers/specs/2026-06-06-product-simplification-records-trust-spec.md`
  - `docs/research-archive/records-album-domestic-app-research-2026-06-06.md`
- Current blocker: none recorded.

## Current Decisions

1. Product boundary remains "recording and companionship"; no ecommerce, experts, paid knowledge content, or open community in the current build path.
2. May decision documents and old daily-summary / visual-refresh / PRD artifacts are not current direction and have been deleted from the workspace.
3. Independent `聊天` and `提醒` bottom tabs should not drive the next product shape. Target main navigation is `记录 / 相册 / 账本 / 我的`.
4. AI should be module-native:
   - Records: text/voice "记一笔" as a lightweight input for care logs, growth measurements, milestones, and follow-up cards.
   - Album: P0 is a by-day media timeline, not an AI center.
   - Ledger: manual ledger remains; image/order/receipt recognition is a later Pro-oriented enhancement.
5. Agent write architecture should move to tool-first actions for records and ledger:
   - P0 is now a full cutover for retained Records/Ledger AI write paths, not a feeding-first or partial migration.
   - P0 tools cover feeding, sleep, diaper, temperature, growth measurements, growth events/milestones, and text ledger expenses when those capabilities remain AI-supported.
   - `pending` means persisted in `pending_effect` and visible through app state, not a model-only draft or frontend-only card.
   - AI reminder/todo tools are out of scope for this migration.
   - `RecordSignalExtractor` and `EffectPolicy` should be deleted or fully disconnected from production Agent write paths after migration; no fallback/shadow/half-migration.
6. Frontend state source should be app state / backend-persisted effects, not frontend reconstruction from non-persisted `effectDecisions`.
7. For the current rapid UI iteration loop, the user asked future verified fixes to be published automatically after implementation unless they explicitly say not to publish.

## Latest Session Notes

### 2026-06-07 Records Timeline Density And Swipe Actions Fix

- Refined Records page timeline and AI processing UI:
  - `AI 自动记录` processing state now renders as an AI message bubble inside the recent-content thread, not as a standalone composer status.
  - The daily timeline now uses a real timeline layout: left rail + dot connector, time label above each entry, and content in compact rectangular cards.
  - Timeline cards were compressed to a two-line dense layout: title/value on the primary row, tag/creator on the secondary row.
  - Cards use low-radius rectangular styling (`8px`) instead of rounded pill/card edges.
  - Care-event cards no longer show a default edit button; left-swipe reveals matching rectangular `编辑 / 删除` actions.
  - Delete uses a second confirmation dialog before removing the care event from the day log and recalculating stats.
- Verification passed on 2026-06-07:
  - `npm run test:product-simplification` red/green covered processing bubble placement, swipe action structure, low-radius rectangular cards, and compact two-line timeline rows.
  - `npx tsc -p frontend/tsconfig.json --noEmit`
  - `npm run verify:frontend` passed desktop plus mobile viewports `375x667`, `390x844`, `430x932`, `360x800`, `412x915`, and `432x960`.
  - Targeted Playwright visual probes passed:
    - `.verification/drawer-ui/records-timeline-rectangular-compact-card-390x844.png`
    - `.verification/drawer-ui/records-timeline-rectangular-swipe-actions-390x844.png`
    - `.verification/drawer-ui/records-timeline-delete-confirm-final-390x844.png`
    - `.verification/drawer-ui/records-ai-processing-bubble-rectangular-pass-390x844.png`
    - `.verification/drawer-ui/records-rectangular-timeline-processing-check.json`
  - `git diff --check`
  - `harness/feature_list.json` JSON parse
- Published to ECS and OTA automatically per current UI iteration preference:
  - OTA version `0.1.0-20260607221114`
  - checksum `f9f5cd3dde345eff3b89efcc433ca3c8b1ae723b734cdd8375cc975e1230179d`
  - deploy command: `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/bytedance/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - local OTA bundle contained `120.55.188.242:8300`, 0 `localhost:8080` hits, checksum matched manifest, and root `index.html`;
  - live `/api/health` returned `ok`;
  - `systemctl is-active ai-baby-growth-companion` returned `active`;
  - `POST /api/mobile-updates/check` returned update version `0.1.0-20260607221114` for previous bundle `0.1.0-20260607210050`;
  - `POST /api/mobile-updates/check` returned no update for current bundle `0.1.0-20260607221114`;
  - downloaded remote bundle checksum matched manifest and contained production API base URL with 0 `localhost:8080` hits.

### 2026-06-07 Records AI Processing Input Responsiveness Fix

- Fixed the Records `AI 自动记录` drawer processing state and composer lockout:
  - while the AI request is still running, the drawer now shows a familiar three-dot inline loading state with `正在整理`;
  - Records drawer keyboard input and voice input remain available during processing, avoiding the 3-4 second gray/disabled dead period after the AI asks a follow-up question;
  - submit is still disabled while a request is in flight, so the user can prepare or speak the next input without creating concurrent submissions.
- Implementation detail:
  - introduced `canUseComposerInput = !isSubmitting || recordsEntryDrawer === "ai"` to separate "input affordance availability" from "send availability";
  - Records AI drawer voice toggle, voice hold button, and textarea use `canUseComposerInput`;
  - `toggleComposerMode` and `startVoicePress` share the same guard.
- Verification passed on 2026-06-07:
  - `npm run test:product-simplification` red/green covered the Records assistant processing state, three-dot loader, and removal of direct `disabled={isSubmitting}` from drawer input controls.
  - `npm run test:voice-capture-panel`
  - Targeted Playwright slow-SSE visual probes passed:
    - `.verification/drawer-ui/records-ai-processing-loading-390x844.png`
    - `.verification/drawer-ui/records-ai-processing-voice-enabled-390x844.png`
    - `.verification/drawer-ui/records-ai-processing-keyboard-enabled-390x844.png`
    - `.verification/drawer-ui/records-ai-processing-check.json`
    - `.verification/drawer-ui/records-ai-processing-keyboard-check.json`
  - `npm run verify:frontend` passed desktop plus mobile viewports `375x667`, `390x844`, `430x932`, `360x800`, `412x915`, and `432x960`.
  - `git diff --check`
  - `harness/feature_list.json` JSON parse
- Published to ECS and OTA automatically per current UI iteration preference:
  - OTA version `0.1.0-20260607210050`
  - checksum `a2c9024a5691141a63b49df042a994e15ed7360ba620ffc04e1ba91d86b32ac0`
  - deploy command: `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/bytedance/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - local OTA bundle contained `120.55.188.242:8300`, 0 `localhost:8080` hits, checksum matched manifest, and root `index.html`;
  - live `/api/health` returned `ok`;
  - `systemctl is-active ai-baby-growth-companion` returned `active`;
  - `POST /api/mobile-updates/check` returned update version `0.1.0-20260607210050` for previous bundle `0.1.0-20260607203321`;
  - `POST /api/mobile-updates/check` returned no update for current bundle `0.1.0-20260607210050`;
  - downloaded remote bundle checksum matched manifest and contained production API base URL with 0 `localhost:8080` hits.

### 2026-06-07 Records Quick Prompt And Drawer Voice Layer Fix

- Fixed two Records UI regressions from screenshot review:
  - `试试 喂奶 / 睡眠 / 成长 / 记账 / 问 AI` prompt links now stay text-only and transparent after the later `warm-theme.css` import; they no longer inherit cream button background, border, hover lift, or pill shadow.
  - The voice recording breathing panel now renders through a body portal instead of inside `.app-shell`, so it can appear above the body-level Records full-screen drawer despite `.app-shell { isolation: isolate; }`.
  - Closing a Records entry drawer now cancels active voice capture, preventing the recording panel from being revealed on the underlying main page after the drawer closes.
- Verification passed on 2026-06-07:
  - `npm run test:product-simplification` red/green covered transparent Records quick prompt links, no inherited shadows, and adaptive Records AI context bubbles.
  - `npm run test:voice-capture-panel` red/green covered body-portal voice panel layering, `z-index: 3600`, and drawer-close cancellation.
  - Targeted Playwright visual probe with mock authenticated state and mock ASR WebSocket passed:
    - `.verification/drawer-ui/records-quick-prompts-transparent-390x844.png`
    - `.verification/drawer-ui/records-ai-drawer-bubbles-390x844.png`
    - `.verification/drawer-ui/records-ai-drawer-voice-panel-390x844.png`
    - `.verification/drawer-ui/records-drawer-ui-check.json`
  - `npm run verify:frontend` passed desktop plus mobile viewports `375x667`, `390x844`, `430x932`, `360x800`, `412x915`, and `432x960`.
  - `git diff --check`
  - `harness/feature_list.json` JSON parse
- Published to ECS and OTA automatically per current UI iteration preference:
  - OTA version `0.1.0-20260607203321`
  - checksum `e4474e5ec83ac93dffc41a22db23a8e6e4978419f9f2ca8eeb69a919239b1c0e`
  - deploy command: `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/bytedance/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - local OTA bundle contained `120.55.188.242:8300`, 0 `localhost:8080` hits, checksum matched manifest, and root `index.html`;
  - live `/api/health` returned `ok`;
  - `systemctl is-active ai-baby-growth-companion` returned `active`;
  - `POST /api/mobile-updates/check` returned update version `0.1.0-20260607203321` for previous bundle `0.1.0-20260607195646`;
  - `POST /api/mobile-updates/check` returned no update for current bundle `0.1.0-20260607203321`;
  - downloaded remote bundle checksum matched manifest and contained production API base URL with 0 `localhost:8080` hits.

### 2026-06-07 Records Entry Drawers And Growth Tab

- Implemented the Records page IA refinement:
  - `AI 自动记录` now opens a dedicated Records AI drawer instead of expanding inline cards inside the page.
  - `手动记录` now opens a dedicated manual record drawer with type-specific tabs for `喂奶 / 睡眠 / 便便尿布 / 体温 / 辅食 / 备注`.
  - Manual record saves now create a concrete `careLog.events` item and then derive same-day summary stats through `careLogWithEventStats`, keeping totals and timeline in one source of truth.
  - `成长` is now a peer Records tab beside `今日 / 趋势 / 日历`; the old Growth card is no longer rendered in the Today block.
  - Growth tab includes a lightweight SVG growth curve for `身高 / 体重 / 头围`, plus the existing Growth data entry and Growth observation entry.
  - Records entry drawers were changed from a small bottom sheet to full-screen drawers after screenshot review.
- Verification passed on 2026-06-07:
  - `npm run test:product-simplification` red/green covered Growth peer tab, drawer structure, full-screen drawer CSS, and manual type tabs.
  - `npx tsc -p frontend/tsconfig.json --noEmit`
  - `npm run verify:frontend`
  - Targeted screenshots reviewed:
    - `.verification/frontend-smoke/iphone-13-390x844.png`
    - `.verification/frontend-smoke/records-ai-drawer-390x844.png`
    - `.verification/frontend-smoke/records-manual-drawer-390x844.png`
- Not deployed in this session.

### 2026-06-07 Records Drawer Visual Polish

- Refined the Records `AI 自动记录` drawer after screenshot review:
  - the drawer now uses a full-screen structure of header, scrollable recent context, and bottom-anchored composer;
  - recent context is shown as compact preview rows instead of raw chat content bleeding into the input area;
  - the Records quick-entry area no longer sits on a mismatched white/cream card background;
  - keyboard-open state now shrinks the full-screen drawer above the keyboard and keeps the focused input clear of the keyboard edge.
- Verification passed on 2026-06-07:
  - `npm run test:product-simplification`
  - `npm run build`
  - targeted Playwright screenshots:
    - `.verification/drawer-ui/records-page-entry-390x844.png`
    - `.verification/drawer-ui/records-ai-drawer-current-390x844.png`
    - `.verification/drawer-ui/records-ai-drawer-keyboard-375x667.png`
  - targeted keyboard simulation: 375x667 viewport, keyboard inset 280px, focused field bottom 351px, keyboard top 387px.
  - `npm run verify:frontend`
- Published to ECS and OTA after user approval in the same session:
  - OTA version `0.1.0-20260607193137`
  - checksum `4a9e0c4e4af5cb920b3974d877de8be41dd119f2df0d28cb061e99e92d634666`
  - deploy command: `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/bytedance/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - local OTA bundle contained `120.55.188.242:8300`, 0 `localhost:8080` hits, and root `index.html`;
  - live `/api/health` returned `ok`;
  - `POST /api/mobile-updates/check` returned update version `0.1.0-20260607193137` for previous bundle `0.1.0-20260607185551`;
  - `POST /api/mobile-updates/check` returned no update for current bundle `0.1.0-20260607193137`;
  - downloaded remote bundle checksum matched manifest and contained production API base URL with 0 `localhost:8080` hits;
  - `systemctl is-active ai-baby-growth-companion` returned `active`.

### 2026-06-07 Records AI Context Bubble Finalization

- After user review, selected the adaptive left/right bubble style for Records `AI 自动记录` recent context:
  - AI messages stay left and parent messages stay right;
  - bubbles use content-adaptive width and height with max-width only to prevent viewport overflow;
  - recent message text is not clamped or hidden;
  - the composer bar spans the full drawer width instead of being clipped by side padding;
  - keyboard-open state keeps the drawer background covering the full viewport while padding content above the keyboard.
- Verification passed on 2026-06-07:
  - `npm run verify:frontend`
  - `git diff --check`
  - `harness/feature_list.json` JSON parse
  - screenshot comparison artifact kept for review:
    - `.verification/drawer-ui/records-ai-variant-a-bubbles-390x844.png`
    - `.verification/drawer-ui/records-ai-variant-b-rail-390x844.png`
- Published to ECS and OTA automatically per current UI iteration preference:
  - OTA version `0.1.0-20260607195646`
  - checksum `5159287a66d8038c56e06fd0cc613d5bdc916fe345bcc3b54c2d56e20e246af7`
  - deploy command: `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/bytedance/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - local OTA bundle contained `120.55.188.242:8300`, 0 `localhost:8080` hits, and root `index.html`;
  - live `/api/health` returned `ok`;
  - `POST /api/mobile-updates/check` returned update version `0.1.0-20260607195646` for previous bundle `0.1.0-20260607193137`;
  - `POST /api/mobile-updates/check` returned no update for current bundle `0.1.0-20260607195646`;
  - downloaded remote bundle checksum matched manifest and contained production API base URL with 0 `localhost:8080` hits;
  - `systemctl is-active ai-baby-growth-companion` returned `active`.

### 2026-06-07 ECS And OTA Publish

- Published backend code to ECS `120.55.188.242:8300` with:
  - `SYNC_DATA=0 ECS_HOST=120.55.188.242 SSH_KEY=/Users/bytedance/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - first retry without `SSH_KEY` failed with `Permission denied (publickey)`; rerun with the project key succeeded.
- Built and published OTA bundle:
  - version `0.1.0-20260607112133`
  - bundle `app-0.1.0-20260607112133.zip`
  - checksum `986b87f889161e5ed738245cc67a6c5881ce5f347ac6a096b3de1e12e15d3a65`
  - build command used production URL: `VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
  - sync command: `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 SKIP_BACKEND_BUILD=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/bytedance/.ssh/ai_baby_aliyun npm run deploy:aliyun`
- Release verification passed:
  - `/api/health` returned `ok`.
  - Remote systemd service is `active`.
  - Remote manifest points to `http://120.55.188.242:8300/api/mobile-updates/bundles/app-0.1.0-20260607112133.zip`.
  - `/api/mobile-updates/check` returns `updateAvailable=true` for previous bundle `0.1.0-20260606214240`.
  - Downloaded bundle checksum matches manifest checksum.
  - Downloaded bundle contains `120.55.188.242:8300`, contains 0 `localhost:8080`, and has root `index.html`.
  - `/api/mobile-updates/check` returns `updateAvailable=false` for current bundle `0.1.0-20260607112133`.

### 2026-06-07 Product IA And Album Capture Date Implementation

- Implemented the remaining Records-first product shell:
  - default mobile home is `记录`;
  - bottom navigation is `记录 / 相册 / 账本 / 我的`;
  - independent `聊天` and `提醒` bottom tabs are removed;
  - the lightweight AI composer is shown inside Records;
  - reminder management is entered from My;
  - reminder quick templates open manual reminder drafts instead of sending prompt text to AI.
- Album grouping now uses day-level `occurredAt` instead of month-level keys.
- Media upload now preserves a separate `capturedAt` timestamp:
  - iOS native picker returns image EXIF / video creation metadata when available;
  - Android native picker returns MediaStore date-taken/date-added metadata when available;
  - web/frontend fallback order is JPEG EXIF -> file `lastModified` -> upload timestamp.
- Verification passed on 2026-06-07:
  - `npm run test:album-domain`
  - `node scripts/test-media-capture-date.mjs`
  - `npm run test:product-simplification`
  - `npm run build`
  - `npm run test:agent-l2:unit`
  - `npm run verify:frontend`
  - `npm run mobile:sync`
  - `npm run build:ios:debug`
  - `npm run build:android:debug`
- Not deployed in this session.

### 2026-06-07 Agent Tool-first Cutover Implementation

- Implemented the retained Records/Ledger AI write path as backend action tools:
  - `record_feeding_event`
  - `record_sleep_event`
  - `record_diaper_event`
  - `record_temperature_event`
  - `create_growth_measurement_pending`
  - `create_milestone_pending`
  - `create_expense_pending`
- Added `AgentMutationService` as the single backend mutation boundary for agent-applied `careLogs` and persisted `pendingEffects`.
- Removed the old production write chain classes and tests:
  - `RecordSignalExtractor`
  - `EffectPolicy`
  - `CareEventCompletenessPolicy`
- `AgentRuntime` now executes model-selected action tools before final reply composition and uses action results as the only authority for "已记录/待确认" claims.
- Frontend no longer reconstructs Records/Ledger pending writes from transient `effectDecisions`; after an agent response it refreshes app state and reads backend-persisted `pendingEffects`.
- AI reminder/todo and AI album-save write tools remain disabled in `capability-manifest.json`; visual attachment handling is read-only unless a retained record/ledger tool has explicit text fields.
- Verification passed on 2026-06-07:
  - targeted Maven action-tool/runtime tests
  - `mvn -f backend/pom.xml test` with 177 tests
  - `npm run test:agent-benchmark`
  - `npm run test:agent-l2:unit`
  - `npm run verify:frontend`
- Not deployed in this session.

### 2026-06-06 Documentation Cleanup And Context Compression

- User asked to combine the current tool-first Agent spec with another session's product / competitor-research documents, but first clean noisy docs and compress context.
- Deleted old decision/archive directory: `docs/archive/completed-2026-06-05/`.
- Deleted stale active documents:
  - `docs/automation-test-cases.md`
  - `docs/automation-test-results.md`
  - `docs/project-file-inventory-2026-06-05.md`
  - `docs/ledger-feature-plan.md`
  - `docs/superpowers/specs/2026-06-04-agent-latency-audit.md`
  - `docs/superpowers/specs/2026-06-05-agent-architecture-optimization.md`
- Kept `docs/superpowers/specs/2026-06-04-agent-capability-benchmark.md` because L2 benchmark scripts still cite it as their scenario source. It should be treated as a benchmark coverage artifact, not current product direction.
- Rewrote this progress file to remove long May session logs and keep only current restart context.

### 2026-06-06 Agent Tool-first Recording Architecture Spec

- Created and refined `docs/superpowers/specs/2026-06-06-agent-tool-first-recording-architecture-spec.md`.
- The spec says tools are backend Agent Runtime internal function-calling Spring Bean actions, not CLI or public frontend APIs.
- Tool granularity was refined from coarse domain tools to specific action tools:
  - `record_feeding_event`
  - `record_sleep_event`
  - `record_diaper_event`
  - `record_temperature_event`
  - `create_growth_measurement_pending`
  - `create_growth_event_pending` / `create_milestone_pending`
  - `create_expense_pending`
- User override on 2026-06-07: production users are controlled, so migration should cut over all retained Records/Ledger AI write paths together and discard the old write chain instead of keeping compatibility.
- Key bad cases captured:
  - "上周" should not become `2026-06-02` on 2026-06-06.
  - Multiple growth metrics in one message must be preserved together.
  - AI must not say "已记录" unless a tool result says `applied`.
  - AI must not say "待确认" unless `pending_effect` exists.

### 2026-06-06 Module-native AI Product Direction Spec

- Created `docs/superpowers/specs/2026-06-06-module-native-ai-records-album-ledger-spec.md`.
- Current target information architecture:
  - `记录`: default home, quick recording, timeline, growth data, trends, calendar.
  - `相册`: baby photos/videos grouped by day.
  - `账本`: manual ledger plus later Pro image recognition.
  - `我的`: baby profile, family, reminder management, privacy, subscription.
- Independent chat history is not the product center. It may remain as data but not as a main navigation path.

### 2026-06-06 Product Simplification Spec

- `docs/superpowers/specs/2026-06-06-product-simplification-records-trust-spec.md` is an implemented prior-stage simplification record.
- Keep it as context for:
  - hiding user-facing model/mode controls,
  - moving reminders out of a bottom tab,
  - moving growth/milestones into records,
  - deleting daily summary / auto sorting UI,
  - making care-log stats event-detail-first.
- Do not treat it as the final target if it conflicts with the module-native AI spec.

### 2026-06-07 Records Growth Observation Cleanup

- Created OpenSpec change `openspec/changes/simplify-records-growth-observation/`.
- Implemented Records today hierarchy cleanup:
  - quick record remains above review content;
  - today summary and day timeline now appear before low-frequency growth review;
  - standalone `发育里程碑` card was removed from the daily stack;
  - milestones remain reachable as `成长观察` inside the Growth card;
  - main Records surface no longer shows score-like milestone progress such as `已记录 X/Y`.
- Added product-structure and frontend-smoke coverage for the new `成长观察` entry.
- Verification passed on 2026-06-07:
  - `npm run test:product-simplification`
  - `npm run build`
  - `npm run verify:frontend`
- Smoke screenshots include `.verification/frontend-smoke/iphone-13-390x844.png`, visually confirming Records first screen now prioritizes quick record, today info, and timeline.

### 2026-06-07 Records CTA Copy Release

- Updated Records quick-entry copy:
  - `问问 AI` -> `AI 自动记录`;
  - `手动补充` -> `手动记录`.
- Made the two actions clearer pill buttons while keeping the quick-record card lightweight.
- Local verification passed before release:
  - `npm run test:product-simplification`
  - `npm run build`
  - `npm run verify:frontend`
  - `git diff --check`
  - `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" PATH="/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:$PATH" "/Applications/IntelliJ IDEA.app/Contents/plugins/maven/lib/maven3/bin/mvn" -f backend/pom.xml test` passed 177 tests
- Published to ECS on 2026-06-07 with `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/bytedance/.ssh/ai_baby_aliyun npm run deploy:aliyun`.
- Published OTA version `0.1.0-20260607145703`.
- OTA safety checks passed:
  - local bundle checksum `9aa55e906ae726dc031506fb2a788234be69ea05c2684aec9804cff5c3da8eb5`;
  - local and downloaded remote bundles contain `120.55.188.242:8300` and 0 `localhost:8080` hits;
  - `/api/mobile-updates/check` returned update version `0.1.0-20260607145703` and the expected checksum;
  - downloaded remote bundle checksum matched the manifest.

### 2026-06-07 Records Full-Screen Drawer Release

- Implemented Records entry interaction refinement:
  - `AI 自动记录` opens a dedicated full-screen AI recording drawer;
  - `手动记录` opens a dedicated full-screen manual recording drawer;
  - manual recording now exposes type-specific forms for feeding, sleep, diaper, temperature, solid food, and notes;
  - Growth moved out of Today into a peer Records tab with simple height/weight/head-circumference growth curves.
- Local verification passed before release:
  - `bash harness/init.sh`
  - `npm run verify:frontend`
  - `git diff --check`
  - `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" PATH="/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:$PATH" "/Applications/IntelliJ IDEA.app/Contents/plugins/maven/lib/maven3/bin/mvn" -f backend/pom.xml test` passed 177 tests
- Targeted screenshots reviewed:
  - `.verification/frontend-smoke/records-ai-drawer-390x844.png`
  - `.verification/frontend-smoke/records-manual-drawer-390x844.png`
  - `.verification/frontend-smoke/iphone-13-390x844.png`
- Published to ECS on 2026-06-07 with `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/bytedance/.ssh/ai_baby_aliyun npm run deploy:aliyun`.
- Published OTA version `0.1.0-20260607180704`, checksum `4a5ffe9c2e67c359d32d3ccc5e1165ed0a73bfcf543d46b29fa464442972ebfe`.
- OTA safety checks passed:
  - local bundle contained `120.55.188.242:8300` and 0 `localhost:8080` hits;
  - live `/api/health` returned `ok`;
  - `systemctl is-active ai-baby-growth-companion` returned `active`;
  - `/api/mobile-updates/check` returned update version `0.1.0-20260607180704` for previous bundle `0.1.0-20260607145703`;
  - `/api/mobile-updates/check` returned no update for current bundle `0.1.0-20260607180704`;
  - downloaded remote bundle checksum matched the manifest and contained production API base URL with 0 `localhost:8080` hits.

### 2026-06-07 Records Drawer Interaction Fix

- Fixed the Records `AI 自动记录` and `手动记录` drawers after visual review:
  - drawers now render through a body portal so they cover the full viewport instead of being clipped by the Records page;
  - opening animates from bottom to top and closing animates from top to bottom before unmount;
  - drawer shell is non-scrollable, internal scrolling hides scrollbars, and the bottom tab / underlying Records CTA no longer leaks through;
  - manual recording removed the generic `备注` record type;
  - manual recording time uses preset chips plus native time picker;
  - milk amount, sleep duration, and temperature use stepper / fixed option controls instead of freeform decimal inputs.
- Verification passed on 2026-06-07:
  - `npm run test:product-simplification`
  - `npm run build`
  - targeted Playwright drawer screenshot/assertion script for 390x844 viewport
  - `npm run verify:frontend`
- Targeted screenshots:
  - `.verification/drawer-ui/records-ai-drawer-390x844.png`
  - `.verification/drawer-ui/records-manual-drawer-390x844.png`

### 2026-06-07 Records Drawer Interaction Release

- Published the Records drawer interaction fix to ECS and OTA.
- Pre-release checks passed:
  - `git diff --check`
  - `harness/feature_list.json` JSON parse
  - `VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
- Published OTA version `0.1.0-20260607185551`, checksum `2e7e1543426334c931673f28338cc1862985454eeb6c17fca173390331849a59`.
- Local OTA safety checks passed:
  - local bundle checksum matched manifest;
  - local bundle contained `120.55.188.242:8300` and 0 `localhost:8080` hits;
  - local bundle contained root `index.html`.
- Deployed to ECS with `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/bytedance/.ssh/ai_baby_aliyun npm run deploy:aliyun`.
- Post-release checks passed:
  - live `/api/health` returned `ok`;
  - `systemctl is-active ai-baby-growth-companion` returned `active`;
  - remote manifest file under `/var/lib/ai-baby-growth-companion/mobile-updates/manifest.json` pointed to `0.1.0-20260607185551`;
  - `/api/mobile-updates/check` returned update version `0.1.0-20260607185551` for previous bundle `0.1.0-20260607180704`;
  - `/api/mobile-updates/check` returned no update for current bundle `0.1.0-20260607185551`;
  - downloaded remote bundle checksum matched the manifest and contained production API base URL with 0 `localhost:8080` hits.
- Note: direct GET `/api/mobile-updates/manifest.json` returned 404; OTA validation uses `/api/mobile-updates/check`, which passed.

## Current Worktree Warning

The worktree is intentionally dirty from recent product, Agent, UI, benchmark, ECS, and OTA work. Preserve user/prior-agent changes. Do not revert unrelated files.

## Next Best Action

1. For the current UI iteration loop, publish verified fixes automatically unless the user explicitly says not to publish; always use `SYNC_DATA=0` and the production OTA base-URL checks from AGENTS.md.
2. Add live L2 probes for the tool-first path only when budget and model access are explicitly approved.
3. Real-device probe still needed for OS-level behavior such as native media picker capture dates, notifications, ASR, and OTA apply.

## Verification Notes

- At session start on 2026-06-06, `bash harness/init.sh` passed: whitespace check, frontend build, and `npm run test:agent-benchmark`.
- Latest agent migration verification on 2026-06-07:
  - `npm run test:agent-benchmark`
  - `npm run test:agent-l2:unit`
  - `npm run verify:frontend`
  - `mvn -f backend/pom.xml test`
- Latest product/mobile verification on 2026-06-07:
  - `npm run verify:frontend`
  - `npm run mobile:sync`
  - `npm run build:ios:debug`
  - `npm run build:android:debug`
- Before claiming future UI/navigation completion, rerun `npm run verify:frontend` and visually inspect the tab screenshots.
