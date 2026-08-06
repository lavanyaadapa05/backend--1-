package com.paymentProccessing.backend.controller;

import com.paymentProccessing.backend.dto.RevenueResponse;
import com.paymentProccessing.backend.service.RevenueService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/revenue") @RequiredArgsConstructor
public class RevenueController {
    private final RevenueService revenueService;
    @GetMapping public ResponseEntity<RevenueResponse> getRevenue() { return ResponseEntity.ok(revenueService.getRevenue()); }
    @GetMapping("/summary") public ResponseEntity<RevenueResponse> getSummary() { return ResponseEntity.ok(revenueService.getRevenue()); }
    @GetMapping("/trend") public ResponseEntity<?> getTrend() { return ResponseEntity.ok(revenueService.getRevenue().getRevenueTrend()); }
    @GetMapping("/commission-breakdown") public ResponseEntity<?> getCommissionBreakdown() { return ResponseEntity.ok(revenueService.getRevenue().getCommissionBreakdown()); }
}
