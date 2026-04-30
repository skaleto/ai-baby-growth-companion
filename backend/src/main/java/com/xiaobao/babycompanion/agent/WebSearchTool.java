package com.xiaobao.babycompanion.agent;

import java.net.URI;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaobao.babycompanion.dto.agent.AgentChatRequest;
import com.xiaobao.babycompanion.dto.agent.AgentSource;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekTool;
import com.xiaobao.babycompanion.service.deepseek.DeepSeekToolFunction;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.util.HtmlUtils;

@Component
public class WebSearchTool implements AgentTool {

    private static final Pattern RESULT_PATTERN = Pattern.compile(
            "<a[^>]*class=\"result__a\"[^>]*href=\"([^\"]+)\"[^>]*>(.*?)</a>.*?"
                    + "<a[^>]*class=\"result__snippet\"[^>]*>(.*?)</a>",
            Pattern.CASE_INSENSITIVE | Pattern.DOTALL
    );
    private static final int MAX_RESULTS = 5;

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public WebSearchTool(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    @Override
    public String id() {
        return "web_search";
    }

    @Override
    public String displayName() {
        return "联网查询";
    }

    @Override
    public String runningMessage() {
        return "正在联网查询";
    }

    @Override
    public DeepSeekTool definition() {
        Map<String, Object> parameters = Map.of(
                "type", "object",
                "properties", Map.of(
                        "query", Map.of(
                                "type", "string",
                                "description", "用于搜索引擎的查询词，保留城市、时间、政策或机构名称等关键信息。"
                        ),
                        "purpose", Map.of(
                                "type", "string",
                                "description", "为什么需要联网查询，例如查询最新政策、官方办事信息或实时资料。"
                        )
                ),
                "required", List.of("query"),
                "additionalProperties", false
        );
        return new DeepSeekTool(
                "function",
                new DeepSeekToolFunction(
                        id(),
                        "查询互联网上的公开信息。适合用户询问最新政策、地点相关规定、时效性资料、官方通知或当前信息时使用。",
                        parameters,
                        null
                )
        );
    }

    @Override
    public AgentToolResult execute(AgentToolCall call, AgentChatRequest request) {
        WebSearchArguments arguments = parseArguments(call.arguments(), request.message());
        String query = StringUtils.hasText(arguments.query()) ? arguments.query().trim() : request.message();
        List<AgentSource> sources = search(query);

        StringBuilder content = new StringBuilder("联网查询结果\n查询词: ").append(query).append("\n");
        if (sources.isEmpty()) {
            content.append("未检索到可用结果。请明确告知用户查询失败或建议以官方渠道为准。");
        } else {
            for (int index = 0; index < sources.size(); index += 1) {
                AgentSource source = sources.get(index);
                content.append(index + 1)
                        .append(". ")
                        .append(source.title())
                        .append("\nURL: ")
                        .append(source.url())
                        .append("\n摘要: ")
                        .append(source.snippet())
                        .append("\n");
            }
        }

        return new AgentToolResult(call.id(), id(), displayName(), query, content.toString(), sources);
    }

    private WebSearchArguments parseArguments(String rawArguments, String fallbackQuery) {
        if (!StringUtils.hasText(rawArguments)) {
            return new WebSearchArguments(fallbackQuery, "");
        }
        try {
            WebSearchArguments arguments = objectMapper.readValue(rawArguments, WebSearchArguments.class);
            if (StringUtils.hasText(arguments.query())) return arguments;
        } catch (JsonProcessingException ignored) {
            // Fall through to using the original user message as a safe query.
        }
        return new WebSearchArguments(fallbackQuery, "");
    }

    private List<AgentSource> search(String query) {
        String encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8);
        URI uri = URI.create("https://duckduckgo.com/html/?kl=cn-zh&q=" + encodedQuery);
        HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofSeconds(12))
                .header("User-Agent", "Mozilla/5.0")
                .header("Accept", "text/html,application/xhtml+xml")
                .GET()
                .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("搜索服务返回状态码 " + response.statusCode());
            }
            return parseResults(response.body());
        } catch (Exception exception) {
            throw new IllegalStateException("联网查询失败：" + exception.getMessage(), exception);
        }
    }

    List<AgentSource> parseResults(String html) {
        List<AgentSource> sources = new ArrayList<>();
        Set<String> seenUrls = new LinkedHashSet<>();
        Matcher matcher = RESULT_PATTERN.matcher(html);

        while (matcher.find() && sources.size() < MAX_RESULTS) {
            String url = normalizeUrl(matcher.group(1));
            if (!StringUtils.hasText(url) || !seenUrls.add(url)) continue;

            String title = cleanText(matcher.group(2));
            String snippet = cleanText(matcher.group(3));
            if (!StringUtils.hasText(title) || !StringUtils.hasText(snippet)) continue;

            sources.add(new AgentSource(title, url, snippet));
        }

        return sources;
    }

    private String normalizeUrl(String rawUrl) {
        String url = HtmlUtils.htmlUnescape(rawUrl).trim();
        if (url.startsWith("//")) {
            url = "https:" + url;
        }
        try {
            URI uri = URI.create(url);
            if (uri.getHost() != null && uri.getHost().contains("duckduckgo.com") && uri.getRawQuery() != null) {
                for (String item : uri.getRawQuery().split("&")) {
                    int separator = item.indexOf('=');
                    if (separator > 0 && "uddg".equals(item.substring(0, separator))) {
                        return URLDecoder.decode(item.substring(separator + 1), StandardCharsets.UTF_8);
                    }
                }
            }
        } catch (IllegalArgumentException ignored) {
            return url;
        }
        return url;
    }

    private String cleanText(String html) {
        String withoutTags = html.replaceAll("<[^>]+>", " ");
        return HtmlUtils.htmlUnescape(withoutTags).replaceAll("\\s+", " ").trim();
    }

    private record WebSearchArguments(
            String query,
            String purpose
    ) {
    }
}
