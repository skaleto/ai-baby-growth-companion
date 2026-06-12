#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync("frontend/src/App.tsx", "utf8");
const appOptionsSource = readFileSync("frontend/src/appOptions.ts", "utf8");
const frontendSmokeSource = readFileSync("scripts/frontend-smoke.mjs", "utf8");
const baseCss = readFileSync("frontend/src/styles/app-base.css", "utf8");
const legacyCss = readFileSync("frontend/src/styles/legacy-responsive.css", "utf8");
const mobileCss = readFileSync("frontend/src/styles/mobile-app.css", "utf8");
const warmCss = readFileSync("frontend/src/styles/warm-theme.css", "utf8");

const cssBlock = (source, selector) => {
  const start = source.indexOf(selector);
  assert.ok(start >= 0, `${selector} CSS block should exist`);
  const end = source.indexOf("\n}", start);
  assert.ok(end > start, `${selector} CSS block should be closed`);
  return source.slice(start, end + 2);
};

const composerStart = appSource.indexOf('<div className="composer-tools"');
const composerEnd = appSource.indexOf('<div className="composer-input-line"', composerStart);
assert.ok(composerStart >= 0 && composerEnd > composerStart, "chat composer tools block should be findable");
const composerTools = appSource.slice(composerStart, composerEnd);

assert.doesNotMatch(composerTools, /className="model-select"/, "chat composer should not expose model selection");
assert.doesNotMatch(composerTools, /thinking-button/, "chat composer should not expose deep thinking mode");
assert.doesNotMatch(composerTools, /latency-button/, "chat composer should not expose low latency mode");
assert.match(composerTools, /openMediaPicker/, "chat composer should still expose the media picker");
assert.match(composerTools, /toggleComposerMode/, "chat composer should still expose voice input toggle");

assert.doesNotMatch(appOptionsSource, /id:\s*"chat"/, "bottom mobile tabs should not include an independent chat tab");
assert.doesNotMatch(appOptionsSource, /id:\s*"reminders"/, "bottom mobile tabs should not include a reminders tab");
assert.match(appSource, /useState<MobileTab>\("records"\)/, "records should be the default mobile home");
assert.doesNotMatch(appSource, /setActiveMobileTab\("chat"\)/, "product shell should not route users into an independent chat tab");
assert.doesNotMatch(
  mobileCss,
  /\.mobile-tab-records\s+\.chat-panel\s*\{\s*display:\s*grid/s,
  "records tab must not render the full chat panel as the Records page body",
);
assert.doesNotMatch(
  legacyCss,
  /\.mobile-tab-records\s+\.chat-panel\s*\{\s*display:\s*grid/s,
  "legacy responsive CSS must not resurrect the full chat panel as the Records page body",
);
assert.doesNotMatch(
  mobileCss,
  /\.mobile-tab-records\.records-assistant-expanded\s+\.chat-panel\s*\{[\s\S]*?display:\s*grid/,
  "records assistant should not reopen the full chat panel as a popup",
);
assert.match(mobileCss, /\.mobile-tab-records\s+\.records-screen/, "records tab should render the Records screen");
assert.doesNotMatch(frontendSmokeSource, /"提醒"/, "frontend smoke should not navigate through a reminders tab");
assert.doesNotMatch(frontendSmokeSource, /"聊天"/, "frontend smoke should not navigate through a chat tab");

assert.doesNotMatch(appSource, /<DailySummaryView\b/, "records today view should not render DailySummaryView");
assert.doesNotMatch(appSource, /接收每日小结提醒|整理今天|重新整理|小宝今日观察/, "UI should not expose today-summary sorting/reminder copy");

const recordsStart = appSource.indexOf('<section className="records-screen');
const recordsEnd = appSource.indexOf("<AlbumScreen", recordsStart);
assert.ok(recordsStart >= 0 && recordsEnd > recordsStart, "records screen block should be findable");
const recordsBlock = appSource.slice(recordsStart, recordsEnd);
assert.ok(
  recordsBlock.indexOf('className="segmented-tabs record-tabs"') >= 0,
  "records screen should keep primary record navigation",
);
assert.match(appOptionsSource, /export type RecordView = "today" \| "growth" \| "trend" \| "calendar"/, "records views should include a peer Growth tab");
assert.match(appOptionsSource, /\{ id: "growth", label: "成长" \}/, "records tab options should expose Growth as a peer tab");
assert.ok(
  recordsBlock.indexOf('recordView === "growth"') >= 0,
  "records screen should render a dedicated Growth view",
);
assert.ok(
  recordsBlock.indexOf('className="growth-observation-row"') >= 0,
  "growth view should expose growth observation from inside the growth surface",
);
assert.ok(
  recordsBlock.indexOf('recordView === "today"') < recordsBlock.indexOf('recordView === "growth"'),
  "today view should remain before the dedicated Growth view in source order",
);
const todayViewStart = recordsBlock.indexOf('recordView === "today"');
const growthViewStart = recordsBlock.indexOf('recordView === "growth"');
const todayViewBlock = recordsBlock.slice(todayViewStart, growthViewStart);
assert.doesNotMatch(todayViewBlock, /growth-entry-card/, "records Today view should not render the growth card");
assert.doesNotMatch(recordsBlock, /record-milestone-card/, "records today view should not expose a standalone milestone card");
assert.doesNotMatch(recordsBlock, /已记录 \{milestoneStats\.achieved\}\/\{milestoneStats\.total\}/, "records main surface should not show score-like milestone progress");
assert.match(recordsBlock, /成长观察/, "records main surface should use low-anxiety growth observation copy");
assert.match(recordsBlock, /growth-trend-card/, "records trend view should include growth trend card");
assert.match(recordsBlock, /records-assistant-entry/, "records screen should expose a lightweight AI recording entry");
assert.match(recordsBlock, /AI 自动记录/, "records assistant primary action should clearly describe automatic AI recording");
assert.match(recordsBlock, /手动记录/, "records manual entry action should use manual recording copy");
assert.doesNotMatch(recordsBlock, /问问 AI/, "records assistant action should not use vague ask-AI copy");
assert.doesNotMatch(recordsBlock, /手动补充/, "records manual action should not use vague supplement copy");
const recordsAssistantEntryCss = cssBlock(mobileCss, ".records-assistant-entry {");
assert.match(recordsAssistantEntryCss, /background:\s*transparent;/, "records quick prompt area should not sit on a mismatched white card background");
assert.match(recordsAssistantEntryCss, /border:\s*0;/, "records quick prompt area should not look like a nested card");
const recordsPromptLinkCss = cssBlock(mobileCss, ".records-prompt-link {");
assert.match(recordsPromptLinkCss, /background:\s*transparent\s*!important;/, "records quick prompt links should stay transparent");
assert.match(recordsPromptLinkCss, /box-shadow:\s*none\s*!important;/, "records quick prompt links should not inherit warm-theme pill shadows");
assert.match(recordsPromptLinkCss, /transform:\s*none\s*!important;/, "records quick prompt links should not jump like pill buttons");
assert.match(
  warmCss,
  /\.records-quick-row\s+\.records-prompt-link[\s\S]*?background:\s*transparent\s*!important;[\s\S]*?box-shadow:\s*none\s*!important;/,
  "warm theme should preserve transparent Records quick prompt links after import order",
);
assert.match(appSource, /import \{[^}]*\bcreatePortal\b[^}]*\} from "react-dom"/, "records drawers should render through a body portal instead of being clipped by the records page");
assert.match(recordsBlock, /records-entry-drawer/, "records AI and manual entry should open dedicated drawers");
assert.match(recordsBlock, /manual-record-type-tabs/, "manual record drawer should expose type-specific record tabs");
assert.match(recordsBlock, /manual-stepper/, "manual record drawer should use stepper controls for numeric values");
assert.match(recordsBlock, /manual-choice-grid/, "manual record drawer should use choice controls instead of freeform numeric typing");
// 2026-06-12 选型(5.1):时间选择改 antd-mobile 滚轮(AppTimeField),不再用系统原生控件。
assert.match(recordsBlock, /<AppTimeField/, "manual record drawer should use the AppTimeField wheel picker for exact time");
assert.doesNotMatch(recordsBlock, /type="time"/, "system native time input must not return (ugly on Android, replaced by AppTimeField)");
assert.doesNotMatch(appSource, /type:\s*"note",\s*label:\s*"备注"/, "manual record drawer should not expose a generic note record type");
assert.doesNotMatch(recordsBlock, /className="records-manual-form"/, "manual care logging should not remain as a coarse inline form");
assert.match(mobileCss, /\.records-entry-drawer\s*\{[\s\S]*?height:\s*var\(--app-viewport-height, 100dvh\);/, "records entry drawer should use a full-screen drawer height");
assert.doesNotMatch(mobileCss, /\.records-entry-drawer\s*\{[\s\S]*?max-height:\s*min\(82vh/, "records entry drawer should not remain a small bottom sheet");
assert.match(mobileCss, /@keyframes recordsDrawerSlideUp/, "records entry drawer should animate upward when opening");
assert.match(mobileCss, /@keyframes recordsDrawerSlideDown/, "records entry drawer should animate downward when closing");
const recordsEntryDrawerCss = cssBlock(mobileCss, ".records-entry-drawer {");
assert.match(recordsEntryDrawerCss, /width:\s*100vw;/, "records entry drawer should cover the whole viewport width");
assert.match(recordsEntryDrawerCss, /height:\s*var\(--app-viewport-height, 100dvh\);/, "records entry drawer should cover the whole viewport height");
assert.doesNotMatch(recordsEntryDrawerCss, /overflow-y:\s*auto/, "records entry drawer shell should not show a visible scrollbar");
assert.match(mobileCss, /\.records-drawer-body::-webkit-scrollbar/, "records drawer internal scroll area should hide webkit scrollbars");
assert.match(
  mobileCss,
  /body\.keyboard-open\s+\.records-entry-scrim\s*\{[\s\S]*?inset:\s*0;[\s\S]*?height:\s*var\(--app-viewport-height, 100dvh\);/,
  "records entry scrim should keep covering the full viewport when the keyboard opens",
);
assert.match(
  mobileCss,
  /body\.keyboard-open\s+\.records-entry-drawer\s*\{[\s\S]*?padding-bottom:\s*calc\(max\(18px, env\(safe-area-inset-bottom\)\) \+ var\(--keyboard-inset, 0px\)\);/,
  "records entry drawer should keep its background full-screen while padding content above the keyboard",
);
assert.match(
  mobileCss,
  /body\.keyboard-open\s+\.records-assistant-composer\s*\{[\s\S]*?padding-bottom:\s*18px;/,
  "records AI composer should keep the focused input above the keyboard edge",
);
assert.match(
  mobileCss,
  /\.records-drawer-body--assistant\s*\{[\s\S]*?overflow:\s*visible;/,
  "records AI drawer body should allow the composer background to bleed to full width",
);
assert.match(
  mobileCss,
  /\.records-assistant-composer\s*\{[\s\S]*?calc\(-1 \* max\(16px, env\(safe-area-inset-right\)\)\)[\s\S]*?calc\(-1 \* max\(16px, env\(safe-area-inset-left\)\)\);/,
  "records AI composer should span the full drawer width instead of being clipped by side padding",
);
assert.match(
  mobileCss,
  /\.records-assistant-message\.ai\s*\{[\s\S]*?justify-self:\s*start;/,
  "records AI context should keep AI messages on the left",
);
assert.match(
  mobileCss,
  /\.records-assistant-message\s*\{[\s\S]*?width:\s*fit-content;[\s\S]*?max-width:\s*min\(88%, 344px\);/,
  "records AI context bubbles should size to content with only a viewport-safe cap",
);
assert.match(
  mobileCss,
  /\.records-assistant-message\.parent\s*\{[\s\S]*?justify-self:\s*end;/,
  "records AI context should keep user messages on the right",
);
const recordsAssistantMessageTextCss = cssBlock(mobileCss, ".records-assistant-message p {");
assert.doesNotMatch(recordsAssistantMessageTextCss, /-webkit-line-clamp/, "records AI context should not clamp recent message text");
assert.doesNotMatch(recordsAssistantMessageTextCss, /overflow:\s*hidden/, "records AI context should not hide recent message text");
assert.match(recordsBlock, /records-assistant-main/, "records AI drawer should separate scrollable context from the composer");
assert.match(recordsBlock, /records-drawer-body--assistant/, "records AI drawer should use the assistant-specific full-screen layout");
assert.match(mobileCss, /\.records-drawer-body--assistant\s*\{[\s\S]*?grid-template-rows:\s*minmax\(0, 1fr\) auto;/, "records AI drawer composer should be anchored at the bottom");
const manualFormStart = recordsBlock.indexOf('className="manual-record-form"');
const manualFormEnd = recordsBlock.indexOf("</form>", manualFormStart);
assert.ok(manualFormStart >= 0 && manualFormEnd > manualFormStart, "manual record form block should be findable");
const manualFormBlock = recordsBlock.slice(manualFormStart, manualFormEnd);
assert.doesNotMatch(manualFormBlock, /<textarea/, "manual record drawer should not expose a freeform note textarea");
assert.doesNotMatch(manualFormBlock, /inputMode="decimal"/, "manual record numeric fields should not be freeform decimal inputs");
assert.match(recordsBlock, /growth-curve-card/, "growth view should include a growth curve card");
assert.match(recordsBlock, /growth-curve-svg/, "growth view should render an SVG growth curve");
assert.match(recordsBlock, /records-assistant-body/, "records assistant should render inside the AI drawer");
assert.match(recordsBlock, /records-assistant-drawer/, "records assistant should render in a dedicated AI drawer");
assert.match(recordsBlock, /records-assistant-composer/, "records assistant should provide an inline input composer");
const recordsAssistantComposerStart = recordsBlock.indexOf('className={`records-assistant-composer');
const recordsAssistantComposerEnd = recordsBlock.indexOf("</form>", recordsAssistantComposerStart);
assert.ok(recordsAssistantComposerStart >= 0 && recordsAssistantComposerEnd > recordsAssistantComposerStart, "records assistant composer block should be findable");
const recordsAssistantComposerBlock = recordsBlock.slice(recordsAssistantComposerStart, recordsAssistantComposerEnd);
const recordsAssistantThreadStart = recordsBlock.indexOf('className="records-assistant-thread"');
assert.ok(recordsAssistantThreadStart >= 0 && recordsAssistantThreadStart < recordsAssistantComposerStart, "records assistant thread should appear above composer");
const recordsAssistantThreadBlock = recordsBlock.slice(recordsAssistantThreadStart, recordsAssistantComposerStart);
assert.match(recordsAssistantThreadBlock, /records-assistant-message--processing/, "records assistant processing state should render as a message bubble");
assert.match(recordsAssistantThreadBlock, /records-assistant-loading-dots/, "records assistant processing bubble should use the familiar three-dot loader");
assert.doesNotMatch(recordsAssistantComposerBlock, /records-assistant-processing/, "records assistant composer should not show the processing loader outside the message stream");
assert.match(recordsAssistantComposerBlock, /canUseComposerInput/, "records assistant composer should separate input availability from submit availability");
assert.doesNotMatch(recordsAssistantComposerBlock, /disabled=\{isSubmitting\}/, "records assistant keyboard and voice controls should not be disabled just because AI is processing");
assert.match(recordsBlock, /records-assistant-thread/, "records assistant should show recent context inline");
assert.match(recordsBlock, /record-event-swipe/, "records timeline should wrap events in a swipe-reveal container");
assert.match(recordsBlock, /record-event-card/, "records timeline should render long card content inside a dedicated card layer");
assert.match(recordsBlock, /record-event-primary/, "records timeline cards should condense title and value into a primary row");
assert.match(recordsBlock, /record-event-secondary/, "records timeline cards should condense tags and creator into a secondary row");
assert.match(recordsBlock, /record-event-actions/, "records timeline should include hidden swipe actions");
assert.match(recordsBlock, /beginTimelineEventSwipe/, "records timeline should listen for left-swipe gestures");
assert.match(recordsBlock, /requestDeleteCareTimelineEvent\(event\)/, "records timeline delete should be available from swipe actions");
assert.doesNotMatch(recordsBlock, /<button type="button" className="timeline-edit-button"/, "records timeline should not show a default edit button on every card");
assert.match(appSource, /deleteCareEventDialog/, "records timeline delete should use a second confirmation dialog");
assert.match(appSource, /confirmDeleteCareTimelineEvent/, "records timeline delete confirmation should remove the care event from app state");
assert.match(mobileCss, /\.record-event-list\s*\{[\s\S]*?gap:\s*14px;/, "records timeline should use more spacious long-card rhythm");
assert.match(mobileCss, /\.record-event-swipe\s*\{[\s\S]*?overflow:\s*hidden;/, "records timeline swipe wrapper should hide actions until swiped");
assert.match(mobileCss, /\.record-event-actions\s*\{[\s\S]*?right:\s*0;/, "records timeline actions should sit behind the right edge of each card");
assert.match(mobileCss, /\.record-event-card\s*\{[\s\S]*?border-radius:\s*8px;/, "records timeline cards should read as low-radius rectangular list cards");
assert.match(mobileCss, /\.record-event-actions\s*\{[\s\S]*?border-radius:\s*8px;/, "records timeline swipe actions should match the rectangular card shape");
assert.match(mobileCss, /\.record-event-card\s*\{[\s\S]*?min-height:\s*58px;/, "records timeline cards should be compact enough for dense daily scanning");
assert.match(mobileCss, /\.record-event-primary\s*\{[\s\S]*?grid-template-columns:\s*auto minmax\(0, 1fr\);/, "records timeline primary row should keep title and value on one line when possible");
assert.ok(
  recordsBlock.indexOf('className="segmented-tabs record-tabs"') < recordsBlock.indexOf("records-assistant-entry"),
  "records AI entry should sit under the Records primary navigation",
);

const ledgerStart = appSource.indexOf("<LedgerView");
const ledgerEnd = appSource.indexOf("<AlbumScreen", ledgerStart);
assert.ok(ledgerStart >= 0 && ledgerEnd > ledgerStart, "ledger mount block should be findable");
const ledgerMountBlock = appSource.slice(ledgerStart, ledgerEnd);
assert.match(ledgerMountBlock, /openLedgerAssistant/, "ledger screen should receive an AI-assisted ledger entry handler");

const ledgerViewSource = readFileSync("frontend/src/views/LedgerView.tsx", "utf8");
assert.match(ledgerViewSource, /ledger-ai-entry-card/, "ledger view should expose AI-assisted ledger entry card");
assert.match(ledgerViewSource, /语音记账/, "ledger view should expose voice ledger entry");
assert.match(ledgerViewSource, /拍照\/上传小票/, "ledger view should expose receipt photo upload entry");

const albumScreenSource = readFileSync("frontend/src/components/AlbumScreen.tsx", "utf8");
assert.match(albumScreenSource, /<section className="album-screen tab-content-enter" aria-label="相册">/, "album screen section should live in AlbumScreen component");
// 2026-06-12 产品决定:相册去掉分类 tabs(全部/成长/喂养…),不得回潮。
assert.doesNotMatch(albumScreenSource, /album-category-row/, "album category tabs were removed by product decision (2026-06-12)");
assert.doesNotMatch(albumScreenSource, /screen-pill/, "album top-right count pill was removed by product decision (2026-06-12)");
assert.match(appSource, /<AlbumScreen\b/, "App should mount the extracted AlbumScreen");

// D11 端口层守护:业务壳不得裸引 Capacitor,平台差异只从 platform.ts/六个原生封装进出。
assert.doesNotMatch(appSource, /Capacitor\./, "App.tsx must not call Capacitor directly (use platform.ts port layer, tech-debt D11)");
assert.doesNotMatch(appSource, /from "@capacitor\/core"/, "App.tsx must not import @capacitor/core directly (tech-debt D11)");

// D1 拆分后:我的页整体在 screens/ProfileScreen.tsx(App 仅挂载)。
const profileBlock = readFileSync("frontend/src/screens/ProfileScreen.tsx", "utf8");
assert.match(appSource, /<ProfileScreen\b/, "App should mount the extracted ProfileScreen");
assert.match(profileBlock, /<section className="profile-screen/, "profile screen section should live in ProfileScreen");
assert.match(profileBlock, /profile-reminder-card/, "profile page should contain reminder management card");
assert.match(appSource, /openReminderQuickDraft/, "reminder quick buttons should open manual reminder drafts instead of AI chat prompts");
assert.doesNotMatch(appSource, /REMINDER_QUICK_ACTIONS\.map[\s\S]*?quickFill\(withBabyNickname\(action\.prompt\)\)/, "reminder quick buttons should not send prompt text to AI");
assert.doesNotMatch(profileBlock, /ai-settings-card/, "profile page should not expose AI settings card");
assert.doesNotMatch(profileBlock, /默认模型|默认 AI 模型|深度思考|快速模式/, "profile page should not expose user-selectable model or mode controls");
assert.doesNotMatch(profileBlock, /className="milestone-nav-card"/, "profile page should not expose milestone entry");
assert.doesNotMatch(profileBlock, /自动整理|漏项轻提醒|今日小结/, "profile Pro copy should not sell auto-summary features");

assert.match(
  appSource,
  /const VISUAL_AGENT_MODEL:[\s\S]*?doubao-seed-2\.0-pro/,
  "visual chat requests should route to Doubao",
);
assert.match(
  appSource,
  /const resolveAgentModelForMessage[\s\S]*?messageAttachments\.some\(isVisualAttachment\)[\s\S]*?return VISUAL_AGENT_MODEL;[\s\S]*?return DEFAULT_MODEL;/,
  "pure text chat requests should route to the default DeepSeek model",
);
assert.match(
  appSource,
  /resolveThinkingForMessage/,
  "chat requests should use system adaptive thinking mode instead of a user setting",
);
assert.match(appSource, /model:\s*agentModel/, "agent requests should send the system-selected model");
assert.match(appSource, /thinkingEnabled:\s*agentThinkingEnabled/, "agent requests should send the system-selected thinking mode");
assert.match(appSource, /lowLatencyEnabled:\s*agentLowLatencyEnabled/, "agent requests should send the system-selected latency mode");
assert.doesNotMatch(appSource, /model:\s*currentModel\.id/, "agent requests should not send a UI-selected model");
assert.doesNotMatch(
  appSource,
  /useStoredState<AgentModelId>\("baby-companion-model"/,
  "selected model should not be stored as a user preference",
);
assert.doesNotMatch(
  appSource,
  /useStoredState\("baby-companion-thinking-enabled"/,
  "thinking mode should not be stored as a user preference",
);
assert.match(appSource, /const visualToolGated = !hasAiQuota;/, "visual media button should be gated by AI quota (Pro or remaining free allowance)");
assert.match(appSource, /className=\{`icon-button \$\{visualToolClassName\}`\.trim\(\)\}/, "header camera button should show gated styling");
assert.match(appSource, /className=\{`tool-button \$\{visualToolClassName\}`\.trim\(\)\}/, "composer camera button should show gated styling");
assert.match(appSource, /aria-disabled=\{visualToolGated\}/, "camera buttons should expose a disabled-looking state without suppressing clicks");
assert.match(
  appSource,
  /if \(!hasAiQuota\) \{[\s\S]*?本月免费 AI 体验次数已用完/,
  "clicking the gated camera button should explain the AI quota gate",
);
assert.match(baseCss, /\.icon-button\.visual-tool-gated/, "base CSS should style gated camera buttons");
assert.match(warmCss, /\.icon-button\.visual-tool-gated/, "warm theme should preserve gated camera button styling");

console.log("product simplification structure tests passed");
