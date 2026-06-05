// Product-function coverage index for the benchmark program.
//
// This file bridges the repo harness feature list with the agent-specific L2
// scenario matrix. Not every app feature belongs in the agent chat benchmark;
// every feature must still have an explicit gate or a visible known gap.

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
    featureId: "agent-001",
    status: "covered",
    coverage: [
      {
        layer: "l0_l1",
        evidence: "npm run test:agent-benchmark covers deterministic policy, planner, runtime, and prompt boundary behavior.",
      },
      {
        layer: "l2",
        scenarioIds: [
          "feed-complete",
          "feed-mixed-missing-type",
          "sleep-complete",
          "sleep-start-boundary",
          "multi-care-events",
          "reminder-once",
          "vague-reminder-ask",
          "medicine-reminder-pending",
          "vaccine-reminder-pending",
          "expense-record",
          "growth-milestone",
          "growth-measurement-complete",
          "growth-measurement-ambiguous-unit",
          "growth-measurement-out-of-range",
          "growth-measurement-update-boundary",
          "growth-measurement-delete-boundary",
          "growth-measurement-duplicate-boundary",
          "memory-health-pending",
          "memory-preference-pending",
          "memory-caregiver-pending",
          "qa-care-no-memory-pollution",
          "qa-care-allergy-context",
          "daily-observation-context",
          "caregiver-fatigue-context",
          "read-only-daily-summary-context",
          "read-only-weekly-summary-context",
          "private-reminder-share-boundary",
          "photo-album",
          "screenshot-ignore",
        ],
        evidence: "L2 scenarios exercise real /api/agent/chat/stream plus simulated frontend effect application and app_state diff.",
      },
    ],
  },
  {
    featureId: "agent-002",
    status: "covered",
    coverage: [
      {
        layer: "l0_l1",
        evidence: "AgentBenchmarkTests, SkillRouterTests, ExpenseRecognitionSkillTests, AgentRuntimeTests, and EffectPolicyTests cover executable expense recognition, batching, previous-image hydration, duplicate handling, and saved-expense fallbacks.",
      },
      {
        layer: "l2",
        scenarioIds: ["expense-record"],
        evidence: "expense-record verifies a text ledger draft enters pendingEffects.expenses without directly mutating final expenses.",
      },
    ],
    nextAction: "Add a real L2 image-expense scenario after fixture/upload preparation can represent receipts deterministically.",
  },
  {
    featureId: "frontend-001",
    status: "covered_by_non_agent_gate",
    coverage: [
      {
        layer: "frontend",
        evidence: "npm run verify:frontend runs frontend build and Playwright smoke across desktop plus mobile viewports.",
      },
      {
        layer: "docs",
        evidence: "docs/frontend-verification.md defines the viewport matrix and waiver discipline for UI work.",
      },
    ],
  },
  {
    featureId: "recording-companion-p0",
    status: "covered_by_non_agent_gate",
    coverage: [
      {
        layer: "frontend",
        evidence: "scripts/test-daily-summary-utils.mjs and scripts/probe-daily-summary-view.mjs cover daily observation stats, missing prompts, and record feedback.",
      },
      {
        layer: "l2",
        scenarioIds: ["daily-observation-context", "read-only-daily-summary-context"],
        evidence: "L2 verifies agent read-only/data-linked daily observation behavior does not write accidental records.",
      },
    ],
  },
  {
    featureId: "recording-companion-p1",
    status: "covered_by_non_agent_gate",
    coverage: [
      {
        layer: "frontend",
        evidence: "scripts/test-daily-summary-utils.mjs and scripts/probe-daily-summary-view.mjs cover caregiver line, explanation disclosure, and verify handoff/missing prompts stay out of the primary records view.",
      },
      {
        layer: "l2",
        scenarioIds: ["caregiver-fatigue-context", "read-only-weekly-summary-context"],
        evidence: "L2 verifies low-anxiety caregiver support and weekly summary use existing data without generating new records.",
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
        evidence: "scripts/native-capability-audit.mjs tracks native-capability-audit evidence for asr-voice-input, local-notifications, full-screen-ringing, haptics, native-media-picker, ota-updater, and safe-area-keyboard. Static evidence is covered; real delivery/input behavior remains device-gated.",
      },
    ],
    nextAction: "Add dedicated native/device probes for ASR voice input, notification delivery, full-screen ringing, haptics, native media picker, OTA apply, and WebView keyboard/safe-area behavior; browser/L2 cannot prove these.",
  },
  {
    featureId: "growth-001",
    status: "covered",
    coverage: [
      {
        layer: "frontend",
        evidence: "npm run verify:frontend smoke covers growth MVP entry, invalid height rejection, valid height note entry, and absence of premature growth charts.",
      },
      {
        layer: "backend",
        evidence: "AppStateControllerTests cover pending growthMeasurements confirmation plus manual growthMeasurements upsert/delete maintenance.",
      },
      {
        layer: "l2",
        scenarioIds: [
          "growth-measurement-complete",
          "growth-measurement-ambiguous-unit",
          "growth-measurement-out-of-range",
          "growth-measurement-update-boundary",
          "growth-measurement-delete-boundary",
          "growth-measurement-duplicate-boundary",
          "read-only-growth-trend-context",
        ],
        evidence: "L2 verifies AI-created pending growth measurements, unsafe/boundary no-writes, duplicate no-write behavior, and read-only growth trend queries.",
      },
    ],
  },
  {
    featureId: "shared-records-001",
    status: "covered_by_non_agent_gate",
    coverage: [
      {
        layer: "backend",
        evidence: "AppStateControllerTests cover contributor enrichment and attachment hydration for shared records, ledger, and album state.",
      },
      {
        layer: "cloud",
        evidence: "npm run test:cloud-e2e covers live timeline recordedBy display and ledger attachment preview for shared family records.",
      },
      {
        layer: "l2",
        scenarioIds: ["private-reminder-share-boundary", "photo-album"],
        evidence: "L2 covers private state sharing boundaries and album state mutation shape, but contributor/attachment UI remains a cloud/frontend gate.",
      },
    ],
  },
  {
    featureId: "commercialization-001",
    status: "covered_by_non_agent_gate",
    coverage: [
      {
        layer: "backend",
        evidence: "ProTrialControllerTests cover trial application, Pro entitlement, summary permissions, private-data exclusion, and usage logging.",
      },
      {
        layer: "frontend",
        evidence: "npm run verify:frontend covers the Pro trial / daily summary UI states used by the smoke fixture.",
      },
      {
        layer: "native",
        evidence: "mobile:sync and native debug builds are required when notification scheduling changes.",
      },
    ],
    nextAction: "If Pro summary behavior is changed, add or refresh cloud/account-level probes because this is entitlement and role-sensitive.",
  },
];
