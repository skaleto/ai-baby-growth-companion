# Agent Benchmark Results

Generated at: 2026-05-14T07:20:22.455Z

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
- Time: 0.297s

## Cases

- PASS `benchmarkCompleteMixedFeedingRecordAutoWritesCareLog` (0.067s)
- PASS `benchmarkGenericIntervalDefaultsToNotificationUnlessRingingRequested` (0.004s)
- PASS `benchmarkExpenseCreatesPendingDraftButBarcodePriceQueryDoesNotRecord` (0.003s)
- PASS `benchmarkSkillDisclosureOnlyLoadsCareGuideWhenNeeded` (0.004s)
- PASS `benchmarkVagueReminderAsksForNaturalTimeOnly` (0.004s)
- PASS `benchmarkSleepDurationAutoWritesAndSleepStartAsks` (0.006s)
- PASS `benchmarkHighRiskFeverStaysPending` (0.003s)
- PASS `benchmarkUnsupportedChatMutationIsBoundaryOnly` (0.0s)
- PASS `benchmarkTwelveHourFeedingTimeUsesCurrentAppClock` (0.0s)
- PASS `benchmarkPlannerKeepsWebSearchFallbackWhenModelReturnsEmptyTools` (0.014s)
- PASS `benchmarkMilkIntervalReminderOverridesBadModelOutputAndSuppressesMemory` (0.001s)
- PASS `benchmarkFeedingStartWithoutAmountAsksInsteadOfWriting` (0.004s)
- PASS `benchmarkOnceMilkReminderDoesNotAskCareRecordFields` (0.003s)

