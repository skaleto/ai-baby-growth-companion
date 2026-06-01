package com.xiaobao.babycompanion.dto.agent;

import java.util.List;

import jakarta.validation.constraints.Size;

public record AgentBabyProfile(
        @Size(max = 50, message = "nickname must be at most 50 characters")
        String nickname,

        @Size(max = 20, message = "stage must be at most 20 characters")
        String stage,

        @Size(max = 10, message = "gender must be at most 10 characters")
        String gender,

        @Size(max = 30, message = "expectedDate must be at most 30 characters")
        String expectedDate,

        @Size(max = 30, message = "birthDate must be at most 30 characters")
        String birthDate,

        @Size(max = 80, message = "region must be at most 80 characters")
        String region,

        @Size(max = 80, message = "feeding must be at most 80 characters")
        String feeding,

        Double birthWeight,

        Double birthHeight,

        Integer ageDays,

        Integer ageWeeks,

        Integer ageMonths,

        @Size(max = 120, message = "ageLabel must be at most 120 characters")
        String ageLabel,

        Boolean fullMonth,

        Integer daysUntilFullMonth,

        @Size(max = 20, message = "allergies must include at most 20 items")
        List<@Size(max = 80, message = "allergy must be at most 80 characters") String> allergies,

        @Size(max = 20, message = "caregivers must include at most 20 items")
        List<@Size(max = 80, message = "caregiver must be at most 80 characters") String> caregivers
) {
}
