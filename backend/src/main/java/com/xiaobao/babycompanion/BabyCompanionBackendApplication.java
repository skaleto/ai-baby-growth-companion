package com.xiaobao.babycompanion;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan("com.xiaobao.babycompanion.persistence.mapper")
public class BabyCompanionBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(BabyCompanionBackendApplication.class, args);
    }
}
