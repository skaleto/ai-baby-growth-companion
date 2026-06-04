package com.xiaobao.babycompanion.agent;

public record MemorySignal(
        String text,
        String category,
        double confidence
) {
}
