package com.xiaobao.babycompanion.config;

import java.nio.file.Files;
import java.nio.file.Path;

import javax.sql.DataSource;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.util.StringUtils;

@Configuration
public class SqliteDataSourceConfig {

    private final AppStorageProperties properties;

    public SqliteDataSourceConfig(AppStorageProperties properties) {
        this.properties = properties;
    }

    @Bean
    public DataSource dataSource() throws Exception {
        Path dataDir = dataDir();
        Files.createDirectories(dataDir);

        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.sqlite.JDBC");
        dataSource.setUrl("jdbc:sqlite:" + dataDir.resolve("baby-companion.sqlite").toAbsolutePath());
        return dataSource;
    }

    @Bean
    public Path appDataDir() throws Exception {
        Path dataDir = dataDir();
        Files.createDirectories(dataDir);
        return dataDir;
    }

    private Path dataDir() {
        if (StringUtils.hasText(properties.getDataDir())) {
            return Path.of(properties.getDataDir()).toAbsolutePath().normalize();
        }

        Path cwd = Path.of("").toAbsolutePath().normalize();
        if ("backend".equals(cwd.getFileName().toString())) {
            return cwd.resolve("data").normalize();
        }
        return cwd.resolve("backend").resolve("data").normalize();
    }
}
