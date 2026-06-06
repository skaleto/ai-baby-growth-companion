# Agent Benchmark Results

Generated at: 2026-06-06T16:36:39.493Z

## Command

```bash
npm run test:agent-benchmark
```

## Summary

- Status: PASS
- Tests: 49
- Failures: 0
- Errors: 0
- Skipped: 0
- Time: 0.75s

## Cases

- PASS `benchmarkCompleteMixedFeedingRecordAutoWritesCareLog` (0.136s)
- PASS `benchmarkGenericCareQuestionSuppressesModelMemoryCandidate` (0.002s)
- PASS `benchmarkGenericIntervalDefaultsToNotificationUnlessRingingRequested` (0.004s)
- PASS `benchmarkDailySummaryFallbackOnModelExceptionYieldsEmptyFindings` (0.002s)
- PASS `benchmarkEmbeddedQuestionWithConcreteMilkRecordStillAutoWritesCareLog` (0.005s)
- PASS `benchmarkVagueReminderAsksEvenWhenModelOmitsReminderDto` (0.002s)
- PASS `benchmarkExplicitPreferenceAndCaregiverMemoriesBecomePendingDrafts` (0.002s)
- PASS `benchmarkExplicitHealthMemoryBecomesPendingDraft` (0.001s)
- PASS `benchmarkDailySummaryMissingItemsUseGentleNonTechnicalCopy` (0.001s)
- PASS `benchmarkGrowthMeasurementHistoryDeleteStaysBoundaryOnly` (0.002s)
- PASS `benchmarkModelContextHarnessCoversSystemicRuleFamilies` (0.006s)
- PASS `benchmarkAgentPromptIncludesCaregiverSupportAndHighRiskBoundaries` (0.0s)
- PASS `benchmarkSharedDailySummaryContractExcludesPrivateAccountCopy` (0.001s)
- PASS `benchmarkExpenseCreatesPendingDraftButBarcodePriceQueryDoesNotRecord` (0.004s)
- PASS `benchmarkProfileUpdateRequestIsBoundaryOnly` (0.001s)
- PASS `benchmarkExpenseImageRecognitionDoesNotUseWebSearch` (0.003s)
- PASS `benchmarkSkillDisclosureOnlyLoadsCareGuideWhenNeeded` (0.004s)
- PASS `benchmarkVagueReminderAsksForNaturalTimeOnly` (0.004s)
- PASS `benchmarkPreviousImageRetryRoutesIntoExpenseSkill` (0.004s)
- PASS `benchmarkPreviousImageRetryDoesNotDependOnFrontendAttachmentForwarding` (0.004s)
- PASS `benchmarkPlainTwelveNearMidnightUsesMidnightInsteadOfNoon` (0.002s)
- PASS `benchmarkDuplicateGrowthMeasurementAsksWithoutPendingDraft` (0.002s)
- PASS `benchmarkExpenseSkillDoesNotAskCategoryOnlyClarification` (0.028s)
- PASS `benchmarkGrowthMeasurementsBecomePendingDrafts` (0.002s)
- PASS `benchmarkSleepDurationAutoWritesAndSleepStartAsks` (0.006s)
- PASS `benchmarkDuplicateGrowthMeasurementReplyDoesNotInviteDuplicateRecord` (0.149s)
- PASS `benchmarkOneImageExpenseSkillCreatesPendingDraft` (0.002s)
- PASS `benchmarkHighRiskFeverStaysPending` (0.004s)
- PASS `benchmarkUnsupportedChatMutationIsBoundaryOnly` (0.001s)
- PASS `benchmarkReadOnlyWeeklySummaryDoesNotAppendCareLogAsk` (0.003s)
- PASS `benchmarkMedicineAndVaccineRemindersStayPending` (0.004s)
- PASS `benchmarkReadOnlyDailySummaryDoesNotAppendCareLogAsk` (0.002s)
- PASS `benchmarkSavedExpenseRecognitionDoesNotBecomeConfirmAgainAsk` (0.0s)
- PASS `benchmarkTwelveHourFeedingTimeUsesCurrentAppClock` (0.001s)
- PASS `benchmarkAmbiguousGrowthWeightUnitAsksInsteadOfPendingDraft` (0.0s)
- PASS `benchmarkPlannerKeepsWebSearchFallbackWhenModelReturnsEmptyTools` (0.007s)
- PASS `benchmarkMilkIntervalReminderOverridesBadModelOutputAndSuppressesMemory` (0.001s)
- PASS `benchmarkReadOnlyReminderListDoesNotAppendReminderCreationAsk` (0.003s)
- PASS `benchmarkOutOfRangeGrowthMeasurementAsksInsteadOfPendingDraft` (0.002s)
- PASS `benchmarkEightImageExpenseSkillBatchesWithoutWebSearch` (0.005s)
- PASS `benchmarkDailySummaryAiHappyPathAllSixFindingTypesPassValidator` (0.003s)
- PASS `benchmarkFeedingStartWithoutAmountAsksInsteadOfWriting` (0.003s)
- PASS `benchmarkGrowthMeasurementHistoryUpdateStaysBoundaryOnly` (0.001s)
- PASS `benchmarkPrivateReminderShareBoundaryDoesNotPromiseSyncOrAskTime` (0.002s)
- PASS `benchmarkOnceMilkReminderDoesNotAskCareRecordFields` (0.003s)
- PASS `benchmarkModelContextHarnessCoversRecentMilkAndMidnightBadCases` (0.001s)
- PASS `benchmarkRecognizedExpenseAmountDoesNotBecomeRedundantAmountAsk` (0.001s)
- PASS `benchmarkReplayRecentGrowthMeasurementsBecomePendingDrafts` (0.002s)
- PASS `benchmarkNaturalGrowthMeasurementsWithContextDateBecomePendingDrafts` (0.001s)
