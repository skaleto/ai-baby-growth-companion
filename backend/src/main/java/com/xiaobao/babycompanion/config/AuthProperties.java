package com.xiaobao.babycompanion.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "auth")
public class AuthProperties {

    private Jwt jwt = new Jwt();
    private String inviteCodesFile = "backend/data/auth/invite_codes";
    private int maxLoginAttempts = 8;
    private Duration loginWindow = Duration.ofMinutes(10);

    public Jwt getJwt() {
        return jwt;
    }

    public void setJwt(Jwt jwt) {
        this.jwt = jwt;
    }

    public String getInviteCodesFile() {
        return inviteCodesFile;
    }

    public void setInviteCodesFile(String inviteCodesFile) {
        this.inviteCodesFile = inviteCodesFile;
    }

    public int getMaxLoginAttempts() {
        return maxLoginAttempts;
    }

    public void setMaxLoginAttempts(int maxLoginAttempts) {
        this.maxLoginAttempts = maxLoginAttempts;
    }

    public Duration getLoginWindow() {
        return loginWindow;
    }

    public void setLoginWindow(Duration loginWindow) {
        this.loginWindow = loginWindow;
    }

    public static class Jwt {
        private String secretFile = "backend/data/auth/jwt_secret";
        private Duration ttl = Duration.ofDays(7);
        private Duration refreshTtl = Duration.ofDays(30);

        public String getSecretFile() {
            return secretFile;
        }

        public void setSecretFile(String secretFile) {
            this.secretFile = secretFile;
        }

        public Duration getTtl() {
            return ttl;
        }

        public void setTtl(Duration ttl) {
            this.ttl = ttl;
        }

        public Duration getRefreshTtl() {
            return refreshTtl;
        }

        public void setRefreshTtl(Duration refreshTtl) {
            this.refreshTtl = refreshTtl;
        }
    }
}
