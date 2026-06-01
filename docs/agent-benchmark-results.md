# Agent Benchmark Results

Generated at: 2026-06-01T00:25:43.028Z

## Command

```bash
npm run test:agent-benchmark
```

## Summary

- Status: PASS
- Tests: 25
- Failures: 0
- Errors: 0
- Skipped: 0
- Time: 0.512s

## Cases

- PASS `benchmarkCompleteMixedFeedingRecordAutoWritesCareLog` (0.117s)
- PASS `benchmarkGenericIntervalDefaultsToNotificationUnlessRingingRequested` (0.005s)
- PASS `benchmarkDailySummaryFallbackOnModelExceptionYieldsEmptyFindings` (0.002s)
- PASS `benchmarkDailySummaryMissingItemsUseGentleNonTechnicalCopy` (0.002s)
- PASS `benchmarkSharedDailySummaryContractExcludesPrivateAccountCopy` (0.001s)
- PASS `benchmarkExpenseCreatesPendingDraftButBarcodePriceQueryDoesNotRecord` (0.003s)
- PASS `benchmarkExpenseImageRecognitionDoesNotUseWebSearch` (0.003s)
- PASS `benchmarkSkillDisclosureOnlyLoadsCareGuideWhenNeeded` (0.004s)
- PASS `benchmarkVagueReminderAsksForNaturalTimeOnly` (0.005s)
- PASS `benchmarkPreviousImageRetryRoutesIntoExpenseSkill` (0.002s)
- PASS `benchmarkPreviousImageRetryDoesNotDependOnFrontendAttachmentForwarding` (0.003s)
- PASS `benchmarkExpenseSkillDoesNotAskCategoryOnlyClarification` (0.015s)
- PASS `benchmarkSleepDurationAutoWritesAndSleepStartAsks` (0.006s)
- PASS `benchmarkOneImageExpenseSkillCreatesPendingDraft` (0.003s)
- PASS `benchmarkHighRiskFeverStaysPending` (0.004s)
- PASS `benchmarkUnsupportedChatMutationIsBoundaryOnly` (0.001s)
- PASS `benchmarkSavedExpenseRecognitionDoesNotBecomeConfirmAgainAsk` (0.001s)
- PASS `benchmarkTwelveHourFeedingTimeUsesCurrentAppClock` (0.001s)
- PASS `benchmarkPlannerKeepsWebSearchFallbackWhenModelReturnsEmptyTools` (0.021s)
- PASS `benchmarkMilkIntervalReminderOverridesBadModelOutputAndSuppressesMemory` (0.001s)
- PASS `benchmarkEightImageExpenseSkillBatchesWithoutWebSearch` (0.012s)
- PASS `benchmarkDailySummaryAiHappyPathAllSixFindingTypesPassValidator` (0.002s)
- PASS `benchmarkFeedingStartWithoutAmountAsksInsteadOfWriting` (0.005s)
- PASS `benchmarkOnceMilkReminderDoesNotAskCareRecordFields` (0.003s)
- PASS `benchmarkRecognizedExpenseAmountDoesNotBecomeRedundantAmountAsk` (0.001s)
