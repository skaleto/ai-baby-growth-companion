# Agent Benchmark Results

Generated at: 2026-06-05T14:38:42.496Z

## Command

```bash
npm run test:agent-benchmark
```

## Summary

- Status: PASS
- Tests: 44
- Failures: 0
- Errors: 0
- Skipped: 0
- Time: 0.576s

## Cases

- PASS `benchmarkCompleteMixedFeedingRecordAutoWritesCareLog` (0.102s)
- PASS `benchmarkGenericCareQuestionSuppressesModelMemoryCandidate` (0.002s)
- PASS `benchmarkGenericIntervalDefaultsToNotificationUnlessRingingRequested` (0.003s)
- PASS `benchmarkDailySummaryFallbackOnModelExceptionYieldsEmptyFindings` (0.002s)
- PASS `benchmarkEmbeddedQuestionWithConcreteMilkRecordStillAutoWritesCareLog` (0.005s)
- PASS `benchmarkVagueReminderAsksEvenWhenModelOmitsReminderDto` (0.002s)
- PASS `benchmarkExplicitPreferenceAndCaregiverMemoriesBecomePendingDrafts` (0.002s)
- PASS `benchmarkExplicitHealthMemoryBecomesPendingDraft` (0.0s)
- PASS `benchmarkDailySummaryMissingItemsUseGentleNonTechnicalCopy` (0.001s)
- PASS `benchmarkGrowthMeasurementHistoryDeleteStaysBoundaryOnly` (0.002s)
- PASS `benchmarkAgentPromptIncludesCaregiverSupportAndHighRiskBoundaries` (0.001s)
- PASS `benchmarkSharedDailySummaryContractExcludesPrivateAccountCopy` (0.001s)
- PASS `benchmarkExpenseCreatesPendingDraftButBarcodePriceQueryDoesNotRecord` (0.003s)
- PASS `benchmarkProfileUpdateRequestIsBoundaryOnly` (0.001s)
- PASS `benchmarkExpenseImageRecognitionDoesNotUseWebSearch` (0.003s)
- PASS `benchmarkSkillDisclosureOnlyLoadsCareGuideWhenNeeded` (0.003s)
- PASS `benchmarkVagueReminderAsksForNaturalTimeOnly` (0.003s)
- PASS `benchmarkPreviousImageRetryRoutesIntoExpenseSkill` (0.003s)
- PASS `benchmarkPreviousImageRetryDoesNotDependOnFrontendAttachmentForwarding` (0.003s)
- PASS `benchmarkDuplicateGrowthMeasurementAsksWithoutPendingDraft` (0.002s)
- PASS `benchmarkExpenseSkillDoesNotAskCategoryOnlyClarification` (0.013s)
- PASS `benchmarkGrowthMeasurementsBecomePendingDrafts` (0.002s)
- PASS `benchmarkSleepDurationAutoWritesAndSleepStartAsks` (0.005s)
- PASS `benchmarkDuplicateGrowthMeasurementReplyDoesNotInviteDuplicateRecord` (0.131s)
- PASS `benchmarkOneImageExpenseSkillCreatesPendingDraft` (0.002s)
- PASS `benchmarkHighRiskFeverStaysPending` (0.003s)
- PASS `benchmarkUnsupportedChatMutationIsBoundaryOnly` (0.001s)
- PASS `benchmarkReadOnlyWeeklySummaryDoesNotAppendCareLogAsk` (0.001s)
- PASS `benchmarkMedicineAndVaccineRemindersStayPending` (0.003s)
- PASS `benchmarkReadOnlyDailySummaryDoesNotAppendCareLogAsk` (0.001s)
- PASS `benchmarkSavedExpenseRecognitionDoesNotBecomeConfirmAgainAsk` (0.001s)
- PASS `benchmarkTwelveHourFeedingTimeUsesCurrentAppClock` (0.001s)
- PASS `benchmarkAmbiguousGrowthWeightUnitAsksInsteadOfPendingDraft` (0.001s)
- PASS `benchmarkPlannerKeepsWebSearchFallbackWhenModelReturnsEmptyTools` (0.006s)
- PASS `benchmarkMilkIntervalReminderOverridesBadModelOutputAndSuppressesMemory` (0.001s)
- PASS `benchmarkReadOnlyReminderListDoesNotAppendReminderCreationAsk` (0.002s)
- PASS `benchmarkOutOfRangeGrowthMeasurementAsksInsteadOfPendingDraft` (0.002s)
- PASS `benchmarkEightImageExpenseSkillBatchesWithoutWebSearch` (0.006s)
- PASS `benchmarkDailySummaryAiHappyPathAllSixFindingTypesPassValidator` (0.003s)
- PASS `benchmarkFeedingStartWithoutAmountAsksInsteadOfWriting` (0.003s)
- PASS `benchmarkGrowthMeasurementHistoryUpdateStaysBoundaryOnly` (0.001s)
- PASS `benchmarkPrivateReminderShareBoundaryDoesNotPromiseSyncOrAskTime` (0.002s)
- PASS `benchmarkOnceMilkReminderDoesNotAskCareRecordFields` (0.001s)
- PASS `benchmarkRecognizedExpenseAmountDoesNotBecomeRedundantAmountAsk` (0.0s)
