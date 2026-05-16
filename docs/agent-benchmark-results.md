# Agent Benchmark Results

Generated at: 2026-05-16T13:10:08.355Z

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
- Time: 0.569s

## Cases

- PASS `benchmarkCompleteMixedFeedingRecordAutoWritesCareLog` (0.119s)
- PASS `benchmarkGenericIntervalDefaultsToNotificationUnlessRingingRequested` (0.005s)
- PASS `benchmarkDailySummaryMissingItemsUseGentleNonTechnicalCopy` (0.002s)
- PASS `benchmarkSharedDailySummaryContractExcludesPrivateAccountCopy` (0.001s)
- PASS `benchmarkExpenseCreatesPendingDraftButBarcodePriceQueryDoesNotRecord` (0.006s)
- PASS `benchmarkExpenseImageRecognitionDoesNotUseWebSearch` (0.003s)
- PASS `benchmarkSkillDisclosureOnlyLoadsCareGuideWhenNeeded` (0.005s)
- PASS `benchmarkVagueReminderAsksForNaturalTimeOnly` (0.005s)
- PASS `benchmarkPreviousImageRetryRoutesIntoExpenseSkill` (0.003s)
- PASS `benchmarkPreviousImageRetryDoesNotDependOnFrontendAttachmentForwarding` (0.004s)
- PASS `benchmarkExpenseSkillDoesNotAskCategoryOnlyClarification` (0.02s)
- PASS `benchmarkSleepDurationAutoWritesAndSleepStartAsks` (0.006s)
- PASS `benchmarkOneImageExpenseSkillCreatesPendingDraft` (0.004s)
- PASS `benchmarkHighRiskFeverStaysPending` (0.006s)
- PASS `benchmarkUnsupportedChatMutationIsBoundaryOnly` (0.001s)
- PASS `benchmarkSavedExpenseRecognitionDoesNotBecomeConfirmAgainAsk` (0.001s)
- PASS `benchmarkTwelveHourFeedingTimeUsesCurrentAppClock` (0.001s)
- PASS `benchmarkPlannerKeepsWebSearchFallbackWhenModelReturnsEmptyTools` (0.022s)
- PASS `benchmarkMilkIntervalReminderOverridesBadModelOutputAndSuppressesMemory` (0.002s)
- PASS `benchmarkEightImageExpenseSkillBatchesWithoutWebSearch` (0.009s)
- PASS `benchmarkFeedingStartWithoutAmountAsksInsteadOfWriting` (0.008s)
- PASS `benchmarkOnceMilkReminderDoesNotAskCareRecordFields` (0.004s)
- PASS `benchmarkRecognizedExpenseAmountDoesNotBecomeRedundantAmountAsk` (0.001s)

