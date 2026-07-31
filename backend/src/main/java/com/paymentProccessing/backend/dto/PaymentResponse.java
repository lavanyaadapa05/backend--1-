package com.paymentProccessing.backend.dto;

import com.paymentProccessing.backend.entity.Payment;
import com.paymentProccessing.backend.enums.ErrorCode;
import com.paymentProccessing.backend.enums.PaymentMethod;
import com.paymentProccessing.backend.enums.PaymentStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentResponse {

    private String id;
    private String idempotencyKey;
    private BigDecimal amount;
    private String currency;
    private String sourceAccount;
    private String destinationAccount;
    private PaymentMethod paymentMethod;
    private PaymentStatus status;
    private String reference;

    private String upiId;
    private String cardNumberMasked;
    private String cardHolderName;
    private String cardExpiry;
    private String cardNetwork;
    private String bankName;
    private String bankAccountType;

    private ErrorCode errorCode;
    private String errorMessage;

    private Instant createdAt;
    private Instant updatedAt;

    public static PaymentResponse from(Payment p) {
        return PaymentResponse.builder()
                .id(p.getId())
                .idempotencyKey(p.getIdempotencyKey())
                .amount(p.getAmount())
                .currency(p.getCurrency())
                .sourceAccount(p.getSourceAccount())
                .destinationAccount(p.getDestinationAccount())
                .paymentMethod(p.getPaymentMethod())
                .status(p.getStatus())
                .reference(p.getReference())
                .upiId(p.getUpiId())
                .cardNumberMasked(p.getCardNumberMasked())
                .cardHolderName(p.getCardHolderName())
                .cardExpiry(p.getCardExpiry())
                .cardNetwork(p.getCardNetwork())
                .bankName(p.getBankName())
                .bankAccountType(p.getBankAccountType())
                .errorCode(p.getErrorCode())
                .errorMessage(p.getErrorMessage())
                .createdAt(p.getCreatedAt())
                .updatedAt(p.getUpdatedAt())
                .build();
    }
}

