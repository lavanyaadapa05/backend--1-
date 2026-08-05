package com.paymentProccessing.backend.controller;

import com.paymentProccessing.backend.dto.AnalyticsResponse;
import com.paymentProccessing.backend.service.AnalyticsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
@Tag(name = "Analytics", description = "Operational KPIs and insights derived from payment data for the Analytics dashboard")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    @Operation(summary = "Get aggregated payment analytics (KPIs, volume trend, distributions, failure analysis, recent activity)")
    @GetMapping
    public ResponseEntity<AnalyticsResponse> getAnalytics() {
        return ResponseEntity.ok(analyticsService.getAnalytics());
    }
}
