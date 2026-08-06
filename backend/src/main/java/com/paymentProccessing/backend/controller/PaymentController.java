package com.paymentProccessing.backend.controller;

import com.paymentProccessing.backend.dto.*;
import com.paymentProccessing.backend.enums.PaymentStatus;
import com.paymentProccessing.backend.enums.RiskLevel;
import com.paymentProccessing.backend.service.PaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
@Tag(name = "Payments", description = "Create, retrieve and track payments through their lifecycle")
public class PaymentController {

    private final PaymentService paymentService;

    @Operation(summary = "Create a new payment (idempotent via idempotencyKey)")
    @PostMapping
    public ResponseEntity<PaymentResponse> createPayment(@Valid @RequestBody CreatePaymentRequest request) {
        PaymentResponse response = paymentService.createPayment(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @Operation(summary = "Get a payment by id")
    @GetMapping("/{id}")
    public ResponseEntity<PaymentResponse> getPayment(@PathVariable String id) {
        return ResponseEntity.ok(paymentService.getPayment(id));
    }

    @Operation(summary = "List / search / filter payments with pagination")
    @GetMapping
    public ResponseEntity<PageResponse<PaymentResponse>> listPayments(
            @RequestParam(required = false) PaymentStatus status,
            @RequestParam(required = false) RiskLevel riskLevel,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String customerId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "DESC") String direction) {

        Sort sort = Sort.by(Sort.Direction.fromString(direction), sortBy);
        Pageable pageable = PageRequest.of(page, size, sort);
        return ResponseEntity.ok(paymentService.listPayments(status, riskLevel, search, customerId, pageable));
    }

    @Operation(summary = "Get the full status transition audit trail for a payment")
    @GetMapping("/{id}/history")
    public ResponseEntity<List<StatusHistoryResponse>> getHistory(@PathVariable String id) {
        return ResponseEntity.ok(paymentService.getHistory(id));
    }

    @Operation(summary = "Get the latest fraud/risk assessment for a payment (score, level, triggered rules, decision)")
    @GetMapping("/{id}/risk")
    public ResponseEntity<RiskAssessmentResponse> getRisk(@PathVariable String id) {
        return ResponseEntity.ok(paymentService.getRisk(id));
    }

    @Operation(summary = "Bank operator approve/reject decision on a MEDIUM-risk payment held for review")
    @PatchMapping("/{id}/risk-decision")
    public ResponseEntity<PaymentResponse> decideRisk(@PathVariable String id,
                                                       @Valid @RequestBody RiskDecisionRequest request) {
        return ResponseEntity.ok(paymentService.decideRisk(id, request.getDecision(), "OPERATIONS_USER", request.getNotes()));
    }

    @Operation(summary = "Manually transition a payment's status (subject to the payment state machine)")
    @PatchMapping("/{id}/status")
    public ResponseEntity<PaymentResponse> updateStatus(@PathVariable String id,
                                                         @Valid @RequestBody StatusUpdateRequest request) {
        PaymentResponse response = paymentService.updateStatus(id, request.getStatus(), "USER", request.getNotes(), null, null);
        return ResponseEntity.ok(response);
    }
}

