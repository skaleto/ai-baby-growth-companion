## 1. Document Workflow Standard

- [x] 1.1 Add a project-facing frontend verification guide that restates the mandatory gate, waiver rule, viewport matrix, native escalation triggers, and final handoff summary expectations.
- [x] 1.2 Add an agent-facing note or README section that tells future Codex sessions when to run browser verification, when to escalate to Capacitor/native checks, and how to report blocked checks.
- [x] 1.3 Cross-link the workflow guide from the main README or another discoverable project entry point.

## 2. Add Browser Smoke Tooling

- [x] 2.1 Add Playwright or an equivalent browser automation dependency suitable for local smoke checks.
- [x] 2.2 Add a script that starts the built or dev app locally and fails when the page cannot load.
- [x] 2.3 Add a script that captures console errors and treats obvious runtime failures as verification failures.
- [x] 2.4 Add package scripts for frontend verification, including a single command that future Codex sessions can run for the baseline gate.

## 3. Implement Mobile Viewport Checks

- [x] 3.1 Add automated checks for `360x740`, `390x844`, and `430x932`.
- [x] 3.2 Capture screenshots or structured observations for the affected page or smoke route in each mobile viewport.
- [x] 3.3 Check for horizontal overflow, clipped primary controls, blocked fixed elements, and obvious text overlap in the smoke route.
- [x] 3.4 Ensure desktop smoke remains available but is not the only visual verification path for UI changes.

## 4. Exercise Key User Flows

- [x] 4.1 Define the default smoke route for the current app shell, including initial load and main mobile navigation.
- [x] 4.2 Add interaction smoke coverage for changed controls, tabs, dialogs, forms, and state transitions where a deterministic local path exists.
- [x] 4.3 Add a convention for documenting backend-dependent, auth-dependent, or native-only portions that cannot be fully exercised locally.

## 5. Define Native Escalation Path

- [x] 5.1 Document the file and behavior triggers that require `npm run mobile:sync`.
- [x] 5.2 Document when to attempt `npm run build:ios:debug` or `npm run build:android:debug`.
- [x] 5.3 Add guidance for reporting real-device-only residual risk when simulator or browser verification cannot prove the behavior.

## 6. Verify and Maintain the Standard

- [x] 6.1 Run the new baseline frontend verification command against the current app and fix smoke-test setup issues.
- [x] 6.2 Confirm the final handoff format includes commands run, local surface inspected, covered viewports, checked flows, blocked steps, and residual risks.
- [x] 6.3 Keep the verification guide updated when app architecture, routing, native capabilities, or test tooling changes.
