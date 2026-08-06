package com.paymentProccessing.backend.entity;

import com.paymentProccessing.backend.enums.PaymentMethod;
import com.paymentProccessing.backend.enums.PaymentStatus;
import com.paymentProccessing.backend.enums.PaymentType;
import com.paymentProccessing.backend.enums.FraudStatus;
import com.paymentProccessing.backend.enums.RiskLevel;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Core Payment entity. Stores minimal required fields plus extra
 * instrument-specific details (UPI / Card / NetBanking) so that a single
 * table can represent every supported payment method.
 */
@Entity
@Table(name = "payments", indexes = {
        @Index(name = "idx_payment_idempotency_key", columnList = "idempotencyKey", unique = true),
        @Index(name = "idx_payment_status", columnList = "status"),
        @Index(name = "idx_payment_created_at", columnList = "createdAt")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Payment {

    @Id
    @Column(length = 36, updatable = false, nullable = false)
    private String id;

    /** Client supplied key used to detect duplicate submissions. */
    @Column(length = 100, unique = true)
    private String idempotencyKey;

    /** Prototype customer scope. A real deployment would derive this from authenticated identity. */
    @Column(nullable = false, length = 100)
    private String customerId;

    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal amount;

    @Column(nullable = false, length = 3)
    private String currency;

    @Column(nullable = false, length = 34)
    private String sourceAccount;

    @Column(nullable = false, length = 34)
    private String destinationAccount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PaymentMethod paymentMethod;

    /** Whether this payment is a domestic (India) or international (cross-border) transfer. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PaymentType paymentType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PaymentStatus status;

    @Column(length = 255)
    private String reference;

    // ---------- UPI specific ----------
    @Column(length = 100)
    private String upiId;

    // ---------- Card specific (never store full PAN/CVV - demo only, masked) ----------
    @Column(length = 25)
    private String cardNumberMasked;

    @Column(length = 100)
    private String cardHolderName;

    @Column(length = 7)
    private String cardExpiry; // MM/YYYY

    @Column(length = 20)
    private String cardNetwork; // VISA / MASTERCARD / RUPAY / AMEX

    // ---------- NetBanking specific ----------
    @Column(length = 100)
    private String bankName;

    @Column(length = 20)
    private String bankAccountType;

    // ---------- NEFT / RTGS / IMPS specific ----------
    @Column(length = 100)
    private String senderBankName;

    @Column(length = 100)
    private String beneficiaryBankName;

    @Column(length = 20)
    private String ifscCode;

    @Column(length = 50)
    private String mobileOrAccountNumber;

    // ---------- SWIFT / Wire Transfer specific ----------
    @Column(length = 20)
    private String swiftBicCode;

    @Column(length = 100)
    private String beneficiaryCountry;

    @Column(length = 100)
    private String paymentPurpose;

    @Column(length = 30)
    private String routingNumber;

    // ---------- Failure details ----------
    @Enumerated(EnumType.STRING)
    @Column(length = 40)
    private com.paymentProccessing.backend.enums.ErrorCode errorCode;

    @Column(length = 500)
    private String errorMessage;

    // ---------- Fraud / risk screening ----------
    /** Latest computed fraud risk score, 0-100 (higher = riskier). */
    @Column
    private Integer riskScore;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private RiskLevel riskLevel;

    /** CLEARED / UNDER_REVIEW / BLOCKED — drives whether the payment is allowed to proceed. */
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private FraudStatus fraudStatus;

    @Version
    private Long version;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "payment", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<PaymentStatusHistory> statusHistory = new ArrayList<>();

    @PrePersist
    public void prePersist() {
        if (this.id == null) {
            this.id = UUID.randomUUID().toString();
        }
        if (this.status == null) {
            this.status = PaymentStatus.CREATED;
        }
        if (this.paymentType == null && this.paymentMethod != null) {
            this.paymentType = (this.paymentMethod == PaymentMethod.SWIFT || this.paymentMethod == PaymentMethod.WIRE_TRANSFER)
                    ? PaymentType.INTERNATIONAL : PaymentType.DOMESTIC;
        }
    }

    public void addHistory(PaymentStatusHistory history) {
        history.setPayment(this);
        this.statusHistory.add(history);
    }
}

