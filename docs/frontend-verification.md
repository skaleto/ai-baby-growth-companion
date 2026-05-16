# Frontend Verification Workflow

This project is a mobile-first React + Capacitor app. Any Codex change that touches UI, visual styling, interaction behavior, mobile layout, or user-facing navigation must be verified in a running local app before handoff.

## Required Gate

For UI and interaction changes, Codex must:

1. Run `npm run build`.
2. Launch the app locally with `npm run dev`, `npm run preview`, or the project smoke script.
3. Inspect the changed surface in a browser.
4. Check the default mobile viewport matrix:
   - `375x667` iPhone SE class
   - `390x844` mainstream iPhone class
   - `430x932` iPhone Pro Max class
   - `360x800` compact Android class
   - `412x915` mainstream Pixel/Android class
   - `432x960` large Android class
5. Exercise the changed interaction or primary flow enough to confirm the key state change appears.
6. Report commands run, surfaces inspected, covered viewports, blocked checks, and residual risk in the final handoff.

Build success alone is not enough evidence for UI work.

## Baseline Command

Use this command for the standard local frontend gate:

```bash
npm run verify:frontend
```

It builds the app, starts a local Vite preview, opens the app with Playwright, mocks the authenticated backend shell, checks desktop smoke plus the required iPhone/Android representative mobile viewports, exercises the mobile tab bar, checks common layout failure signals, and writes local artifacts under `.verification/frontend-smoke/`.

If Playwright reports that Chromium is missing on a fresh machine, run once:

```bash
npm run setup:frontend-smoke
```

For a faster smoke pass after a build already exists:

```bash
npm run smoke:frontend
```

## What The Smoke Checks

The smoke script fails on:

- local preview not loading
- page runtime errors or browser console errors
- missing authenticated app shell
- missing mobile tab navigation in the mocked app shell
- horizontal document overflow in a checked viewport
- visible key UI elements extending outside the viewport
- clipped date/control text in checked form surfaces
- mobile tab clicks that do not switch visible panels
- mobile fixed-panel/form flows where the focused input is hidden during simulated keyboard resize or the app does not recover after keyboard close

It also captures viewport screenshots and writes a summary so the final handoff can name exactly what was inspected.

For modal, drawer, sheet, composer, or form work, treat keyboard open/close as part of the interaction surface. At minimum, focus an input in the changed panel, simulate or exercise keyboard viewport shrink/restore, then confirm the app shell returns to `scrollX=0`, `scrollY=0`, has no horizontal overflow, and no bottom navigation or fixed element blocks the primary action.

## Optional: Vision Review

The smoke script's DOM checks catch structural failures but miss purely visual bugs (overlap, cut-off text, broken alignment that doesn't trigger overflow, etc.). Run the vision review to have Claude inspect each captured screenshot:

```bash
npm run review:vision
```

It reads every PNG under `.verification/frontend-smoke/`, asks Claude to flag visual issues, and writes `vision-review.md` + `vision-review.json` next to the screenshots. Exit code is non-zero if any `major` or `broken` issues are found, so it can gate CI.

### Backends

The script auto-detects which backend to use so it works under any driver:

1. **`claude-cli`** — preferred when the local `claude` binary is on `$PATH` and logged in. Uses your Claude Code subscription credit, no API key needed. This is what Claude Code agents get for free.
2. **`anthropic-api`** — fallback that calls the Anthropic API directly via `@anthropic-ai/sdk`. Requires `ANTHROPIC_API_KEY` and works under any agent (Codex, plain CI, etc.) or a bare Node environment.

If neither is available the script prints an actionable error and exits 2. Pin a backend with `VISION_REVIEW_BACKEND=claude-cli|anthropic-api` to skip auto-detection.

### Knobs (all optional env vars)

- `VISION_REVIEW_BACKEND` — `auto` (default) | `claude-cli` | `anthropic-api`.
- `VISION_REVIEW_MODEL` — defaults to `haiku` for `claude-cli`, `claude-haiku-4-5-20251001` for `anthropic-api`. Bump to `sonnet` / `claude-sonnet-4-6` for stricter review.
- `VISION_REVIEW_CONCURRENCY` — defaults to `2` for `claude-cli`, `4` for `anthropic-api`.
- `VISION_REVIEW_FAIL_ON` — `minor` | `major` | `broken`, defaults to `major`.
- `CLAUDE_BIN` — path to the `claude` binary, defaults to `claude` on `$PATH`.
- `ANTHROPIC_API_KEY` — required only for the `anthropic-api` backend.

For cloud E2E artifacts use `npm run review:vision:cloud` (points at `.verification/cloud-feature-e2e/`). Any directory containing PNGs works: `node scripts/vision-review.mjs path/to/dir`.

## Native Escalation

Browser verification is the default baseline. Escalate beyond it when a change touches native runtime behavior, including:

- `capacitor.config.ts`
- files under `ios/` or `android/`
- native plugin bridges
- permission flows
- camera, media, file, audio, haptics, or local notification behavior
- safe-area, keyboard, or WebView-only behavior

Native-risk changes must run:

```bash
npm run mobile:sync
```

Then attempt the relevant native build when the local environment supports it:

```bash
npm run build:ios:debug
npm run build:android:debug
```

Real-device-only behavior is not required for every Codex handoff, but the handoff must say what still needs true device validation.

## Waiver Rule

If a required check cannot run, Codex must state:

- which check was blocked
- why it was blocked
- what substitute verification was performed
- what risk remains for the user to review

Do not silently skip frontend verification.

## Final Handoff Format

For UI work, include a concise verification summary:

```text
Verification:
- npm run build
- npm run verify:frontend
- Viewports inspected: desktop smoke, 375x667, 390x844, 430x932, 360x800, 412x915, 432x960
- Flow checked: <changed flow>
- Gaps: <none / blocked check and residual risk>
```

For non-UI work, do not imply that visual behavior was verified unless the frontend gate actually ran.
