package com.xiaobao.babycompanion.dto.app;

public record AppStateResponse(
        boolean empty,
        AppStateDto state
) {
}
