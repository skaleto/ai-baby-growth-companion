## Why

UI and interaction work currently relies too much on the user catching mobile layout and behavior issues on a real device after Codex finishes coding. This change makes local browser launch, automated smoke checks, and mobile viewport observation part of the expected Codex delivery standard so frontend output is already functionally and visually sane before handoff.

## What Changes

- Establish a mandatory verification gate for UI, interaction, and mobile-layout changes.
- Require Codex to run local build checks plus browser-based smoke and visual observation for relevant frontend work.
- Define a default mobile viewport matrix for responsive checks: `360x740`, `390x844`, and `430x932`.
- Define escalation rules for Capacitor, native plugin, permission, file/media, notification, audio, safe-area, keyboard, and WebView-risk changes.
- Require explicit disclosure when a verification step cannot run, including the reason, substitute checks, and remaining risk.
- Require final handoff notes to report what was verified, which viewports or flows were inspected, and any known gaps.

## Capabilities

### New Capabilities
- `development-workflow`: Project-level development workflow requirements for Codex frontend verification, smoke testing, visual observation, and handoff reporting.

### Modified Capabilities
- None.

## Impact

- Affects Codex development behavior for React, CSS, Capacitor WebView, and native-adjacent UI changes.
- Future implementation may add Playwright or equivalent browser automation, smoke scripts, screenshot artifacts, README guidance, or agent-facing workflow notes.
- Does not change product runtime behavior in this proposal; it defines the standard that future implementation work should satisfy.
