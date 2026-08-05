package com.paymentProccessing.backend.service;

import com.paymentProccessing.backend.entity.Payment;
import com.paymentProccessing.backend.enums.PaymentMethod;
import com.paymentProccessing.backend.enums.PaymentStatus;
import com.paymentProccessing.backend.enums.PaymentType;
import com.paymentProccessing.backend.enums.RiskLevel;
import com.paymentProccessing.backend.repository.PaymentRepository;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Computes a fraud/risk score (0-100) for a payment using a transparent,
 * explainable rule engine — every point added to the score is tied to a
 * human-readable rule so the "why" can always be shown to a bank operator.
 *
 * Scoring model (each rule is independent and additive, capped at 100):
 *
 *  +30  Amount exceeds the high-value threshold for this payment type
 *  +12  Amount is elevated (over half the high-value threshold)
 *  + 8  Round-figure amount (multiple of 10,000) — classic structuring pattern
 *  +35  Beneficiary country is on the high-risk/sanctioned-adjacent list (international only)
 *  +10  High-risk channel (SWIFT / Wire Transfer international wire)
 *  +25  Velocity: 3+ payments from the same source account in the last 10 minutes
 *  +15  Unusual hour: payment initiated between 00:00-05:00 UTC
 *  +10  First-time payment to this destination account (no prior completed payment)
 *
 *  Score bands:  0-39 = LOW · 40-69 = MEDIUM · 70-100 = HIGH
 *  Fraud outcome: LOW -&gt; auto-cleared · MEDIUM -&gt; held for manual review · HIGH -&gt; auto-blocked
 */
@Service
@RequiredArgsConstructor
public class FraudDetectionService {

    private final PaymentRepository paymentRepository;

    private static final Set<String> HIGH_RISK_COUNTRIES = Set.of(
            "Nigeria", "North Korea", "Iran", "Syria", "Afghanistan", "Somalia", "Yemen", "Other"
    );

    private static final BigDecimal DOMESTIC_HIGH_AMOUNT = new BigDecimal("500000");   // ₹5,00,000
    private static final BigDecimal INTERNATIONAL_HIGH_AMOUNT = new BigDecimal("10000"); // 10,000 in txn currency

    private static final int VELOCITY_WINDOW_MINUTES = 10;
    private static final int VELOCITY_THRESHOLD = 3;

    private static final int LOW_MAX = 39;
    private static final int MEDIUM_MAX = 69;

    public RiskAssessmentResult assess(Payment payment) {
        int score = 0;
        List<String> rules = new ArrayList<>();
        boolean international = payment.getPaymentType() == PaymentType.INTERNATIONAL;
        BigDecimal amount = payment.getAmount() != null ? payment.getAmount() : BigDecimal.ZERO;

        // 1. Amount-based risk, scaled per payment type
        BigDecimal highThreshold = international ? INTERNATIONAL_HIGH_AMOUNT : DOMESTIC_HIGH_AMOUNT;
        if (amount.compareTo(highThreshold) > 0) {
            score += 30;
            rules.add("Transaction amount exceeds normal pattern");
        } else if (amount.compareTo(highThreshold.multiply(new BigDecimal("0.5"))) > 0) {
            score += 12;
            rules.add("Transaction amount is higher than typical for this channel");
        }

        // 2. Round-figure amount (possible structuring)
        if (amount.compareTo(new BigDecimal("10000")) >= 0
                && amount.remainder(new BigDecimal("10000")).compareTo(BigDecimal.ZERO) == 0) {
            score += 8;
            rules.add("Round-figure amount pattern detected");
        }

        // 3. Unusual / high-risk beneficiary country (international only)
        if (international && payment.getBeneficiaryCountry() != null
                && HIGH_RISK_COUNTRIES.contains(payment.getBeneficiaryCountry())) {
            score += 35;
            rules.add("Unusual transaction country detected");
        }

        // 4. Channel risk — cross-border wire/SWIFT is inherently higher risk
        if (payment.getPaymentMethod() == PaymentMethod.SWIFT || payment.getPaymentMethod() == PaymentMethod.WIRE_TRANSFER) {
            score += 10;
            rules.add("High-risk international payment channel");
        }

        // 5. Velocity check — repeated attempts from the same source account
        if (payment.getSourceAccount() != null) {
            Instant windowStart = Instant.now().minus(VELOCITY_WINDOW_MINUTES, ChronoUnit.MINUTES);
            long recentCount = paymentRepository.countBySourceAccountAndCreatedAtAfter(payment.getSourceAccount(), windowStart);
            if (recentCount >= VELOCITY_THRESHOLD) {
                score += 25;
                rules.add("Multiple payment attempts detected");
            }
        }

        // 6. Unusual hour of day (UTC)
        int hour = Instant.now().atZone(ZoneOffset.UTC).getHour();
        if (hour < 5) {
            score += 15;
            rules.add("Payment initiated during unusual hours");
        }

        // 7. First-time payment to this destination account
        if (payment.getDestinationAccount() != null) {
            boolean seenBefore = paymentRepository.existsByDestinationAccountAndStatus(
                    payment.getDestinationAccount(), PaymentStatus.COMPLETED);
            if (!seenBefore) {
                score += 10;
                rules.add("First-time payment to this destination account");
            }
        }

        score = Math.min(score, 100);
        RiskLevel level = score > MEDIUM_MAX ? RiskLevel.HIGH : score > LOW_MAX ? RiskLevel.MEDIUM : RiskLevel.LOW;

        if (rules.isEmpty()) {
            rules.add("No risk indicators triggered — payment matches normal behavior");
        }

        return new RiskAssessmentResult(score, level, rules);
    }

    @Getter
    public static class RiskAssessmentResult {
        private final int score;
        private final RiskLevel level;
        private final List<String> triggeredRules;

        public RiskAssessmentResult(int score, RiskLevel level, List<String> triggeredRules) {
            this.score = score;
            this.level = level;
            this.triggeredRules = triggeredRules;
        }
    }
}

