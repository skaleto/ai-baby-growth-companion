// Product-feature coverage ownership for the current 2026-06-06 direction.
//
// This index intentionally follows the compact harness/feature_list.json. Old
// May commercialization, DailySummaryView, and independent reminder/chat-tab
// decisions are not current product direction.

export const productCoverageIndex = [
  {
    featureId: "harness-001",
    status: "covered_by_non_agent_gate",
    coverage: [
      {
        layer: "harness",
        evidence: "bash harness/init.sh checks repository state, whitespace, frontend build, and npm run test:agent-benchmark.",
      },
    ],
  },
  {
    featureId: "product-ia-2026-06-06",
    status: "covered_by_non_agent_gate",
    coverage: [
      {
        layer: "frontend",
        evidence: "npm run verify:frontend is the release gate for Records-first navigation, Records/Album/Ledger/My layout, mobile overflow, and app-shell changes.",
      },
      {
        layer: "docs",
        evidence: "docs/system-architecture.md defines the target IA (记录/相册/账本/我的) and module-native AI boundary.",
      },
    ],
    nextAction: "After implementation, refresh Playwright smoke assertions so bottom navigation and default tab match 记录 / 相册 / 账本 / 我的.",
  },
  {
    featureId: "agent-tool-first-2026-06-06",
    status: "known_gap",
    coverage: [
      {
        layer: "docs",
        evidence: "docs/agent-detailed-design.md defines the target tool-first write path.",
      },
      {
        layer: "l2",
        scenarioIds: ["feed-complete", "growth-measurement-complete", "expense-record"],
        evidence: "Existing L2 scenarios represent the P0 record/ledger behaviors that must be re-backed by controlled action tools.",
      },
    ],
    nextAction: "Implement backend Agent action tools and update L0/L1 plus L2 assertions so final replies are grounded in tool results.",
  },
  {
    featureId: "agent-context-harness-2026-06-06",
    status: "covered",
    coverage: [
      {
        layer: "l0_l1",
        evidence: "npm run test:agent-benchmark covers the Chinese model-context harness injection and deterministic bad-case regressions.",
      },
      {
        layer: "docs",
        evidence: "harness/agent-model-context-harness.md is the current human-maintained harness.",
      },
    ],
  },
  {
    featureId: "frontend-001",
    status: "covered_by_non_agent_gate",
    coverage: [
      {
        layer: "frontend",
        evidence: "npm run verify:frontend runs product simplification tests, voice capture panel checks, care-log stats checks, build, and Playwright smoke across desktop plus mobile viewports.",
      },
      {
        layer: "docs",
        evidence: "docs/frontend-verification.md defines the viewport matrix and waiver discipline for UI work.",
      },
    ],
  },
  {
    featureId: "cloud-001",
    status: "covered_by_non_agent_gate",
    coverage: [
      {
        layer: "cloud",
        evidence: "Cloud releases require SYNC_DATA=0 deploys plus /api/health and behavior-specific probes such as mobile-updates/check or cloud-feature-e2e.",
      },
    ],
    nextAction: "Run cloud behavior probes when a change affects deployed backend persistence, OTA, media, or cross-user state.",
  },
  {
    featureId: "mobile-001",
    status: "known_gap",
    coverage: [
      {
        layer: "native",
        capabilityIds: [
          "asr-voice-input",
          "local-notifications",
          "full-screen-ringing",
          "haptics",
          "native-media-picker",
          "ota-updater",
          "safe-area-keyboard",
        ],
        evidence: "scripts/native-capability-audit.mjs tracks static evidence for native capabilities. Real device delivery/input/apply behavior remains device-gated.",
      },
    ],
    nextAction: "Add real iOS/Android device probes before claiming OS-level behavior is complete.",
  },
  {
    featureId: "release-hardening-2026-06-05",
    status: "covered_by_non_agent_gate",
    coverage: [
      {
        layer: "docs",
        evidence: "docs/superpowers/specs/2026-06-05-release-readiness-improvement-design.md and harness/quality-document.md track release blockers and evidence expectations.",
      },
    ],
    nextAction: "Execute the release-hardening checklist before broader beta or public release.",
  },
  {
    featureId: "legal-data-2026-06-06",
    status: "covered_by_non_agent_gate",
    coverage: [
      {
        layer: "docs",
        evidence: "docs/legal/ keeps privacy, terms, and third-party data-processing drafts separate from deleted May product decisions.",
      },
    ],
    nextAction: "Refresh legal drafts before broader beta after the actual data flow, Pro entitlement, and provider list settle.",
  },
];
