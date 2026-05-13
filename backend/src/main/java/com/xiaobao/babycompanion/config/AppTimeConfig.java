package com.xiaobao.babycompanion.config;

import java.time.Clock;
import java.time.DateTimeException;
import java.time.ZoneId;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

@Configuration
@EnableConfigurationProperties(AppTimeProperties.class)
public class AppTimeConfig {

    private static final String DEFAULT_TIME_ZONE = "Asia/Shanghai";

    @Bean
    public ZoneId appZoneId(AppTimeProperties properties) {
        String configured = StringUtils.hasText(properties.getTimeZone())
                ? properties.getTimeZone().trim()
                : DEFAULT_TIME_ZONE;
        try {
            return ZoneId.of(configured);
        } catch (DateTimeException exception) {
            throw new IllegalArgumentException("Invalid app.time-zone: " + configured, exception);
        }
    }

    @Bean
    public Clock appClock(ZoneId appZoneId) {
        return Clock.system(appZoneId);
    }
}
