package com.xiaobao.babycompanion.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;

import java.util.List;

import com.xiaobao.babycompanion.auth.AuthPrincipal;
import com.xiaobao.babycompanion.auth.CurrentUser;
import com.xiaobao.babycompanion.dto.pro.DailySummaryDto;
import com.xiaobao.babycompanion.dto.pro.FindingDto;
import com.xiaobao.babycompanion.dto.pro.FindingRelated;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

@SpringBootTest
class DailySummaryServiceAiTests {

    @Autowired DailySummaryService service;
    @MockBean DailySummaryAiClient aiClient;
    @MockBean ProTrialService proTrialService;
    @MockBean CurrentUser currentUser;
    @Autowired com.xiaobao.babycompanion.persistence.service.CareLogRecordService careLogService;
    @Autowired com.xiaobao.babycompanion.persistence.service.ExpenseItemRecordService expenseService;
    @Autowired com.xiaobao.babycompanion.persistence.service.AlbumItemRecordService albumService;

    private String familyId;
    private static final String USER_ID = "user-1";

    @BeforeEach
    void setup() {
        familyId = "family-ai-" + System.nanoTime();
        AuthPrincipal principal = new AuthPrincipal(USER_ID, "13800000001", "session-1", familyId, "测试家庭", "妈妈", true);
        when(currentUser.requirePrincipal()).thenReturn(principal);
        doNothing().when(proTrialService).requireProCaregiver(anyString());
    }

    @Test
    void appendsAiFindingsToSummary() throws Exception {
        seedFixture(familyId);

        FindingDto fake = new FindingDto(
                "family_action_continuity",
                "妈妈下午用白噪音哄睡了 25 分钟",
                FindingRelated.empty(),
                null
        );
        when(aiClient.call(anyString())).thenReturn(List.of(fake));

        DailySummaryDto result = service.generate(today());

        assertNotNull(result);
        assertEquals(1, result.findings().size());
        assertEquals("family_action_continuity", result.findings().get(0).type());
        assertFalse(result.facts().isEmpty(), "deterministic facts must remain");
    }

    @Test
    void emptyFindingsWhenAiThrows() throws Exception {
        seedFixture(familyId);

        when(aiClient.call(anyString())).thenThrow(
                new DailySummaryAiClient.DailySummaryAiException("simulated timeout"));

        DailySummaryDto result = service.generate(today());

        assertNotNull(result);
        assertTrue(result.findings().isEmpty(), "fallback should produce empty findings list");
        assertNotNull(result.text(), "deterministic text must still be produced");
    }

    @Test
    void skipsAiWhenDataTooSparse() throws Exception {
        // Do NOT seed any data; data count < 3 threshold
        DailySummaryDto result = service.generate(today());

        assertNotNull(result);
        assertTrue(result.findings().isEmpty(), "sparse data should skip AI call entirely");
    }

    private String today() {
        return java.time.LocalDate.now().toString();
    }

    private void seedFixture(String familyId) {
        String date = today();
        com.xiaobao.babycompanion.persistence.entity.CareLogRecord care =
                new com.xiaobao.babycompanion.persistence.entity.CareLogRecord();
        care.setId("seed-care-" + familyId);
        care.setFamilyId(familyId);
        care.setSortKey(date);
        care.setPayloadJson(String.format(
                "{\"id\":\"%s\",\"date\":\"%s\",\"milkMl\":580,\"milkTimes\":5,\"sleepHours\":14.0,\"events\":[]}",
                care.getId(), date));
        careLogService.save(care);

        com.xiaobao.babycompanion.persistence.entity.ExpenseItemRecord exp =
                new com.xiaobao.babycompanion.persistence.entity.ExpenseItemRecord();
        exp.setId("seed-exp-" + familyId);
        exp.setFamilyId(familyId);
        exp.setSortKey(date);
        exp.setPayloadJson(String.format(
                "{\"id\":\"%s\",\"date\":\"%s\",\"title\":\"飞鹤1段奶粉\",\"amount\":268.0,\"category\":\"formula\"}",
                exp.getId(), date));
        expenseService.save(exp);

        com.xiaobao.babycompanion.persistence.entity.AlbumItemRecord alb =
                new com.xiaobao.babycompanion.persistence.entity.AlbumItemRecord();
        alb.setId("seed-alb-" + familyId);
        alb.setFamilyId(familyId);
        alb.setSortKey(date);
        alb.setPayloadJson(String.format(
                "{\"id\":\"%s\",\"date\":\"%s\",\"category\":\"growth\",\"title\":\"宝宝抓拍\"}",
                alb.getId(), date));
        albumService.save(alb);
    }
}
