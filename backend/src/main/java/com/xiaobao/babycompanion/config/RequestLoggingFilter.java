package com.xiaobao.babycompanion.config;

import com.xiaobao.babycompanion.auth.AuthPrincipal;
import com.xiaobao.babycompanion.util.PhoneMasking;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

public class RequestLoggingFilter extends OncePerRequestFilter {

    public static final String REQUEST_ID_HEADER = "X-Request-Id";

    private static final Logger LOGGER = LoggerFactory.getLogger(RequestLoggingFilter.class);

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return "OPTIONS".equalsIgnoreCase(request.getMethod());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String requestId = requestId(request);
        long startedAt = System.nanoTime();
        response.setHeader(REQUEST_ID_HEADER, requestId);
        MDC.put("requestId", requestId);
        try {
            filterChain.doFilter(request, response);
        } finally {
            logCompletion(request, response, requestId, startedAt);
            MDC.remove("requestId");
        }
    }

    private String requestId(HttpServletRequest request) {
        String header = request.getHeader(REQUEST_ID_HEADER);
        if (StringUtils.hasText(header)) return header.trim();
        return "server-" + UUID.randomUUID();
    }

    private void logCompletion(
            HttpServletRequest request,
            HttpServletResponse response,
            String requestId,
            long startedAt
    ) {
        int status = response.getStatus();
        long durationMs = (System.nanoTime() - startedAt) / 1_000_000;
        AuthPrincipal principal = principal();
        String userId = principal == null ? "-" : principal.userId();
        String phone = principal == null ? "-" : PhoneMasking.mask(principal.phone());
        String familyId = principal == null ? "-" : principal.familyId();
        if (status >= 500) {
            LOGGER.error(
                    "HTTP request completed requestId={} method={} path={} status={} durationMs={} userId={} phone={} familyId={}",
                    requestId,
                    request.getMethod(),
                    request.getRequestURI(),
                    status,
                    durationMs,
                    userId,
                    phone,
                    familyId
            );
        } else if (status >= 400) {
            LOGGER.warn(
                    "HTTP request completed requestId={} method={} path={} status={} durationMs={} userId={} phone={} familyId={}",
                    requestId,
                    request.getMethod(),
                    request.getRequestURI(),
                    status,
                    durationMs,
                    userId,
                    phone,
                    familyId
            );
        } else {
            LOGGER.info(
                    "HTTP request completed requestId={} method={} path={} status={} durationMs={} userId={} phone={} familyId={}",
                    requestId,
                    request.getMethod(),
                    request.getRequestURI(),
                    status,
                    durationMs,
                    userId,
                    phone,
                    familyId
            );
        }
    }

    private AuthPrincipal principal() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthPrincipal principal)) {
            return null;
        }
        return principal;
    }
}
