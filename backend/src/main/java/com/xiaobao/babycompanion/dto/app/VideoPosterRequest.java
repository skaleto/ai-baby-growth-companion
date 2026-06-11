package com.xiaobao.babycompanion.dto.app;

/** 客户端抽帧回传:为缺封面的视频补一张服务端缩略图(自愈式回填)。 */
public record VideoPosterRequest(String thumbnailDataUrl) {
}
