package com.xiaobao.babycompanion.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.storage")
public class AppStorageProperties {

    private String dataDir = "";
    private String mode = "local";
    private long maxUploadBytes = 100L * 1024L * 1024L;
    private final Oss oss = new Oss();

    public String getDataDir() {
        return dataDir;
    }

    public void setDataDir(String dataDir) {
        this.dataDir = dataDir;
    }

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public long getMaxUploadBytes() {
        return maxUploadBytes;
    }

    public void setMaxUploadBytes(long maxUploadBytes) {
        this.maxUploadBytes = maxUploadBytes;
    }

    public Oss getOss() {
        return oss;
    }

    public static class Oss {
        private String endpoint = "";
        private String bucket = "";
        private String objectPrefix = "baby-companion";
        private String accessKeyId = "";
        private String accessKeyIdFile = "";
        private String accessKeySecret = "";
        private String accessKeySecretFile = "";
        private long signedUrlTtlSeconds = 24L * 60L * 60L;
        private boolean migrateLocalOnStartup = false;

        public String getEndpoint() {
            return endpoint;
        }

        public void setEndpoint(String endpoint) {
            this.endpoint = endpoint;
        }

        public String getBucket() {
            return bucket;
        }

        public void setBucket(String bucket) {
            this.bucket = bucket;
        }

        public String getObjectPrefix() {
            return objectPrefix;
        }

        public void setObjectPrefix(String objectPrefix) {
            this.objectPrefix = objectPrefix;
        }

        public String getAccessKeyId() {
            return accessKeyId;
        }

        public void setAccessKeyId(String accessKeyId) {
            this.accessKeyId = accessKeyId;
        }

        public String getAccessKeyIdFile() {
            return accessKeyIdFile;
        }

        public void setAccessKeyIdFile(String accessKeyIdFile) {
            this.accessKeyIdFile = accessKeyIdFile;
        }

        public String getAccessKeySecret() {
            return accessKeySecret;
        }

        public void setAccessKeySecret(String accessKeySecret) {
            this.accessKeySecret = accessKeySecret;
        }

        public String getAccessKeySecretFile() {
            return accessKeySecretFile;
        }

        public void setAccessKeySecretFile(String accessKeySecretFile) {
            this.accessKeySecretFile = accessKeySecretFile;
        }

        public long getSignedUrlTtlSeconds() {
            return signedUrlTtlSeconds;
        }

        public void setSignedUrlTtlSeconds(long signedUrlTtlSeconds) {
            this.signedUrlTtlSeconds = signedUrlTtlSeconds;
        }

        public boolean isMigrateLocalOnStartup() {
            return migrateLocalOnStartup;
        }

        public void setMigrateLocalOnStartup(boolean migrateLocalOnStartup) {
            this.migrateLocalOnStartup = migrateLocalOnStartup;
        }
    }
}
