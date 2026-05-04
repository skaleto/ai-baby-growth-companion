package com.xiaobao.babycompanion.agent;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class SafetyGuardTests {

    private final SafetyGuard guard = new SafetyGuard();

    @Test
    void flagsUrgentFeverAndBreathingRisk() {
        var alerts = guard.assess("宝宝体温 39.2 度，还有点喘不过气", "请尽快就医。");

        assertThat(alerts).extracting("category").contains("fever", "breathing");
        assertThat(alerts).extracting("level").contains("urgent");
    }

    @Test
    void flagsMedicineVaccineAndAllergyAsNotice() {
        var alerts = guard.assess("能不能吃退烧药，疫苗后起疹子了", "请咨询医生。");

        assertThat(alerts).extracting("category").contains("medicine", "vaccine", "allergy");
        assertThat(alerts).allMatch((alert) -> alert.level().equals("notice"));
    }
}
