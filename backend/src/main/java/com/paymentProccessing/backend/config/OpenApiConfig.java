package com.paymentProccessing.backend.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI paymentsOpenApi() {
        return new OpenAPI().info(new Info()
                .title("Payments Processing API")
                .description("REST API for creating, retrieving and tracking payments (UPI, Card, NetBanking) through their lifecycle.")
                .version("v1.0")
                .contact(new Contact().name("Payments Team")));
    }
}

