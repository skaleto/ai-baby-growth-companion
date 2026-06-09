package com.xiaobao.babycompanion.exception;

/**
 * 抛出时机：Free 家庭当月免费 AI 体验次数已用完，且未开通 Pro 内测权益。
 * 由 {@link com.xiaobao.babycompanion.exception.GlobalExceptionHandler} 映射为 403 + code=PRO_QUOTA_EXCEEDED，
 * 前端据此弹出「申请内测资格」引导（而非普通 403）。
 */
public class ProQuotaExceededException extends ForbiddenException {

    public ProQuotaExceededException(String message) {
        super(message);
    }
}
