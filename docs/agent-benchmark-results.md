# Agent Benchmark Results

Generated at: 2026-05-16T14:06:57.356Z

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
- Time: 0.52s

## Cases

- PASS `benchmarkCompleteMixedFeedingRecordAutoWritesCareLog` (0.109s)
- PASS `benchmarkGenericIntervalDefaultsToNotificationUnlessRingingRequested` (0.005s)
- PASS `benchmarkDailySummaryMissingItemsUseGentleNonTechnicalCopy` (0.001s)
- PASS `benchmarkSharedDailySummaryContractExcludesPrivateAccountCopy` (0.001s)
- PASS `benchmarkExpenseCreatesPendingDraftButBarcodePriceQueryDoesNotRecord` (0.004s)
- PASS `benchmarkExpenseImageRecognitionDoesNotUseWebSearch` (0.003s)
- PASS `benchmarkSkillDisclosureOnlyLoadsCareGuideWhenNeeded` (0.004s)
- PASS `benchmarkVagueReminderAsksForNaturalTimeOnly` (0.006s)
- PASS `benchmarkPreviousImageRetryRoutesIntoExpenseSkill` (0.003s)
- PASS `benchmarkPreviousImageRetryDoesNotDependOnFrontendAttachmentForwarding` (0.004s)
- PASS `benchmarkExpenseSkillDoesNotAskCategoryOnlyClarification` (0.018s)
- PASS `benchmarkSleepDurationAutoWritesAndSleepStartAsks` (0.006s)
- PASS `benchmarkOneImageExpenseSkillCreatesPendingDraft` (0.003s)
- PASS `benchmarkHighRiskFeverStaysPending` (0.005s)
- PASS `benchmarkUnsupportedChatMutationIsBoundaryOnly` (0.002s)
- PASS `benchmarkSavedExpenseRecognitionDoesNotBecomeConfirmAgainAsk` (0.001s)
- PASS `benchmarkTwelveHourFeedingTimeUsesCurrentAppClock` (0.001s)
- PASS `benchmarkPlannerKeepsWebSearchFallbackWhenModelReturnsEmptyTools` (0.024s)
- PASS `benchmarkMilkIntervalReminderOverridesBadModelOutputAndSuppressesMemory` (0.001s)
- PASS `benchmarkEightImageExpenseSkillBatchesWithoutWebSearch` (0.009s)
- PASS `benchmarkFeedingStartWithoutAmountAsksInsteadOfWriting` (0.004s)
- PASS `benchmarkOnceMilkReminderDoesNotAskCareRecordFields` (0.004s)
- PASS `benchmarkRecognizedExpenseAmountDoesNotBecomeRedundantAmountAsk` (0.001s)

