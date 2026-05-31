# Agent Benchmark Results

Generated at: 2026-05-31T15:42:14.593Z

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
- Time: 0.449s

## Cases

- PASS `benchmarkCompleteMixedFeedingRecordAutoWritesCareLog` (0.089s)
- PASS `benchmarkGenericIntervalDefaultsToNotificationUnlessRingingRequested` (0.004s)
- PASS `benchmarkDailySummaryMissingItemsUseGentleNonTechnicalCopy` (0.001s)
- PASS `benchmarkSharedDailySummaryContractExcludesPrivateAccountCopy` (0.001s)
- PASS `benchmarkExpenseCreatesPendingDraftButBarcodePriceQueryDoesNotRecord` (0.004s)
- PASS `benchmarkExpenseImageRecognitionDoesNotUseWebSearch` (0.004s)
- PASS `benchmarkSkillDisclosureOnlyLoadsCareGuideWhenNeeded` (0.004s)
- PASS `benchmarkVagueReminderAsksForNaturalTimeOnly` (0.004s)
- PASS `benchmarkPreviousImageRetryRoutesIntoExpenseSkill` (0.004s)
- PASS `benchmarkPreviousImageRetryDoesNotDependOnFrontendAttachmentForwarding` (0.003s)
- PASS `benchmarkExpenseSkillDoesNotAskCategoryOnlyClarification` (0.017s)
- PASS `benchmarkSleepDurationAutoWritesAndSleepStartAsks` (0.006s)
- PASS `benchmarkOneImageExpenseSkillCreatesPendingDraft` (0.003s)
- PASS `benchmarkHighRiskFeverStaysPending` (0.004s)
- PASS `benchmarkUnsupportedChatMutationIsBoundaryOnly` (0.001s)
- PASS `benchmarkSavedExpenseRecognitionDoesNotBecomeConfirmAgainAsk` (0.002s)
- PASS `benchmarkTwelveHourFeedingTimeUsesCurrentAppClock` (0.001s)
- PASS `benchmarkPlannerKeepsWebSearchFallbackWhenModelReturnsEmptyTools` (0.018s)
- PASS `benchmarkMilkIntervalReminderOverridesBadModelOutputAndSuppressesMemory` (0.001s)
- PASS `benchmarkEightImageExpenseSkillBatchesWithoutWebSearch` (0.01s)
- PASS `benchmarkFeedingStartWithoutAmountAsksInsteadOfWriting` (0.004s)
- PASS `benchmarkOnceMilkReminderDoesNotAskCareRecordFields` (0.003s)
- PASS `benchmarkRecognizedExpenseAmountDoesNotBecomeRedundantAmountAsk` (0.001s)

