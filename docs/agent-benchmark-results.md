# Agent Benchmark Results

Generated at: 2026-05-13T09:05:58.452Z

## Command

```bash
npm run test:agent-benchmark
```

## Summary

- Status: PASS
- Tests: 13
- Failures: 0
- Errors: 0
- Skipped: 0
- Time: 0.295s

## Cases

- PASS `benchmarkCompleteMixedFeedingRecordAutoWritesCareLog` (0.083s)
- PASS `benchmarkGenericIntervalDefaultsToNotificationUnlessRingingRequested` (0.005s)
- PASS `benchmarkExpenseCreatesPendingDraftButBarcodePriceQueryDoesNotRecord` (0.003s)
- PASS `benchmarkSkillDisclosureOnlyLoadsCareGuideWhenNeeded` (0.004s)
- PASS `benchmarkVagueReminderAsksForNaturalTimeOnly` (0.004s)
- PASS `benchmarkSleepDurationAutoWritesAndSleepStartAsks` (0.005s)
- PASS `benchmarkHighRiskFeverStaysPending` (0.003s)
- PASS `benchmarkUnsupportedChatMutationIsBoundaryOnly` (0.001s)
- PASS `benchmarkTwelveHourFeedingTimeUsesCurrentAppClock` (0.001s)
- PASS `benchmarkPlannerKeepsWebSearchFallbackWhenModelReturnsEmptyTools` (0.015s)
- PASS `benchmarkMilkIntervalReminderOverridesBadModelOutputAndSuppressesMemory` (0.0s)
- PASS `benchmarkFeedingStartWithoutAmountAsksInsteadOfWriting` (0.003s)
- PASS `benchmarkOnceMilkReminderDoesNotAskCareRecordFields` (0.005s)

