package com.xiaobao.babycompanion.agent;

import java.util.List;
import java.util.Map;

record VisualAnalysisResult(
        int batchIndex,
        int batchCount,
        int visualCount,
        List<Map<String, String>> attachments,
        String summary
) {
}
