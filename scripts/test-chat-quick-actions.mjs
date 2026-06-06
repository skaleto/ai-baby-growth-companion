#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync("frontend/src/App.tsx", "utf8");
const baseCss = readFileSync("frontend/src/styles/app-base.css", "utf8");
const mobileCss = readFileSync("frontend/src/styles/mobile-app.css", "utf8");
const warmCss = readFileSync("frontend/src/styles/warm-theme.css", "utf8");

assert.match(appSource, /const quickActions = useMemo[<(]/, "chat quick actions should be data-driven");
assert.match(appSource, /className="quick-action"/, "quick action buttons should use the dedicated quick-action class");
assert.match(appSource, /className="quick-action__icon"/, "quick action icons should use a consistent icon wrapper");
assert.doesNotMatch(appSource, /quick-icon-img/, "chat quick actions should not mix raster illustration icons with lucide icons");
assert.match(appSource, /label:\s*"问 AI"/, "chat quick action copy should use the compact label 问 AI");
assert.doesNotMatch(appSource, /问问AI/, "chat quick action copy should avoid the cramped 问问AI label");
assert.match(baseCss, /\.quick-action__icon/, "base CSS should size the quick action icon wrapper");
assert.match(mobileCss, /\.quick-action/, "mobile CSS should control quick action sizing");
assert.match(warmCss, /\.quick-action__icon/, "warm theme should style quick action icon color/background");

console.log("chat quick action structure tests passed");
