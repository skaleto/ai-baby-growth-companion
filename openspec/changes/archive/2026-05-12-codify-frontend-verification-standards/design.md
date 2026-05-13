## Context

This project is a React + Capacitor mobile MVP. The current scripts support local Vite development, production builds, Capacitor sync, and iOS/Android debug builds, but there is no project-level standard requiring Codex to start the app, inspect mobile layouts, or smoke-test interactions before handing UI work back to the user.

The user pain is concrete: after Codex implements a feature, the user often has to install or open the app on a device and repeatedly catch responsive layout, fixed-bar, and basic interaction problems that should have been caught during the coding phase.

## Goals / Non-Goals

**Goals:**

- Make UI and interaction verification a default delivery gate for Codex work.
- Shift obvious mobile layout and smoke failures from user/device review into local automated or assisted observation.
- Define a stable minimum viewport matrix for mobile-first inspection.
- Define when verification must escalate from web preview to Capacitor sync or native simulator/debug build.
- Require final responses to report verification evidence and remaining risk clearly.

**Non-Goals:**

- Do not require real-device testing for every UI change.
- Do not implement Playwright, screenshot storage, or CI automation in this change; those are follow-up implementation tasks.
- Do not replace human product review, copy review, or deep native QA.
- Do not require native simulator/debug builds for simple CSS or web-only interaction changes.

## Decisions

### Strong Default Gate With Explicit Waiver

UI, interaction, mobile layout, and visual styling changes are considered incomplete unless Codex has run the applicable local verification. If a required step cannot run, Codex must disclose the failure, the reason, the substitute checks performed, and the remaining risk.

Alternative considered: treat verification as best effort. This was rejected because it preserves the current failure mode where the user discovers obvious defects after handoff.

### Layered Verification Strategy

Every UI or interaction change must start with web-level verification:

- `npm run build`
- local app launch through `npm run dev` or `npm run preview`
- browser-based smoke testing
- mobile viewport visual observation

Native-adjacent changes must escalate to Capacitor and native checks. Triggers include changes involving Capacitor configuration, native plugins, permissions, media/file access, local notifications, audio, haptics, safe areas, keyboard behavior, WebView-only behavior, or platform-specific code under `ios/` or `android/`.

Alternative considered: always run iOS and Android builds. This was rejected because it would slow down ordinary UI work without improving signal enough for every change.

### Default Viewport Matrix

The baseline mobile viewport matrix is:

- `360x740` for compact Android-style widths and cramped layouts.
- `390x844` for the default mainstream iPhone-style check.
- `430x932` for large phone layouts.

Desktop browser smoke remains useful for load and gross interaction checks, but mobile viewports are the primary visual acceptance surface for this app. Landscape, tablet, safe-area-specific, and keyboard-expanded checks are triggered by relevant changes rather than required for every UI change.

Alternative considered: use only one iPhone-sized viewport. This was rejected because the smallest-width case is where text wrapping, bottom navigation, fixed panels, and buttons most often break.

### Visual Observation Is Part of Done

Codex must not treat "build passed" as sufficient evidence for UI changes. The verification pass must look for visible failures such as white screens, console errors, overlapping text, horizontal overflow, clipped controls, blocked primary actions, fixed bars covering content, modal/popup misplacement, and broken mobile navigation.

The preferred long-term implementation is a scripted browser smoke suite that can drive the app, collect screenshots, and flag basic console/layout failures. Until that exists, Codex must use the available browser automation tools to inspect the running app directly.

### Handoff Reporting

The final response for UI work must include a concise verification summary naming the commands run, local surface inspected, viewports covered, key flows exercised, and any gaps. If verification was waived or partially blocked, the final response must say so plainly.

## Risks / Trade-offs

- Required verification increases small-change latency -> Keep the baseline matrix small and escalate only on native-risk triggers.
- Browser viewport checks cannot prove all real-device behavior -> Report true-device residual risks when native APIs, keyboards, safe areas, or device-only permissions are involved.
- Manual browser observation can be inconsistent until automation exists -> Add follow-up tasks for Playwright or equivalent scripted smoke checks.
- Screenshot review can become noisy or ceremonial -> Require screenshots or observation notes only where they support the changed surface, not as an unrelated artifact dump.
