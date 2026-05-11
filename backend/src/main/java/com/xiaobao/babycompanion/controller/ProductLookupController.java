package com.xiaobao.babycompanion.controller;

import com.xiaobao.babycompanion.dto.product.ProductLookupResponse;
import com.xiaobao.babycompanion.service.ProductLookupService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/products")
public class ProductLookupController {

    private final ProductLookupService productLookupService;

    public ProductLookupController(ProductLookupService productLookupService) {
        this.productLookupService = productLookupService;
    }

    @GetMapping("/barcode/{barcode}")
    public ProductLookupResponse lookupBarcode(@PathVariable String barcode) {
        return productLookupService.lookup(barcode);
    }
}
