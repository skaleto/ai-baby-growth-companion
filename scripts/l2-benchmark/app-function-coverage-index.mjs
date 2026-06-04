#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const inventoryPath = path.join(repoRoot, "docs/feature-inventory.md");

function parseInventoryRows(markdown) {
  const rows = [];
  let currentArea = "";
  for (const rawLine of markdown.split(/\r?\n/)) {
    const heading = rawLine.match(/^###\s+\d+\.\s+(.+)$/);
    if (heading) {
      currentArea = heading[1].trim();
      continue;
    }
    if (!rawLine.startsWith("| P")) continue;
    const cells = rawLine.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 4) continue;
    rows.push({ priority: cells[0], feature: cells[1], area: currentArea });
  }
  return rows;
}

const l2 = (scenarioIds, evidence) => ({ layer: "l2", scenarioIds, evidence });
const layer = (name, evidence) => ({ layer: name, evidence });

const overrides = new Map([
  ["移动底部导航", { status: "covered_by_layer", coverage: [layer("frontend", "npm run verify:frontend runs Playwright smoke across the main mobile tabs and viewport matrix.")] }],
  ["固定移动视口", { status: "covered_by_layer", coverage: [layer("frontend", "npm run verify:frontend checks mobile viewport overflow and fixed-shell layout regressions.")] }],
  ["右侧/左侧桌面辅助栏", { status: "covered_by_layer", coverage: [layer("frontend", "frontend smoke includes desktop plus mobile viewports, so desktop-only side panels remain visible without blocking mobile content.")] }],
  ["OTA 更新", { status: "covered_by_layer", coverage: [layer("native", "scripts/native-capability-audit.mjs tracks ota-updater static evidence."), layer("cloud", "OTA releases are probed through /api/mobile-updates/check and bundle checksum verification.")] }],
  ["运行版本信息", { status: "known_gap", coverage: [layer("frontend", "My-page runtime info is documented in docs/feature-inventory.md but lacks a dedicated assertion.")], nextAction: "Add a frontend smoke assertion for platform/native/backend version fields on the My tab." }],

  ["手机号 + 家庭邀请码登录", { status: "covered_by_layer", coverage: [layer("backend", "AuthControllerTests cover login flows and invite handling."), layer("frontend", "frontend smoke exercises authenticated app entry.")] }],
  ["已注册用户再次登录", { status: "covered_by_layer", coverage: [layer("backend", "AuthControllerTests cover existing-member login behavior and invite-role precheck compatibility.")] }],
  ["新成员选择身份与权限", { status: "covered_by_layer", coverage: [layer("backend", "AuthControllerTests cover role selection, unique core roles, and repeatable role handling.")] }],
  ["角色预检", { status: "covered_by_layer", coverage: [layer("backend", "AuthControllerTests cover /api/auth/invite/roles response shape and occupied role behavior.")] }],
  ["首次小宝资料设置", { status: "covered_by_layer", coverage: [layer("frontend", "frontend smoke starts from an authenticated app fixture and verifies profile-dependent app entry.")] }],
  ["非照护人等待设置", { status: "known_gap", coverage: [layer("frontend", "Viewer onboarding wait state is listed in feature-inventory but not yet a dedicated smoke fixture.")], nextAction: "Add a viewer-in-empty-family frontend/API fixture and assert the wait page blocks setup editing." }],
  ["家庭名称默认值", { status: "known_gap", coverage: [layer("frontend", "Default family-name suggestion is implemented in onboarding UI but lacks a focused assertion.")], nextAction: "Add an onboarding probe that types a baby nickname and asserts the suggested family name can be overridden." }],
  ["退出登录", { status: "covered_by_layer", coverage: [layer("backend", "AuthControllerTests cover logout/session invalidation behavior.")] }],

  ["状态读取", { status: "covered_by_layer", coverage: [layer("backend", "AppStateControllerTests cover merged app_state reading and shared/private collection behavior."), layer("cloud", "npm run test:cloud-e2e covers live shared record visibility.")] }],
  ["写权限拦截", { status: "covered_by_layer", coverage: [layer("backend", "Controller/security tests and cloud probes cover caregiver-only write boundaries."), l2(["private-reminder-share-boundary"], "Agent L2 covers private-state write/sync refusal copy.")] }],
  ["单条记录 upsert/delete", { status: "covered_by_layer", coverage: [layer("backend", "AppStateControllerTests cover PUT/DELETE behavior for app_state collections including growthMeasurements.")] }],
  ["照护日志按日期合并", { status: "covered_by_layer", coverage: [layer("backend", "AppStateService/AppStateControllerTests cover same-day careLog merging and app_state normalization.")] }],
  ["待确认确认/丢弃", { status: "covered_by_layer", coverage: [layer("backend", "AppStateControllerTests cover pending growthMeasurements confirmation into shared growthMeasurements."), l2(["growth-measurement-complete", "expense-record"], "L2 verifies pending effects are produced before final state mutation.")] }],
  ["SQLite 启动迁移", { status: "covered_by_layer", coverage: [layer("backend", "Backend test startup exercises DatabaseInitializer and SQLite schema migrations.")] }],

  ["文本聊天", { status: "covered", coverage: [l2(["feed-complete"], "L2 exercises real /api/agent/chat/stream and SSE result handling.")] }],
  ["模型选择", { status: "covered_by_layer", coverage: [layer("frontend", "frontend smoke covers model selector availability in chat fixtures."), layer("l0_l1", "AgentBenchmarkTests cover model-independent policy behavior.")] }],
  ["低延迟开关", { status: "covered_by_layer", coverage: [layer("backend", "Agent runtime/model routing tests cover Doubao low-latency/service-tier contract."), layer("frontend", "frontend smoke covers model control rendering.")] }],
  ["Agent 权限", { status: "covered_by_layer", coverage: [layer("backend", "AgentController security tests and feature-inventory access rules cover caregiver-only Agent access.")] }],
  ["Planner + Runtime", { status: "covered", coverage: [layer("l0_l1", "npm run test:agent-benchmark covers planner/runtime/policy behavior."), l2(["daily-observation-context", "expense-record", "photo-album"], "L2 covers record, ledger, data-linked companion, and media paths.")] }],
  ["Skill 渐进披露", { status: "covered_by_layer", coverage: [layer("l0_l1", "AgentBenchmarkTests cover skill disclosure and no-disclosure for pure structured records.")] }],
  ["联网查询", { status: "covered_by_layer", coverage: [layer("l0_l1", "AgentBenchmarkTests cover policy/web-search routing boundaries and source-bearing responses.")] }],
  ["安全边界", { status: "covered", coverage: [layer("l0_l1", "AgentBenchmarkTests cover fever, medicine, vaccine, caregiver high-risk, and medical-safety boundaries."), l2(["medicine-reminder-pending", "vaccine-reminder-pending"], "L2 keeps medical reminders pending instead of silently scheduling them.")] }],
  ["会话摘要压缩", { status: "known_gap", coverage: [layer("backend", "Conversation summary endpoint exists but is not yet part of the product coverage fast gate.")], nextAction: "Add API/backend tests for conversationSummary compression isolation and a read-only L2 summary query cross-check." }],
  ["失败提示", { status: "known_gap", coverage: [layer("frontend", "Failure UX is implemented in chat status rows but lacks a focused failure-fixture smoke test.")], nextAction: "Add mock 500/malformed-stream frontend probe and assert no app_state writes." }],

  ["喂奶完整记录", { status: "covered", coverage: [l2(["feed-complete", "feed-mixed-missing-type"], "L2 covers complete feeding and mixed-feeding missing-type ask/no-write behavior.")] }],
  ["喂奶开始意图不记录", { status: "covered", coverage: [l2(["feed-mixed-missing-type"], "Current L2 covers feeding ask/no-write boundaries; start-only feeding remains under deterministic AgentBenchmarkTests."), layer("l0_l1", "AgentBenchmarkTests cover start-only feeding boundary behavior.")] }],
  ["睡眠完整记录", { status: "covered", coverage: [l2(["sleep-complete", "sleep-start-boundary"], "L2 covers complete sleep and start-only sleep ask/no-write behavior.")] }],
  ["聊天内撤销/删除边界", { status: "covered", coverage: [l2(["growth-measurement-update-boundary", "growth-measurement-delete-boundary"], "Growth mutation boundaries prove chat does not directly edit/delete history."), layer("l0_l1", "AgentBenchmarkTests cover unsupported mutation copy.")] }],
  ["自动记录撤销卡片", { status: "covered_by_layer", coverage: [layer("frontend", "Recording Companion P0 frontend work and verify:frontend cover record feedback cards and undo surface.")] }],
  ["待确认编辑表单", { status: "covered_by_layer", coverage: [layer("frontend", "npm run verify:frontend covered editable pending growth measurement drafts and confirmation UI."), layer("backend", "AppStateControllerTests cover pending confirm persistence.")] }],
  ["多事件拆分与去重", { status: "covered", coverage: [l2(["multi-care-events"], "L2 verifies a single utterance can produce multiple care events without duplicate app_state growth.")] }],

  ["按住说话", { status: "known_gap", coverage: [layer("native", "scripts/native-capability-audit.mjs tracks asr-voice-input static evidence and manual probe requirements.")], nextAction: "Add browser mock MediaRecorder/WebSocket probe and real iOS/Android voice-input device probe." }],
  ["ASR 鉴权", { status: "covered_by_layer", coverage: [layer("backend", "DoubaoAsrWebSocketHandlerTests cover start-token/auth error paths and ASR config failure.")], nextAction: "Add viewer-token WebSocket coverage to the cloud/API gate." }],
  ["音频格式", { status: "covered_by_layer", coverage: [layer("backend", "DoubaoAsrWebSocketHandlerTests cover unsupported sampleRate/format rejection.")] }],
  ["原生麦克风权限", { status: "known_gap", coverage: [layer("native", "native-capability-audit tracks Android AudioPermissionPlugin and iOS NSMicrophoneUsageDescription.")], nextAction: "Run device permission-denied probes and record UI copy evidence." }],

  ["聊天图片/视频上传", { status: "covered_by_layer", coverage: [layer("frontend", "verify:frontend covers attachment UI compatibility."), l2(["photo-album", "screenshot-ignore"], "L2 sends deterministic image dataUrl attachments for media classification.")] }],
  ["附件持久化", { status: "covered_by_layer", coverage: [layer("backend", "Upload/AppState controller tests and cloud E2E cover attachment metadata and family access.")], nextAction: "Add OSS presign mock coverage if the upload provider path changes." }],
  ["缩略图", { status: "known_gap", coverage: [layer("backend", "Attachment thumbnail endpoint exists but is not explicitly asserted in the fast benchmark gate.")], nextAction: "Add upload-thumbnail API smoke with a tiny fixture image." }],
  ["媒体预览", { status: "covered_by_layer", coverage: [layer("frontend", "npm run verify:frontend covers album/media rendering smoke; manual preview gestures remain visual QA.")] }],
  ["家庭附件权限", { status: "covered_by_layer", coverage: [layer("cloud", "npm run test:cloud-e2e covers family-scoped attachment preview and shared ledger attachment behavior.")] }],
  ["上传限制", { status: "known_gap", coverage: [layer("api", "Upload limits are documented in feature-inventory but lack a dedicated small API negative test.")], nextAction: "Add API tests for unsupported MIME and over-limit payload rejection." }],

  ["今日视图", { status: "covered_by_layer", coverage: [layer("frontend", "scripts/probe-daily-summary-view.mjs and verify:frontend cover 小宝今日观察 stats and timeline entry.")] }],
  ["趋势视图", { status: "covered_by_layer", coverage: [layer("frontend", "verify:frontend covers Records navigation; exact 7-day chart values need a focused probe.")], nextAction: "Add records trend probe with seeded 7-day careLogs." }],
  ["日历视图", { status: "known_gap", coverage: [layer("frontend", "Calendar view is documented but not isolated in the current smoke assertions.")], nextAction: "Add records calendar probe with seeded month data and date switching." }],
  ["时间线编辑", { status: "known_gap", coverage: [layer("frontend", "Timeline editing is product-critical but not yet a focused frontend/API benchmark case.")], nextAction: "Add a Playwright probe that edits milk amount and verifies today/trend stats update." }],
  ["完成提醒进入事实时间线", { status: "known_gap", coverage: [layer("frontend", "Reminder-completed timeline projection is not yet a dedicated regression assertion.")], nextAction: "Add seeded reminder completion probe and assert Records timeline contains the completed reminder event." }],
  ["空状态", { status: "covered_by_layer", coverage: [layer("frontend", "frontend smoke includes empty/fixture state rendering across mobile viewports.")] }],

  ["成长入口与最新值", { status: "covered_by_layer", coverage: [layer("frontend", "scripts/frontend-smoke.mjs opens the 宝宝成长 card, verifies the 成长记录 view, and asserts the seeded latest height value renders.")] }],
  ["手动新增成长测量", { status: "covered_by_layer", coverage: [layer("frontend", "scripts/frontend-smoke.mjs rejects out-of-range 999cm and records a valid 68.2cm growth measurement with a note."), layer("backend", "AppStateControllerTests cover confirming pending growthMeasurements into shared growthMeasurements and single-record persistence.")] }],
  ["手动删除成长测量", { status: "covered_by_layer", coverage: [layer("frontend", "scripts/frontend-smoke.mjs deletes the newly added growth measurement row and verifies it disappears."), layer("backend", "AppStateControllerTests#upsertingAndDeletingGrowthMeasurementMaintainsSharedData covers DELETE /api/app/state/growthMeasurements/{id}.")] }],
  ["成长测量编辑能力", { status: "covered_by_layer", coverage: [layer("frontend", "scripts/frontend-smoke.mjs edits a seeded 66.5cm growth measurement to 67.1cm, saves it, and verifies the old row is gone across the viewport matrix."), layer("backend", "AppStateControllerTests#upsertingAndDeletingGrowthMeasurementMaintainsSharedData covers same-id upsert updates for growthMeasurements.")] }],
  ["AI 成长数据待确认", { status: "covered", coverage: [l2(["growth-measurement-complete"], "L2 verifies clear height/weight/head-circumference text creates pendingEffects.growthMeasurements, not direct shared growthMeasurements."), layer("backend", "AppStateControllerTests#confirmingPendingGrowthMeasurementsPersistsSharedGrowthData covers confirm-to-shared persistence.")] }],
  ["成长数据边界", { status: "covered", coverage: [l2(["growth-measurement-ambiguous-unit", "growth-measurement-out-of-range", "growth-measurement-update-boundary", "growth-measurement-delete-boundary", "growth-measurement-duplicate-boundary"], "L2 covers unit ask, abnormal value ask, chat update/delete boundary, and duplicate no-write behavior."), layer("l0_l1", "AgentBenchmarkTests cover the deterministic policy regressions behind the growth boundary cases.")] }],
  ["成长趋势只读查询", { status: "covered", coverage: [l2(["read-only-growth-trend-context"], "L2 seeds multiple growthMeasurements and verifies trend copy without mutating growthMeasurements, pendingEffects, or memories.")] }],

  ["手动记账", { status: "known_gap", coverage: [layer("frontend", "Ledger manual form is in the product inventory but lacks a focused smoke assertion in this benchmark set.")], nextAction: "Add ledger form Playwright probe for create/edit/delete and stats updates." }],
  ["家庭共享", { status: "covered_by_layer", coverage: [layer("cloud", "npm run test:cloud-e2e covers shared ledger visibility and attachment preview.")], nextAction: "Add read-only ledger edit-hidden frontend assertion." }],
  ["AI 记账待确认", { status: "covered", coverage: [l2(["expense-record"], "L2 verifies text ledger requests create pendingEffects.expenses instead of final expense mutation."), layer("l0_l1", "ExpenseRecognitionSkillTests/AgentBenchmarkTests cover image and previous-attachment expense behavior.")] }],
  ["本月视图", { status: "known_gap", coverage: [layer("frontend", "Ledger monthly summary is not yet separately asserted.")], nextAction: "Add seeded ledger month probe for totals, category share, and large expense sorting." }],
  ["年度视图", { status: "known_gap", coverage: [layer("frontend", "Ledger yearly chart is not yet separately asserted.")], nextAction: "Add seeded cross-month ledger probe for 12-month bar rendering." }],
  ["明细视图", { status: "known_gap", coverage: [layer("frontend", "Ledger detail edit/delete needs a focused probe.")], nextAction: "Add ledger detail edit/delete Playwright probe with confirmation modal assertions." }],
  ["条码/商品查询", { status: "covered_by_layer", coverage: [layer("docs", "docs/feature-inventory.md records barcode/product lookup removal as expected behavior."), layer("frontend", "verify:frontend smoke should fail if removed scanner UI is reintroduced visibly.")] }],

  ["相册上传", { status: "covered_by_layer", coverage: [l2(["photo-album"], "L2 verifies albumItems mutation shape for an explicit photo-save attachment."), layer("frontend", "verify:frontend covers album rendering.")] }],
  ["分类筛选", { status: "known_gap", coverage: [layer("frontend", "Album filter UI exists but lacks a focused category-filter assertion.")], nextAction: "Add album seeded category filter probe." }],
  ["自动准入", { status: "covered", coverage: [l2(["photo-album", "screenshot-ignore"], "L2 covers saveable photo and screenshot ignore boundaries."), layer("l0_l1", "scripts/test-album-domain.mjs covers photo auto-save, screenshot ignore, and duplicate de-dupe.")] }],
  ["后续保存指令", { status: "known_gap", coverage: [layer("l2", "Known follow-up gap remains documented in the benchmark plan.")], nextAction: "Add L2 scenario for uploading a video, then saying '刚才的视频保存到相册' using attachment hydration." }],
  ["相册预览编辑删除", { status: "known_gap", coverage: [layer("frontend", "Album preview/edit/delete is not yet a focused Playwright benchmark case.")], nextAction: "Add album preview edit/delete probe with seeded albumItems and attachment metadata." }],
  ["文件名生成", { status: "known_gap", coverage: [layer("l0_l1", "Album domain rules cover classification but not display filename generation yet.")], nextAction: "Add album domain unit test for title/MIME-based display filename generation." }],

  ["提醒列表", { status: "covered", coverage: [l2(["read-only-reminder-list-context"], "L2 verifies read-only reminder listing does not create new reminders."), layer("frontend", "frontend smoke covers reminder page rendering.")] }],
  ["手动新建/编辑", { status: "covered_by_layer", coverage: [layer("frontend", "frontend smoke covers reminder form rendering; native scheduling is tracked by native-capability-audit."), layer("native", "native-capability-audit tracks local-notifications and full-screen-ringing.")] }],
  ["完成/删除二次确认", { status: "covered_by_layer", coverage: [layer("frontend", "scripts/frontend-smoke.mjs opens reminder completion/deletion confirmation modals, verifies cancel keeps the reminder unchanged, confirms completion moves a reminder to 已完成, and confirms deletion removes a reminder from the list.")] }],
  ["Agent 创建提醒", { status: "covered", coverage: [l2(["reminder-once", "vague-reminder-ask", "medicine-reminder-pending", "vaccine-reminder-pending"], "L2 covers normal reminders, vague asks, and medical/vaccine pending boundaries."), layer("l0_l1", "AgentBenchmarkTests cover interval and scheduling semantics.")] }],
  ["循环喂奶锚点", { status: "known_gap", coverage: [layer("frontend", "Interval reminder reschedule logic exists but lacks a seeded anchor-regression probe.")], nextAction: "Add seeded milk-event reminder probe for dueAt anchoring and reschedule after new milk event." }],
  ["延后", { status: "known_gap", coverage: [layer("frontend", "Reminder postpone flow lacks a focused confirmation and dueAt regression probe.")], nextAction: "Add reminder postpone Playwright probe covering cancel and confirm." }],
  ["系统状态", { status: "covered_by_layer", coverage: [layer("native", "native-capability-audit tracks notification status capability and device-gap requirements."), layer("frontend", "frontend reminder labels render scheduled/scheduled_inexact/failed state strings.")] }],
  ["快捷创建", { status: "known_gap", coverage: [layer("frontend", "Reminder quick-create buttons lack a focused prompt-prefill probe.")], nextAction: "Add quick-create frontend probe for vaccine/checkup/bath/feed/medicine/revisit/custom prompts." }],

  ["Android 原生闹铃", { status: "known_gap", coverage: [layer("native", "native-capability-audit tracks full-screen-ringing static evidence for Android AlarmReminderPlugin/AlarmReceiver/AlarmRingingActivity.")], nextAction: "Run Android device probe for lock-screen full-screen alarm, looping sound, close, and interval reschedule." }],
  ["Android 普通通知循环", { status: "known_gap", coverage: [layer("native", "native-capability-audit tracks local-notifications and AlarmReminderStore static evidence.")], nextAction: "Add JVM/Robolectric-style receiver test or Android device probe for notification repeat nextDueAt event queue." }],
  ["iOS 本地通知", { status: "known_gap", coverage: [layer("native", "native-capability-audit tracks iOS AlarmReminderPlugin UNNotificationRequest static evidence.")], nextAction: "Run iOS device/simulator notification permission and delivery probe." }],
  ["前端全屏闹铃页", { status: "known_gap", coverage: [layer("frontend", "Alarm overlay exists in App.tsx but is not yet isolated in a frontend probe.")], nextAction: "Add frontend probe that injects ringingReminder state and verifies overlay, sound close, and nextDueAt update copy." }],
  ["系统限制说明", { status: "covered_by_layer", coverage: [layer("docs", "docs/native-capability-benchmark.md documents platform limitations and avoids promising unprovable background/full-screen behavior.")] }],

  ["查看小宝资料", { status: "covered_by_layer", coverage: [layer("frontend", "frontend smoke covers My/Profile rendering in authenticated fixture.")] }],
  ["编辑小宝资料", { status: "covered_by_layer", coverage: [layer("frontend", "Growth/profile smoke covers profile sex/birth-size seed and care mode effects; chat profile mutation boundary is covered by L2."), l2(["profile-update-boundary", "feed-mixed-missing-type"], "L2 covers profile update boundary and mixed-feeding context effect on questions.")] }],
  ["只读提示", { status: "known_gap", coverage: [layer("frontend", "Viewer role UI hiding is documented but not fully asserted across all tabs.")], nextAction: "Add viewer-role frontend fixture covering My tab, hidden edit controls, hidden chat tab, and write-entry absence." }],
  ["家庭照护人列表", { status: "covered_by_layer", coverage: [layer("backend", "Auth/profile backend tests cover caregiver/member enrichment; AuthService local changes should keep this evidence current.")] }],

  ["DeepSeek 模型", { status: "covered_by_layer", coverage: [layer("backend", "Agent model routing tests and appOptions cover DeepSeek model capabilities and no-vision/low-latency constraints.")] }],
  ["Doubao 模型", { status: "covered_by_layer", coverage: [layer("backend", "Agent model routing and runtime tests cover Doubao multimodal/low-latency handling."), l2(["photo-album", "screenshot-ignore"], "Image L2 scenarios exercise multimodal attachment path with a vision-capable model.")] }],
  ["API Key", { status: "covered_by_layer", coverage: [layer("backend", "Configuration classes support inline/file keys for DeepSeek, Doubao, and Doubao ASR; ASR config failure is tested.")] }],
  ["低延迟默认关闭", { status: "covered_by_layer", coverage: [layer("frontend", "frontend model controls default low latency off; backend model routing handles enabled Doubao service tier.")] }],

  ["后端健康检查", { status: "covered_by_layer", coverage: [layer("cloud", "Cloud release discipline requires /api/health probe after deployment."), layer("harness", "bash harness/init.sh proves local build/benchmark health before handoff.")] }],
  ["阿里云部署脚本", { status: "covered_by_layer", coverage: [layer("cloud", "harness/feature_list.json records SYNC_DATA=0 deploy discipline and prior ECS verification evidence.")] }],
  ["移动 OTA 包", { status: "covered_by_layer", coverage: [layer("cloud", "build-mobile-update plus /api/mobile-updates/check and checksum probes cover OTA package generation/delivery."), layer("native", "native-capability-audit tracks ota-updater static and device apply gap.")] }],
  ["测试数据重置", { status: "known_gap", coverage: [layer("api", "reset-test-data script is documented but not yet covered by a temp-DB assertion.")], nextAction: "Add temp SQLite reset-test-data probe that proves auth/session/business/upload data is cleared without touching production data." }],
]);

function defaultCoverage(row) {
  const nextAction = `Add a dedicated ${row.priority} benchmark/probe for ${row.area} / ${row.feature}.`;
  return {
    status: "known_gap",
    coverage: [layer("docs", "docs/feature-inventory.md defines the automation recommendation, but no dedicated executable gate is registered yet.")],
    nextAction,
  };
}

const inventoryRows = parseInventoryRows(fs.readFileSync(inventoryPath, "utf8"));

export const appFunctionCoverageIndex = inventoryRows.map((row) => ({
  ...row,
  ...(overrides.get(row.feature) ?? defaultCoverage(row)),
}));

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const counts = appFunctionCoverageIndex.reduce((acc, entry) => {
    acc[entry.status] = (acc[entry.status] || 0) + 1;
    return acc;
  }, {});
  console.log(`app function coverage index: ${appFunctionCoverageIndex.length} rows`);
  console.log(JSON.stringify(counts, null, 2));
}
