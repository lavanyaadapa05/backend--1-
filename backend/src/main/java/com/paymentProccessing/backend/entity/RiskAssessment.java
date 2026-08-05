package com.paymentProccessing.backend.entity;

import com.paymentProccessing.backend.enums.RiskLevel;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

/**
 * A single fraud/risk screening result for a payment. A payment normally has
 * one assessment (generated at creation time), but MEDIUM risk payments can
 * gain a second "decision" record once a bank operator approves/rejects them,
 * so this is modeled as a one-to-many history rather than a single row.
 */
@Entity
@Table(name = "risk_assessments", indexes = {
        @Index(name = "idx_risk_payment_id", columnList = "payment_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RiskAssessment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long assessmentId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "payment_id", nullable = false)
    private Payment payment;

    @Column(nullable = false)
    private Integer riskScore;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RiskLevel riskLevel;

    /** Semicolon-separated human-readable list of the rules that fired during scoring. */
    @Column(length = 2000)
    private String triggeredRules;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant assessmentTimestamp;

    /** AUTO_CLEARED / PENDING_REVIEW / AUTO_BLOCKED / APPROVED / REJECTED */
    @Column(length = 30)
    private String decision;

    @Transient
    public List<String> getTriggeredRulesList() {
        if (triggeredRules == null || triggeredRules.isBlank()) {
            return List.of();
        }
        return Arrays.asList(triggeredRules.split("\\s*;\\s*"));
    }

    public static String joinRules(List<String> rules) {
        return String.join("; ", rules);
    }
}

