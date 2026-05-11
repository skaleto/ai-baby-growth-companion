package com.xiaobao.babycompanion.dto.product;

import java.util.List;

public record ProductLookupResponse(
        String barcode,
        boolean fromCache,
        List<ProductCandidateDto> candidates,
        String message
) {
}
