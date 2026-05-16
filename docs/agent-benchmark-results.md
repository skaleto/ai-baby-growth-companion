# Agent Benchmark Results

Generated at: 2026-05-16T12:34:25.649Z

## Command

```bash
npm run test:agent-benchmark
```

## Summary

- Status: PASS
- Tests: 23
- Failures: 0
- Errors: 0
- Skipped: 0
- Time: 0.612s

## Cases

- PASS `benchmarkCompleteMixedFeedingRecordAutoWritesCareLog` (0.13s)
- PASS `benchmarkGenericIntervalDefaultsToNotificationUnlessRingingRequested` (0.009s)
- PASS `benchmarkDailySummaryMissingItemsUseGentleNonTechnicalCopy` (0.002s)
- PASS `benchmarkSharedDailySummaryContractExcludesPrivateAccountCopy` (0.001s)
- PASS `benchmarkExpenseCreatesPendingDraftButBarcodePriceQueryDoesNotRecord` (0.003s)
- PASS `benchmarkExpenseImageRecognitionDoesNotUseWebSearch` (0.004s)
- PASS `benchmarkSkillDisclosureOnlyLoadsCareGuideWhenNeeded` (0.005s)
- PASS `benchmarkVagueReminderAsksForNaturalTimeOnly` (0.008s)
- PASS `benchmarkPreviousImageRetryRoutesIntoExpenseSkill` (0.003s)
- PASS `benchmarkPreviousImageRetryDoesNotDependOnFrontendAttachmentForwarding` (0.003s)
- PASS `benchmarkExpenseSkillDoesNotAskCategoryOnlyClarification` (0.02s)
- PASS `benchmarkSleepDurationAutoWritesAndSleepStartAsks` (0.008s)
- PASS `benchmarkOneImageExpenseSkillCreatesPendingDraft` (0.004s)
- PASS `benchmarkHighRiskFeverStaysPending` (0.004s)
- PASS `benchmarkUnsupportedChatMutationIsBoundaryOnly` (0.001s)
- PASS `benchmarkSavedExpenseRecognitionDoesNotBecomeConfirmAgainAsk` (0.001s)
- PASS `benchmarkTwelveHourFeedingTimeUsesCurrentAppClock` (0.0s)
- PASS `benchmarkPlannerKeepsWebSearchFallbackWhenModelReturnsEmptyTools` (0.024s)
- PASS `benchmarkMilkIntervalReminderOverridesBadModelOutputAndSuppressesMemory` (0.001s)
- PASS `benchmarkEightImageExpenseSkillBatchesWithoutWebSearch` (0.006s)
- PASS `benchmarkFeedingStartWithoutAmountAsksInsteadOfWriting` (0.009s)
- PASS `benchmarkOnceMilkReminderDoesNotAskCareRecordFields` (0.012s)
- PASS `benchmarkRecognizedExpenseAmountDoesNotBecomeRedundantAmountAsk` (0.001s)

