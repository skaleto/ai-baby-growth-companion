package com.xiaobao.babycompanion.agent;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaobao.babycompanion.dto.agent.AgentSource;
import org.junit.jupiter.api.Test;

class WebSearchToolTests {

    private final WebSearchTool tool = new WebSearchTool(new ObjectMapper());

    @Test
    void parsesDuckDuckGoHtmlResults() {
        List<AgentSource> sources = tool.parseResults(
                """
                        <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwsjkw.hangzhou.gov.cn%2Fpolicy&amp;rut=test">杭州政策</a>
                        <a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwsjkw.hangzhou.gov.cn%2Fpolicy&amp;rut=test">官方通知摘要</a>
                        """
        );

        assertThat(sources).hasSize(1);
        assertThat(sources.get(0).title()).isEqualTo("杭州政策");
        assertThat(sources.get(0).url()).isEqualTo("https://wsjkw.hangzhou.gov.cn/policy");
        assertThat(sources.get(0).snippet()).isEqualTo("官方通知摘要");
    }
}
