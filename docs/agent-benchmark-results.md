# Agent Benchmark Results

Generated at: 2026-06-02T15:29:57.572Z

## Command

```bash
npm run test:agent-benchmark
```

## Summary

- Status: PASS
- Tests: 26
- Failures: 0
- Errors: 0
- Skipped: 0
- Time: 0.418s

## Cases

- PASS `benchmarkCompleteMixedFeedingRecordAutoWritesCareLog` (0.08s)
- PASS `benchmarkGenericIntervalDefaultsToNotificationUnlessRingingRequested` (0.005s)
- PASS `benchmarkDailySummaryFallbackOnModelExceptionYieldsEmptyFindings` (0.002s)
- PASS `benchmarkDailySummaryMissingItemsUseGentleNonTechnicalCopy` (0.001s)
- PASS `benchmarkAgentPromptIncludesCaregiverSupportAndHighRiskBoundaries` (0.001s)
- PASS `benchmarkSharedDailySummaryContractExcludesPrivateAccountCopy` (0.0s)
- PASS `benchmarkExpenseCreatesPendingDraftButBarcodePriceQueryDoesNotRecord` (0.004s)
- PASS `benchmarkExpenseImageRecognitionDoesNotUseWebSearch` (0.005s)
- PASS `benchmarkSkillDisclosureOnlyLoadsCareGuideWhenNeeded` (0.005s)
- PASS `benchmarkVagueReminderAsksForNaturalTimeOnly` (0.004s)
- PASS `benchmarkPreviousImageRetryRoutesIntoExpenseSkill` (0.003s)
- PASS `benchmarkPreviousImageRetryDoesNotDependOnFrontendAttachmentForwarding` (0.003s)
- PASS `benchmarkExpenseSkillDoesNotAskCategoryOnlyClarification` (0.018s)
- PASS `benchmarkSleepDurationAutoWritesAndSleepStartAsks` (0.005s)
- PASS `benchmarkOneImageExpenseSkillCreatesPendingDraft` (0.002s)
- PASS `benchmarkHighRiskFeverStaysPending` (0.004s)
- PASS `benchmarkUnsupportedChatMutationIsBoundaryOnly` (0.001s)
- PASS `benchmarkSavedExpenseRecognitionDoesNotBecomeConfirmAgainAsk` (0.0s)
- PASS `benchmarkTwelveHourFeedingTimeUsesCurrentAppClock` (0.001s)
- PASS `benchmarkPlannerKeepsWebSearchFallbackWhenModelReturnsEmptyTools` (0.018s)
- PASS `benchmarkMilkIntervalReminderOverridesBadModelOutputAndSuppressesMemory` (0.001s)
- PASS `benchmarkEightImageExpenseSkillBatchesWithoutWebSearch` (0.008s)
- PASS `benchmarkDailySummaryAiHappyPathAllSixFindingTypesPassValidator` (0.006s)
- PASS `benchmarkFeedingStartWithoutAmountAsksInsteadOfWriting` (0.003s)
- PASS `benchmarkOnceMilkReminderDoesNotAskCareRecordFields` (0.003s)
- PASS `benchmarkRecognizedExpenseAmountDoesNotBecomeRedundantAmountAsk` (0.0s)
