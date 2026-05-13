## ADDED Requirements

### Requirement: UI changes require frontend verification
The development workflow SHALL treat any change to UI, visual styling, interaction behavior, mobile layout, or user-facing navigation as requiring frontend verification before handoff.

#### Scenario: UI change is completed
- **WHEN** Codex changes React components, CSS, user-facing interaction logic, or mobile layout behavior
- **THEN** Codex MUST run the applicable frontend verification steps before reporting the work as complete

#### Scenario: Required verification cannot run
- **WHEN** a required verification step is blocked by missing tools, unavailable services, environment limits, or runtime failure
- **THEN** Codex MUST report the blocked step, the reason, the substitute checks performed, and the remaining user/device risk

### Requirement: Baseline web verification is mandatory
The development workflow SHALL require baseline web verification for UI and interaction changes using the local project build and a running local app.

#### Scenario: Web-level verification runs
- **WHEN** Codex completes a UI or interaction change
- **THEN** Codex MUST run `npm run build`, launch the app locally with `npm run dev` or `npm run preview`, and inspect the running page with browser automation or an equivalent local browser tool

#### Scenario: Build-only evidence is insufficient
- **WHEN** Codex has only run compilation or build commands for a UI or interaction change
- **THEN** Codex MUST NOT claim the UI is verified without also inspecting the running page

### Requirement: Mobile viewport matrix is the default visual check
The development workflow SHALL use a default mobile viewport matrix of `360x740`, `390x844`, and `430x932` for UI and interaction changes.

#### Scenario: Responsive visual check runs
- **WHEN** Codex verifies a UI or interaction change in the browser
- **THEN** Codex MUST inspect the affected page or flow at `360x740`, `390x844`, and `430x932`

#### Scenario: Desktop check is performed
- **WHEN** Codex performs a desktop browser smoke check
- **THEN** Codex MUST treat it as supplementary evidence and still prioritize mobile viewport observations for this mobile app

### Requirement: Visual observation must check common mobile failures
The development workflow SHALL require visual observation to check for common mobile app failures that affect usability.

#### Scenario: Visual pass checks layout quality
- **WHEN** Codex inspects the affected page or flow
- **THEN** Codex MUST check for white screens, obvious console errors, text overlap, horizontal overflow, clipped controls, broken wrapping, inaccessible primary actions, and content hidden by fixed elements

#### Scenario: High-risk UI elements are changed
- **WHEN** the change affects bottom navigation, fixed headers or footers, modals, drawers, forms, input areas, media previews, or scrollable panels
- **THEN** Codex MUST explicitly inspect that those elements do not block core content or prevent the primary action in the covered mobile viewports

### Requirement: Functional smoke must exercise the changed flow
The development workflow SHALL include a functional smoke pass for the changed or newly introduced user-facing behavior.

#### Scenario: Interactive feature changes
- **WHEN** Codex changes a clickable control, navigation path, form, tab, modal, upload/media entry point, or state transition
- **THEN** Codex MUST exercise the changed flow enough to confirm the key entry point responds and the primary state change or output appears

#### Scenario: Smoke cannot reach backend-dependent success
- **WHEN** the changed flow depends on an unavailable backend, authentication state, remote API, native permission, or device-only capability
- **THEN** Codex MUST verify the reachable local states and report the unverified backend, auth, native, or device-only portion as remaining risk

### Requirement: Native-risk changes escalate verification
The development workflow SHALL escalate verification beyond browser checks when changes may affect Capacitor or native runtime behavior.

#### Scenario: Capacitor or native-adjacent files change
- **WHEN** Codex changes `capacitor.config.ts`, files under `ios/` or `android/`, native plugin bridges, platform-specific permission handling, local notifications, media/file access, audio, haptics, safe-area behavior, keyboard behavior, or WebView-only logic
- **THEN** Codex MUST run `npm run mobile:sync` and attempt the relevant iOS simulator or Android debug build unless the environment prevents it

#### Scenario: Real-device-only behavior remains
- **WHEN** a behavior can only be proven on a real device or with physical permissions
- **THEN** Codex MUST state which automated or simulator checks were completed and what still needs real-device validation

### Requirement: Verification summary is required in handoff
The development workflow SHALL require Codex final responses for UI and interaction work to include a concise verification summary.

#### Scenario: UI work is handed off
- **WHEN** Codex reports completion of UI, interaction, or mobile-layout work
- **THEN** Codex MUST summarize the commands run, the local app surface inspected, the covered viewports, the key flow or visual areas checked, and any blocked checks or residual risks

#### Scenario: No UI verification was needed
- **WHEN** Codex completes a non-UI change that did not require frontend verification
- **THEN** Codex MAY omit viewport details but MUST avoid implying that UI behavior was visually verified
