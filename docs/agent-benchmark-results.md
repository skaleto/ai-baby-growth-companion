# Agent Benchmark Results

Generated at: 2026-05-16T12:55:52.392Z

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
- Time: 0.567s

## Cases

- PASS `benchmarkCompleteMixedFeedingRecordAutoWritesCareLog` (0.111s)
- PASS `benchmarkGenericIntervalDefaultsToNotificationUnlessRingingRequested` (0.006s)
- PASS `benchmarkDailySummaryMissingItemsUseGentleNonTechnicalCopy` (0.003s)
- PASS `benchmarkSharedDailySummaryContractExcludesPrivateAccountCopy` (0.001s)
- PASS `benchmarkExpenseCreatesPendingDraftButBarcodePriceQueryDoesNotRecord` (0.005s)
- PASS `benchmarkExpenseImageRecognitionDoesNotUseWebSearch` (0.004s)
- PASS `benchmarkSkillDisclosureOnlyLoadsCareGuideWhenNeeded` (0.006s)
- PASS `benchmarkVagueReminderAsksForNaturalTimeOnly` (0.006s)
- PASS `benchmarkPreviousImageRetryRoutesIntoExpenseSkill` (0.005s)
- PASS `benchmarkPreviousImageRetryDoesNotDependOnFrontendAttachmentForwarding` (0.004s)
- PASS `benchmarkExpenseSkillDoesNotAskCategoryOnlyClarification` (0.022s)
- PASS `benchmarkSleepDurationAutoWritesAndSleepStartAsks` (0.007s)
- PASS `benchmarkOneImageExpenseSkillCreatesPendingDraft` (0.005s)
- PASS `benchmarkHighRiskFeverStaysPending` (0.005s)
- PASS `benchmarkUnsupportedChatMutationIsBoundaryOnly` (0.002s)
- PASS `benchmarkSavedExpenseRecognitionDoesNotBecomeConfirmAgainAsk` (0.001s)
- PASS `benchmarkTwelveHourFeedingTimeUsesCurrentAppClock` (0.001s)
- PASS `benchmarkPlannerKeepsWebSearchFallbackWhenModelReturnsEmptyTools` (0.025s)
- PASS `benchmarkMilkIntervalReminderOverridesBadModelOutputAndSuppressesMemory` (0.001s)
- PASS `benchmarkEightImageExpenseSkillBatchesWithoutWebSearch` (0.006s)
- PASS `benchmarkFeedingStartWithoutAmountAsksInsteadOfWriting` (0.009s)
- PASS `benchmarkOnceMilkReminderDoesNotAskCareRecordFields` (0.005s)
- PASS `benchmarkRecognizedExpenseAmountDoesNotBecomeRedundantAmountAsk` (0.001s)

