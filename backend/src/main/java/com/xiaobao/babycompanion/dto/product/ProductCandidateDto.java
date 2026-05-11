package com.xiaobao.babycompanion.dto.product;

public record ProductCandidateDto(
        String id,
        String barcode,
        String title,
        String brand,
        String spec,
        String category,
        String imageUrl,
        String source,
        Double confidence,
        String url
) {
}
