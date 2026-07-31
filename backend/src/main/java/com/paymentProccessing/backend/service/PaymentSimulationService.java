package com.paymentProccessing.backend.service;

import com.paymentProccessing.backend.enums.ErrorCode;
import com.paymentProccessing.backend.enums.PaymentStatus;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.concurrent.ThreadLocalRandom;

/**
 * Simulates asynchronous downstream payment processing (as if talking to a
 * real payment network) without any real external integration, per the
 * project notes ("simulate the processing internally").
 *
 * Progresses a payment CREATED -> VALIDATED -> SENT -> COMPLETED with random
 * delays, occasionally injecting a FAILED outcome with a realistic error code.
 */
@Slf4j
@Service
public class PaymentSimulationService {

    private final PaymentService paymentService;

    @Value("${payments.simulation.enabled:true}")
    private boolean enabled;

    @Value("${payments.simulation.min-delay-ms:1000}")
    private long minDelayMs;

    @Value("${payments.simulation.max-delay-ms:3000}")
    private long maxDelayMs;

    @Value("${payments.simulation.failure-rate:0.1}")
    private double failureRate;

    public PaymentSimulationService(@Lazy PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @Async
    public void scheduleProcessing(String paymentId) {
        if (!enabled) {
            return;
        }
        try {
            sleepRandom();
            boolean failNow = shouldFail();
            if (failNow) {
                paymentService.updateStatus(paymentId, PaymentStatus.FAILED, "SIMULATOR",
                        "Validation failed during automated processing",
                        ErrorCode.VALIDATION_FAILED, "Simulated validation failure");
                return;
            }
            paymentService.updateStatus(paymentId, PaymentStatus.VALIDATED, "SIMULATOR",
                    "Automated validation passed", null, null);

            sleepRandom();
            if (shouldFail()) {
                paymentService.updateStatus(paymentId, PaymentStatus.FAILED, "SIMULATOR",
                        "Failed while sending to destination network",
                        ErrorCode.NETWORK_ERROR, "Simulated network failure while sending payment");
                return;
            }
            paymentService.updateStatus(paymentId, PaymentStatus.SENT, "SIMULATOR",
                    "Payment transmitted to destination system", null, null);

            sleepRandom();
            if (shouldFail()) {
                paymentService.updateStatus(paymentId, PaymentStatus.FAILED, "SIMULATOR",
                        "Destination system rejected the payment",
                        ErrorCode.PROCESSING_ERROR, "Simulated processing failure at destination");
                return;
            }
            paymentService.updateStatus(paymentId, PaymentStatus.COMPLETED, "SIMULATOR",
                    "Payment confirmed by destination system", null, null);
        } catch (Exception ex) {
            log.error("Simulation failed for payment {}", paymentId, ex);
        }
    }

    private boolean shouldFail() {
        return ThreadLocalRandom.current().nextDouble() < failureRate;
    }

    private void sleepRandom() {
        try {
            long delay = ThreadLocalRandom.current().nextLong(minDelayMs, Math.max(minDelayMs + 1, maxDelayMs));
            Thread.sleep(delay);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}

