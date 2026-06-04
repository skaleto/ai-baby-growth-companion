package com.xiaobao.babycompanion.auth;

import java.io.IOException;
import java.time.Instant;
import java.util.List;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiaobao.babycompanion.dto.ErrorResponse;
import com.xiaobao.babycompanion.exception.AuthException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class AuthTokenFilter extends OncePerRequestFilter {

    private final AuthService authService;
    private final ObjectMapper objectMapper;

    public AuthTokenFilter(AuthService authService, ObjectMapper objectMapper) {
        this.authService = authService;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String token = bearerToken(request);
        if (StringUtils.hasText(token)) {
            try {
                AuthPrincipal principal = authService.authenticateToken(token);
                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(principal, token, List.of());
                SecurityContextHolder.getContext().setAuthentication(authentication);
            } catch (AuthException exception) {
                SecurityContextHolder.clearContext();
                writeUnauthorized(response, exception.getMessage());
                return;
            }
        }
        filterChain.doFilter(request, response);
    }

    /**
     * Paths that may authenticate via a {@code ?token=} query parameter because the browser cannot
     * attach an {@code Authorization} header to media loaded through {@code <img>}/{@code <video>}
     * {@code src} (attachment downloads and thumbnails under {@code /api/uploads/}).
     *
     * <p>REQ-AUTH-005 (R0.5): all other APIs accept the Bearer header only, so tokens never leak via
     * request URLs, access logs, or {@code Referer}.
     *
     * <p>TODO(REQ-AUTH-005 follow-up): replace this query-token fallback with short-lived signed URLs
     * for media downloads so the long-lived session token never appears in a URL at all.
     */
    private static final List<String> QUERY_TOKEN_PATH_PREFIXES = List.of("/api/uploads/");

    private String bearerToken(HttpServletRequest request) {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (StringUtils.hasText(header) && header.startsWith("Bearer ")) {
            return header.substring("Bearer ".length()).trim();
        }
        if (allowsQueryToken(request)) {
            String queryToken = request.getParameter("token");
            if (StringUtils.hasText(queryToken)) {
                return queryToken.trim();
            }
        }
        return "";
    }

    private boolean allowsQueryToken(HttpServletRequest request) {
        String path = request.getRequestURI();
        if (path == null) {
            return false;
        }
        for (String prefix : QUERY_TOKEN_PATH_PREFIXES) {
            if (path.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }

    private void writeUnauthorized(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getWriter(), new ErrorResponse("AUTH_FAILED", message, Instant.now()));
    }
}
