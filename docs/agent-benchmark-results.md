# Agent Benchmark Results

Generated at: 2026-05-16T11:58:55.397Z

## Command

```bash
npm run test:agent-benchmark
```

## Summary

- Status: PASS
- Tests: 21
- Failures: 0
- Errors: 0
- Skipped: 0
- Time: 0.5s

## Cases

- PASS `benchmarkCompleteMixedFeedingRecordAutoWritesCareLog` (0.107s)
- PASS `benchmarkGenericIntervalDefaultsToNotificationUnlessRingingRequested` (0.005s)
- PASS `benchmarkDailySummaryMissingItemsUseGentleNonTechnicalCopy` (0.002s)
- PASS `benchmarkSharedDailySummaryContractExcludesPrivateAccountCopy` (0.001s)
- PASS `benchmarkExpenseCreatesPendingDraftButBarcodePriceQueryDoesNotRecord` (0.003s)
- PASS `benchmarkExpenseImageRecognitionDoesNotUseWebSearch` (0.003s)
- PASS `benchmarkSkillDisclosureOnlyLoadsCareGuideWhenNeeded` (0.005s)
- PASS `benchmarkVagueReminderAsksForNaturalTimeOnly` (0.006s)
- PASS `benchmarkPreviousImageRetryRoutesIntoExpenseSkill` (0.006s)
- PASS `benchmarkSleepDurationAutoWritesAndSleepStartAsks` (0.008s)
- PASS `benchmarkOneImageExpenseSkillCreatesPendingDraft` (0.016s)
- PASS `benchmarkHighRiskFeverStaysPending` (0.004s)
- PASS `benchmarkUnsupportedChatMutationIsBoundaryOnly` (0.001s)
- PASS `benchmarkSavedExpenseRecognitionDoesNotBecomeConfirmAgainAsk` (0.001s)
- PASS `benchmarkTwelveHourFeedingTimeUsesCurrentAppClock` (0.001s)
- PASS `benchmarkPlannerKeepsWebSearchFallbackWhenModelReturnsEmptyTools` (0.018s)
- PASS `benchmarkMilkIntervalReminderOverridesBadModelOutputAndSuppressesMemory` (0.001s)
- PASS `benchmarkEightImageExpenseSkillBatchesWithoutWebSearch` (0.007s)
- PASS `benchmarkFeedingStartWithoutAmountAsksInsteadOfWriting` (0.005s)
- PASS `benchmarkOnceMilkReminderDoesNotAskCareRecordFields` (0.004s)
- PASS `benchmarkRecognizedExpenseAmountDoesNotBecomeRedundantAmountAsk` (0.001s)

