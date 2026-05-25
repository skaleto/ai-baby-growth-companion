package com.xiaobao.babycompanion.dto.pro;

public record FindingDto(
        String type,
        String text,
        FindingRelated related,
        FindingAction action
) {
}
