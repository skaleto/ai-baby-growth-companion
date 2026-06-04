# Agent Benchmark Results

Generated at: 2026-06-04T11:15:18.177Z

## Command

```bash
npm run test:agent-benchmark
```

## Summary

- Status: PASS
- Tests: 43
- Failures: 0
- Errors: 0
- Skipped: 0
- Time: 0.496s

## Cases

- PASS `benchmarkCompleteMixedFeedingRecordAutoWritesCareLog` (0.061s)
- PASS `benchmarkGenericCareQuestionSuppressesModelMemoryCandidate` (0.001s)
- PASS `benchmarkGenericIntervalDefaultsToNotificationUnlessRingingRequested` (0.003s)
- PASS `benchmarkDailySummaryFallbackOnModelExceptionYieldsEmptyFindings` (0.001s)
- PASS `benchmarkVagueReminderAsksEvenWhenModelOmitsReminderDto` (0.001s)
- PASS `benchmarkExplicitPreferenceAndCaregiverMemoriesBecomePendingDrafts` (0.002s)
- PASS `benchmarkExplicitHealthMemoryBecomesPendingDraft` (0.001s)
- PASS `benchmarkDailySummaryMissingItemsUseGentleNonTechnicalCopy` (0.001s)
- PASS `benchmarkGrowthMeasurementHistoryDeleteStaysBoundaryOnly` (0.001s)
- PASS `benchmarkAgentPromptIncludesCaregiverSupportAndHighRiskBoundaries` (0.001s)
- PASS `benchmarkSharedDailySummaryContractExcludesPrivateAccountCopy` (0.0s)
- PASS `benchmarkExpenseCreatesPendingDraftButBarcodePriceQueryDoesNotRecord` (0.002s)
- PASS `benchmarkProfileUpdateRequestIsBoundaryOnly` (0.001s)
- PASS `benchmarkExpenseImageRecognitionDoesNotUseWebSearch` (0.002s)
- PASS `benchmarkSkillDisclosureOnlyLoadsCareGuideWhenNeeded` (0.013s)
- PASS `benchmarkVagueReminderAsksForNaturalTimeOnly` (0.003s)
- PASS `benchmarkPreviousImageRetryRoutesIntoExpenseSkill` (0.002s)
- PASS `benchmarkPreviousImageRetryDoesNotDependOnFrontendAttachmentForwarding` (0.002s)
- PASS `benchmarkDuplicateGrowthMeasurementAsksWithoutPendingDraft` (0.002s)
- PASS `benchmarkExpenseSkillDoesNotAskCategoryOnlyClarification` (0.038s)
- PASS `benchmarkGrowthMeasurementsBecomePendingDrafts` (0.001s)
- PASS `benchmarkSleepDurationAutoWritesAndSleepStartAsks` (0.004s)
- PASS `benchmarkDuplicateGrowthMeasurementReplyDoesNotInviteDuplicateRecord` (0.101s)
- PASS `benchmarkOneImageExpenseSkillCreatesPendingDraft` (0.002s)
- PASS `benchmarkHighRiskFeverStaysPending` (0.003s)
- PASS `benchmarkUnsupportedChatMutationIsBoundaryOnly` (0.0s)
- PASS `benchmarkReadOnlyWeeklySummaryDoesNotAppendCareLogAsk` (0.001s)
- PASS `benchmarkMedicineAndVaccineRemindersStayPending` (0.003s)
- PASS `benchmarkReadOnlyDailySummaryDoesNotAppendCareLogAsk` (0.001s)
- PASS `benchmarkSavedExpenseRecognitionDoesNotBecomeConfirmAgainAsk` (0.001s)
- PASS `benchmarkTwelveHourFeedingTimeUsesCurrentAppClock` (0.001s)
- PASS `benchmarkAmbiguousGrowthWeightUnitAsksInsteadOfPendingDraft` (0.001s)
- PASS `benchmarkPlannerKeepsWebSearchFallbackWhenModelReturnsEmptyTools` (0.012s)
- PASS `benchmarkMilkIntervalReminderOverridesBadModelOutputAndSuppressesMemory` (0.0s)
- PASS `benchmarkReadOnlyReminderListDoesNotAppendReminderCreationAsk` (0.003s)
- PASS `benchmarkOutOfRangeGrowthMeasurementAsksInsteadOfPendingDraft` (0.001s)
- PASS `benchmarkEightImageExpenseSkillBatchesWithoutWebSearch` (0.004s)
- PASS `benchmarkDailySummaryAiHappyPathAllSixFindingTypesPassValidator` (0.002s)
- PASS `benchmarkFeedingStartWithoutAmountAsksInsteadOfWriting` (0.003s)
- PASS `benchmarkGrowthMeasurementHistoryUpdateStaysBoundaryOnly` (0.002s)
- PASS `benchmarkPrivateReminderShareBoundaryDoesNotPromiseSyncOrAskTime` (0.001s)
- PASS `benchmarkOnceMilkReminderDoesNotAskCareRecordFields` (0.001s)
- PASS `benchmarkRecognizedExpenseAmountDoesNotBecomeRedundantAmountAsk` (0.0s)
