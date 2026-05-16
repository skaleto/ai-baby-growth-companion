package com.xiaobao.babycompanion.agent;

import com.xiaobao.babycompanion.service.deepseek.DeepSeekChatRequest;

@FunctionalInterface
interface ExpenseRecognitionModelClient {
    ExpenseRecognitionModelResponse call(DeepSeekChatRequest request, int batchNumber, int batchCount);
}
