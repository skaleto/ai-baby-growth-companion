package com.xiaobao.babycompanion.controller;

import com.xiaobao.babycompanion.auth.AuthPrincipal;
import com.xiaobao.babycompanion.auth.CurrentUser;
import com.xiaobao.babycompanion.dto.pro.AiUsageSummaryDto;
import com.xiaobao.babycompanion.dto.pro.DailySummaryDto;
import com.xiaobao.babycompanion.dto.pro.DailySummarySettingsDto;
import com.xiaobao.babycompanion.dto.pro.GenerateDailySummaryRequest;
import com.xiaobao.babycompanion.dto.pro.ProTrialApplicationRequest;
import com.xiaobao.babycompanion.dto.pro.ProTrialStatusDto;
import com.xiaobao.babycompanion.dto.pro.UpdateDailySummarySettingsRequest;
import com.xiaobao.babycompanion.service.AiUsageLogService;
import com.xiaobao.babycompanion.service.DailySummaryService;
import com.xiaobao.babycompanion.service.ProTrialService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/pro")
public class ProTrialController {

    private final ProTrialService proTrialService;
    private final DailySummaryService dailySummaryService;
    private final AiUsageLogService aiUsageLogService;
    private final CurrentUser currentUser;

    public ProTrialController(
            ProTrialService proTrialService,
            DailySummaryService dailySummaryService,
            AiUsageLogService aiUsageLogService,
            CurrentUser currentUser
    ) {
        this.proTrialService = proTrialService;
        this.dailySummaryService = dailySummaryService;
        this.aiUsageLogService = aiUsageLogService;
        this.currentUser = currentUser;
    }

    @GetMapping("/trial/status")
    public ProTrialStatusDto status() {
        return proTrialService.currentStatus();
    }

    @PostMapping("/trial/apply")
    public ProTrialStatusDto apply(@RequestBody(required = false) ProTrialApplicationRequest request) {
        return proTrialService.submitApplication(request == null ? null : request.source());
    }

    @GetMapping("/usage")
    public AiUsageSummaryDto usage(@RequestParam(required = false) Integer days) {
        AuthPrincipal principal = currentUser.requirePrincipal();
        return aiUsageLogService.summary(principal.familyId(), days);
    }

    @GetMapping("/daily-summary")
    public DailySummaryDto dailySummary(@RequestParam(required = false) String date) {
        return dailySummaryService.readCurrent(date);
    }

    @PostMapping("/daily-summary/generate")
    public DailySummaryDto generateDailySummary(@RequestBody(required = false) GenerateDailySummaryRequest request) {
        return dailySummaryService.generate(request == null ? null : request.date());
    }

    @GetMapping("/daily-summary/settings")
    public DailySummarySettingsDto dailySummarySettings() {
        return proTrialService.currentSummarySettings();
    }

    @PutMapping("/daily-summary/settings")
    public DailySummarySettingsDto updateDailySummarySettings(@RequestBody UpdateDailySummarySettingsRequest request) {
        return proTrialService.updateSummarySettings(request);
    }
}
