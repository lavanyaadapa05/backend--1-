package com.paymentProccessing.backend.entity;

import com.paymentProccessing.backend.enums.PaymentStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * Audit trail entry recording a single status transition for a payment.
 */
@Entity
@Table(name = "payment_status_history", indexes = {
        @Index(name = "idx_history_payment_id", columnList = "payment_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentStatusHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "payment_id", nullable = false)
    private Payment payment;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private PaymentStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PaymentStatus toStatus;

    /** Who or what triggered the transition, e.g. "SYSTEM", "USER", "SIMULATOR". */
    @Column(nullable = false, length = 50)
    private String triggeredBy;

    @Column(length = 500)
    private String notes;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant changedAt;

    /**
     * Optional explicit audit action label for events that aren't a plain status
     * transition (e.g. fraud/risk events like "Risk score generated" or
     * "Payment flagged for review"). When absent, {@link #getAction()} derives
     * a label from {@link #toStatus}.
     */
    @Column(length = 100)
    private String actionOverride;

    /**
     * Human-readable description of the transition, derived from the target status.
     * Not persisted; computed on demand for display/analytics purposes.
     */
    @Transient
    public String getAction() {
        if (actionOverride != null && !actionOverride.isBlank()) {
            return actionOverride;
        }
        if (toStatus == null) {
            return "Status Changed";
        }
        return switch (toStatus) {
            case CREATED -> "Payment Created";
            case VALIDATED -> "Validated";
            case SENT -> "Sent";
            case COMPLETED -> "Completed";
            case FAILED -> "Payment Failed";
        };
    }
}

