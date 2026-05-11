package com.xiaobao.babycompanion.service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.xiaobao.babycompanion.config.ProductLookupProperties;
import com.xiaobao.babycompanion.dto.product.ProductCandidateDto;
import com.xiaobao.babycompanion.dto.product.ProductLookupResponse;
import com.xiaobao.babycompanion.persistence.entity.ProductLookupCacheRecord;
import com.xiaobao.babycompanion.persistence.service.ProductLookupCacheRecordService;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class ProductLookupService {

    private final ProductLookupProperties properties;
    private final ProductLookupCacheRecordService cacheService;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public ProductLookupService(
            ProductLookupProperties properties,
            ProductLookupCacheRecordService cacheService,
            ObjectMapper objectMapper
    ) {
        this.properties = properties;
        this.cacheService = cacheService;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(properties.getConnectTimeout())
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    public ProductLookupResponse lookup(String rawBarcode) {
        String barcode = normalizeBarcode(rawBarcode);
        ProductLookupCacheRecord cached = cacheService.getById(barcode);
        if (cached != null && StringUtils.hasText(cached.getPayloadJson())) {
            ProductLookupResponse response = parseResponse(cached.getPayloadJson());
            return new ProductLookupResponse(response.barcode(), true, response.candidates(), response.message());
        }

        List<ProductCandidateDto> candidates = new ArrayList<>();
        List<String> errors = new ArrayList<>();
        if (properties.isFreeEnabled()) {
            try {
                candidates.addAll(openFoodFacts(barcode));
            } catch (Exception exception) {
                errors.add("Open Food Facts 查询失败");
            }
            if (candidates.isEmpty()) {
                try {
                    candidates.addAll(upcItemDb(barcode));
                } catch (Exception exception) {
                    errors.add("UPCitemdb 查询失败");
                }
            }
        }

        List<ProductCandidateDto> deduped = dedupe(candidates).stream().limit(5).toList();
        String message = deduped.isEmpty()
                ? (errors.isEmpty() ? "暂未查到商品信息，可以手动填写或让 AI 联网搜索候选。" : String.join("；", errors))
                : "已找到商品候选，请确认后填写实际支付价格。";
        ProductLookupResponse response = new ProductLookupResponse(barcode, false, deduped, message);
        saveCache(barcode, response);
        return response;
    }

    private String normalizeBarcode(String rawBarcode) {
        String barcode = rawBarcode == null ? "" : rawBarcode.replaceAll("[^0-9A-Za-z]", "").trim();
        if (barcode.length() < 6 || barcode.length() > 32) {
            throw new IllegalArgumentException("条形码格式不正确");
        }
        return barcode;
    }

    private List<ProductCandidateDto> openFoodFacts(String barcode) throws Exception {
        String url = "https://world.openfoodfacts.org/api/v2/product/%s.json?fields=product_name,brands,quantity,image_front_url,categories,categories_tags,url"
                .formatted(URLEncoder.encode(barcode, StandardCharsets.UTF_8));
        JsonNode root = fetchJson(url);
        if (root.path("status").asInt(0) != 1) return List.of();
        JsonNode product = root.path("product");
        String title = firstText(product, "product_name", "generic_name");
        if (!StringUtils.hasText(title)) return List.of();
        return List.of(new ProductCandidateDto(
                "off-" + barcode,
                barcode,
                title,
                text(product, "brands"),
                text(product, "quantity"),
                categoryFromText(text(product, "categories") + " " + text(product, "categories_tags")),
                text(product, "image_front_url"),
                "Open Food Facts",
                0.76,
                text(product, "url")
        ));
    }

    private List<ProductCandidateDto> upcItemDb(String barcode) throws Exception {
        String url = "https://api.upcitemdb.com/prod/trial/lookup?upc=%s"
                .formatted(URLEncoder.encode(barcode, StandardCharsets.UTF_8));
        JsonNode root = fetchJson(url);
        if (!"OK".equalsIgnoreCase(root.path("code").asText())) return List.of();
        List<ProductCandidateDto> candidates = new ArrayList<>();
        JsonNode items = root.path("items");
        if (!items.isArray()) return candidates;
        int index = 0;
        for (JsonNode item : items) {
            String title = text(item, "title");
            if (!StringUtils.hasText(title)) continue;
            candidates.add(new ProductCandidateDto(
                    "upc-" + barcode + "-" + index,
                    barcode,
                    title,
                    text(item, "brand"),
                    firstText(item, "size", "description"),
                    categoryFromText(title + " " + text(item, "category") + " " + text(item, "description")),
                    firstImage(item.path("images")),
                    "UPCitemdb",
                    0.64,
                    text(item, "detailPageURL")
            ));
            index += 1;
        }
        return candidates;
    }

    private JsonNode fetchJson(String url) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(properties.getReadTimeout())
                .header("Accept", "application/json")
                .header("User-Agent", "ai-baby-growth-companion/0.1 product lookup")
                .GET()
                .build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("商品查询服务返回状态码 " + response.statusCode());
        }
        return objectMapper.readTree(response.body());
    }

    private List<ProductCandidateDto> dedupe(List<ProductCandidateDto> candidates) {
        Map<String, ProductCandidateDto> byKey = new LinkedHashMap<>();
        for (ProductCandidateDto candidate : candidates) {
            String key = (candidate.title() + "|" + candidate.brand() + "|" + candidate.spec()).toLowerCase(Locale.ROOT);
            byKey.putIfAbsent(key, candidate);
        }
        return new ArrayList<>(byKey.values());
    }

    private void saveCache(String barcode, ProductLookupResponse response) {
        ProductLookupCacheRecord record = new ProductLookupCacheRecord();
        record.setId(barcode);
        record.setPayloadJson(write(response));
        record.setRole("product");
        record.setStatus(response.candidates().isEmpty() ? "miss" : "hit");
        record.setSortKey(barcode);
        record.setCreatedAt(Instant.now().toString());
        record.setUpdatedAt(Instant.now().toString());
        cacheService.saveOrUpdate(record);
    }

    private ProductLookupResponse parseResponse(String json) {
        try {
            return objectMapper.readValue(json, ProductLookupResponse.class);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("商品缓存解析失败", exception);
        }
    }

    private String write(ProductLookupResponse response) {
        try {
            return objectMapper.writeValueAsString(response);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("商品缓存写入失败", exception);
        }
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value != null && value.isTextual() ? value.asText("").trim() : "";
    }

    private String firstText(JsonNode node, String... fields) {
        for (String field : fields) {
            String value = text(node, field);
            if (StringUtils.hasText(value)) return value;
        }
        return "";
    }

    private String firstImage(JsonNode images) {
        if (!images.isArray() || images.isEmpty()) return "";
        JsonNode first = images.get(0);
        return first != null && first.isTextual() ? first.asText("") : "";
    }

    private String categoryFromText(String raw) {
        String text = raw == null ? "" : raw.toLowerCase(Locale.ROOT);
        if (containsAny(text, "奶粉", "formula", "milk powder", "婴儿奶")) return "formula";
        if (containsAny(text, "尿裤", "纸尿裤", "diaper", "nappy")) return "diaper";
        if (containsAny(text, "辅食", "米粉", "baby food", "cereal", "snack")) return "food";
        if (containsAny(text, "衣", "服", "clothing", "bodysuit")) return "clothing";
        if (containsAny(text, "玩具", "toy")) return "toy";
        if (containsAny(text, "药", "medicine", "health", "体温", "护理")) return "health";
        if (containsAny(text, "湿巾", "洗护", "soap", "wipe", "日用")) return "daily";
        return "other";
    }

    private boolean containsAny(String text, String... needles) {
        for (String needle : needles) {
            if (text.contains(needle)) return true;
        }
        return false;
    }
}
