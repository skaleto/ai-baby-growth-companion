#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync("frontend/src/App.tsx", "utf8");
const mobileCss = readFileSync("frontend/src/styles/mobile-app.css", "utf8");

assert.doesNotMatch(appSource, /voice-cancel-hint/, "voice recording UI should not use the old small cancel pill");
assert.match(appSource, /voice-recording-panel/, "voice recording should render a large bottom panel");
assert.match(appSource, /voice-recording-active/, "app shell should enter a recording state");
assert.match(appSource, /voice-recording-hidden/, "composer controls should be visually hidden while recording");
assert.match(
  appSource,
  /voiceRecordingActive\s*\?\s*createPortal\([\s\S]*?className=\{`voice-recording-panel \$\{voiceCancelArmed \? "canceling" : ""\}`\.trim\(\)\}[\s\S]*?document\.body/,
  "voice recording panel should portal to body so it can sit above body-level Records drawers",
);
assert.match(
  appSource,
  /voice-recording-panel \$\{voiceCancelArmed \? "canceling" : ""\}/,
  "voice recording panel should have a canceling state",
);
assert.match(appSource, /松手发送，上移取消/, "normal voice panel should explain release-to-send and move-up-to-cancel");
assert.match(appSource, /松手取消/, "cancel voice panel should explain release-to-cancel");
assert.match(appSource, /voice-wave-bars/, "voice recording panel should render waveform bars");
assert.match(appSource, /Array\.from\(\{ length: 56 \}/, "waveform should use enough bars to read as an audio strip");

assert.match(mobileCss, /\.voice-recording-panel\s*\{[\s\S]*?position:\s*fixed/, "voice panel should be fixed over the bottom of the screen");
assert.match(mobileCss, /\.voice-recording-panel\s*\{[\s\S]*?inset:\s*0/, "voice panel should cover the full app surface");
assert.match(mobileCss, /\.voice-recording-panel\s*\{[\s\S]*?z-index:\s*3600/, "voice panel should render above full-screen record drawers");
assert.match(
  appSource,
  /const closeRecordsEntryDrawer = \(\) => \{[\s\S]*?if \(voiceRecordingActive\) cancelVoiceCapture\(\);/,
  "closing a Records drawer should cancel active voice capture instead of revealing it on the main page",
);
assert.match(mobileCss, /\.voice-recording-panel::before\s*\{[\s\S]*?border-radius:\s*50%/, "voice panel should render a circular region from below the app");
assert.match(mobileCss, /\.voice-recording-panel::before\s*\{[\s\S]*?bottom:\s*calc\(36vh - var\(--voice-orb-size\)\)/, "voice circle should extend from below the app bottom");
assert.match(mobileCss, /\.voice-recording-panel::before\s*\{[\s\S]*?radial-gradient\([\s\S]*?circle at 50% 54%[\s\S]*?#2f73ff/, "normal voice panel should use a circular blue region");
assert.match(mobileCss, /\.voice-recording-panel\.canceling::before\s*\{[\s\S]*?radial-gradient\([\s\S]*?circle at 50% 54%[\s\S]*?#ff3b30/, "cancel voice panel should use a circular red region");
assert.match(mobileCss, /\.voice-recording-panel::before\s*\{[\s\S]*?rgba\(132, 205, 255, 0\.22\) 62%[\s\S]*?rgba\(230, 248, 255, 0\.06\) 74%[\s\S]*?rgba\(255, 255, 255, 0\) 84%/, "normal voice circle should softly fade out before its edge");
assert.match(mobileCss, /\.voice-recording-panel\.canceling::before\s*\{[\s\S]*?rgba\(255, 179, 176, 0\.24\) 62%[\s\S]*?rgba\(255, 242, 242, 0\.07\) 74%[\s\S]*?rgba\(255, 255, 255, 0\) 84%/, "cancel voice circle should softly fade out before its edge");
assert.match(mobileCss, /\.voice-recording-panel::before\s*\{[\s\S]*?opacity:\s*calc\(0\.66 \+ var\(--voice-level\) \* 0\.3\)/, "voice circle should start lighter and breathe more visibly in opacity");
assert.match(mobileCss, /\.voice-recording-panel::before\s*\{[\s\S]*?transform:\s*translateX\(-50%\) scale\(calc\(0\.94 \+ var\(--voice-level\) \* 0\.18\)\)/, "voice circle should start slightly smaller and breathe more visibly in scale");
assert.match(mobileCss, /\.voice-recording-panel::before\s*\{[\s\S]*?filter:\s*blur\(10px\) brightness\(calc\(0\.96 \+ var\(--voice-level\) \* 0\.28\)\)/, "voice circle should breathe more visibly in brightness");
assert.match(mobileCss, /\.voice-recording-panel::before\s*\{[\s\S]*?transition:\s*opacity 90ms linear,\s*transform 90ms linear,\s*filter 90ms linear/, "voice circle breathing should respond quickly to volume changes");
assert.match(mobileCss, /\.composer\.voice-recording-hidden\s*\{[\s\S]*?opacity:\s*0/, "recording should hide the composer controls under the circular voice region");
assert.match(mobileCss, /\.app-shell\.voice-recording-active \.mobile-tabbar\s*\{[\s\S]*?visibility:\s*hidden[\s\S]*?opacity:\s*0/, "recording should hide the bottom tab bar completely");
assert.match(mobileCss, /\.voice-wave-bars/, "voice waveform strip should be styled");
assert.match(mobileCss, /\.voice-wave-bar/, "individual voice waveform bars should be styled");

console.log("voice capture panel structure tests passed");
