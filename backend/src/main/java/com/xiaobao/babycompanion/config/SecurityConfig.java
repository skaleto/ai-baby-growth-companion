package com.xiaobao.babycompanion.config;

import com.xiaobao.babycompanion.auth.AuthTokenFilter;
import jakarta.servlet.DispatcherType;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaobao.babycompanion.dto.ErrorResponse;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final AuthTokenFilter authTokenFilter;
    private final ObjectMapper objectMapper;

    public SecurityConfig(AuthTokenFilter authTokenFilter, ObjectMapper objectMapper) {
        this.authTokenFilter = authTokenFilter;
        this.objectMapper = objectMapper;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
                .csrf((csrf) -> csrf.disable())
                .cors((cors) -> {})
                .sessionManagement((session) -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling((exceptions) -> exceptions.authenticationEntryPoint((request, response, authException) -> {
                    response.setStatus(401);
                    response.setCharacterEncoding(StandardCharsets.UTF_8.name());
                    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                    objectMapper.writeValue(response.getWriter(), new ErrorResponse("AUTH_REQUIRED", "请先登录。", Instant.now()));
                }))
                .authorizeHttpRequests((requests) -> requests
                        .dispatcherTypeMatchers(DispatcherType.ASYNC, DispatcherType.ERROR).permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/auth/invite/roles").permitAll()
                        .requestMatchers("/api/asr/stream").permitAll()
                        .requestMatchers("/api/health").permitAll()
                        .requestMatchers("/api/mobile-updates/**").permitAll()
                        .anyRequest().authenticated()
                )
                .addFilterBefore(requestLoggingFilter(), UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(authTokenFilter, RequestLoggingFilter.class)
                .build();
    }

    @Bean
    public RequestLoggingFilter requestLoggingFilter() {
        return new RequestLoggingFilter();
    }

    @Bean
    public FilterRegistrationBean<RequestLoggingFilter> requestLoggingFilterRegistration(RequestLoggingFilter filter) {
        FilterRegistrationBean<RequestLoggingFilter> registration = new FilterRegistrationBean<>(filter);
        registration.setEnabled(false);
        return registration;
    }

    @Bean
    public UserDetailsService userDetailsService() {
        return (username) -> {
            throw new UsernameNotFoundException("Password login is not supported");
        };
    }
}
