#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync("frontend/src/App.tsx", "utf8");
const appOptionsSource = readFileSync("frontend/src/appOptions.ts", "utf8");
const frontendSmokeSource = readFileSync("scripts/frontend-smoke.mjs", "utf8");
const baseCss = readFileSync("frontend/src/styles/app-base.css", "utf8");
const warmCss = readFileSync("frontend/src/styles/warm-theme.css", "utf8");

const composerStart = appSource.indexOf('<div className="composer-tools"');
const composerEnd = appSource.indexOf('<div className="composer-input-line"', composerStart);
assert.ok(composerStart >= 0 && composerEnd > composerStart, "chat composer tools block should be findable");
const composerTools = appSource.slice(composerStart, composerEnd);

assert.doesNotMatch(composerTools, /className="model-select"/, "chat composer should not expose model selection");
assert.doesNotMatch(composerTools, /thinking-button/, "chat composer should not expose deep thinking mode");
assert.doesNotMatch(composerTools, /latency-button/, "chat composer should not expose low latency mode");
assert.match(composerTools, /openMediaPicker/, "chat composer should still expose the media picker");
assert.match(composerTools, /toggleComposerMode/, "chat composer should still expose voice input toggle");

assert.doesNotMatch(appOptionsSource, /id:\s*"reminders"/, "bottom mobile tabs should not include a reminders tab");
assert.doesNotMatch(frontendSmokeSource, /"提醒"/, "frontend smoke should not navigate through a reminders tab");

assert.doesNotMatch(appSource, /<DailySummaryView\b/, "records today view should not render DailySummaryView");
assert.doesNotMatch(appSource, /接收每日小结提醒|整理今天|重新整理|小宝今日观察/, "UI should not expose today-summary sorting/reminder copy");

const recordsStart = appSource.indexOf('<section className="records-screen');
const recordsEnd = appSource.indexOf('<section className="album-screen', recordsStart);
assert.ok(recordsStart >= 0 && recordsEnd > recordsStart, "records screen block should be findable");
const recordsBlock = appSource.slice(recordsStart, recordsEnd);
assert.ok(
  recordsBlock.indexOf('className="growth-entry-card"') >= 0,
  "records today view should expose growth entry card",
);
assert.ok(
  recordsBlock.indexOf('className="milestone-nav-card record-milestone-card"') >= 0,
  "records today view should expose milestone entry",
);
assert.ok(
  recordsBlock.indexOf('className="growth-entry-card"') < recordsBlock.indexOf('className="summary-card"'),
  "growth entry should appear before today summary stats",
);
assert.match(recordsBlock, /growth-trend-card/, "records trend view should include growth trend card");

const profileStart = appSource.indexOf('<section className="profile-screen');
const profileEnd = appSource.indexOf('<aside className="right-rail"', profileStart);
assert.ok(profileStart >= 0 && profileEnd > profileStart, "profile screen block should be findable");
const profileBlock = appSource.slice(profileStart, profileEnd);
assert.match(profileBlock, /profile-reminder-card/, "profile page should contain reminder management card");
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
assert.match(appSource, /const visualToolGated = !proTrial\.enabled;/, "visual media button should be gated by Pro status");
assert.match(appSource, /className=\{`icon-button \$\{visualToolClassName\}`\.trim\(\)\}/, "header camera button should show gated styling");
assert.match(appSource, /className=\{`tool-button \$\{visualToolClassName\}`\.trim\(\)\}/, "composer camera button should show gated styling");
assert.match(appSource, /aria-disabled=\{visualToolGated\}/, "camera buttons should expose a disabled-looking state without suppressing clicks");
assert.match(
  appSource,
  /if \(!proTrial\.enabled\) \{[\s\S]*?图片和视频 AI 整理属于 Pro 内测能力/,
  "clicking the gated camera button should explain Pro gating",
);
assert.match(baseCss, /\.icon-button\.visual-tool-gated/, "base CSS should style gated camera buttons");
assert.match(warmCss, /\.icon-button\.visual-tool-gated/, "warm theme should preserve gated camera button styling");

console.log("product simplification structure tests passed");
