package com.paymentProccessing.backend.dto;

import com.paymentProccessing.backend.entity.Payment;
import com.paymentProccessing.backend.enums.ErrorCode;
import com.paymentProccessing.backend.enums.FraudStatus;
import com.paymentProccessing.backend.enums.PaymentMethod;
import com.paymentProccessing.backend.enums.PaymentStatus;
import com.paymentProccessing.backend.enums.PaymentType;
import com.paymentProccessing.backend.enums.RiskLevel;
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
    private String customerId;
    private BigDecimal amount;
    private String currency;
    private String sourceAccount;
    private String destinationAccount;
    private PaymentMethod paymentMethod;
    private PaymentType paymentType;
    private PaymentStatus status;
    private String reference;

    private String upiId;
    private String cardNumberMasked;
    private String cardHolderName;
    private String cardExpiry;
    private String cardNetwork;
    private String bankName;
    private String bankAccountType;

    private String senderBankName;
    private String beneficiaryBankName;
    private String ifscCode;
    private String mobileOrAccountNumber;

    private String swiftBicCode;
    private String beneficiaryCountry;
    private String paymentPurpose;
    private String routingNumber;

    private ErrorCode errorCode;
    private String errorMessage;

    private Integer riskScore;
    private RiskLevel riskLevel;
    private FraudStatus fraudStatus;

    private Instant createdAt;
    private Instant updatedAt;

    public static PaymentResponse from(Payment p) {
        return PaymentResponse.builder()
                .id(p.getId())
                .idempotencyKey(p.getIdempotencyKey())
                .customerId(p.getCustomerId())
                .amount(p.getAmount())
                .currency(p.getCurrency())
                .sourceAccount(p.getSourceAccount())
                .destinationAccount(p.getDestinationAccount())
                .paymentMethod(p.getPaymentMethod())
                .paymentType(p.getPaymentType())
                .status(p.getStatus())
                .reference(p.getReference())
                .upiId(p.getUpiId())
                .cardNumberMasked(p.getCardNumberMasked())
                .cardHolderName(p.getCardHolderName())
                .cardExpiry(p.getCardExpiry())
                .cardNetwork(p.getCardNetwork())
                .bankName(p.getBankName())
                .bankAccountType(p.getBankAccountType())
                .senderBankName(p.getSenderBankName())
                .beneficiaryBankName(p.getBeneficiaryBankName())
                .ifscCode(p.getIfscCode())
                .mobileOrAccountNumber(p.getMobileOrAccountNumber())
                .swiftBicCode(p.getSwiftBicCode())
                .beneficiaryCountry(p.getBeneficiaryCountry())
                .paymentPurpose(p.getPaymentPurpose())
                .routingNumber(p.getRoutingNumber())
                .errorCode(p.getErrorCode())
                .errorMessage(p.getErrorMessage())
                .riskScore(p.getRiskScore())
                .riskLevel(p.getRiskLevel())
                .fraudStatus(p.getFraudStatus())
                .createdAt(p.getCreatedAt())
                .updatedAt(p.getUpdatedAt())
                .build();
    }
}

