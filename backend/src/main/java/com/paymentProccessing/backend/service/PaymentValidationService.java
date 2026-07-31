package com.paymentProccessing.backend.service;

import com.paymentProccessing.backend.dto.CreatePaymentRequest;
import com.paymentProccessing.backend.enums.ErrorCode;
import com.paymentProccessing.backend.exception.PaymentValidationException;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Set;

/**
 * Business validation rules beyond simple bean-validation annotations
 * (Appendix C).
 */
@Component
public class PaymentValidationService {

    private static final Set<String> SUPPORTED_CURRENCIES = Set.of(
            "USD", "EUR", "GBP", "INR", "JPY", "AUD", "CAD", "SGD", "AED", "CHF"
    );

    private static final BigDecimal MAX_AMOUNT = new BigDecimal("1000000");

    public void validate(CreatePaymentRequest request) {
        validateAmount(request.getAmount());
        validateCurrency(request.getCurrency());
        validateAccounts(request.getSourceAccount(), request.getDestinationAccount());
        validatePaymentMethodDetails(request);
    }

    private void validateAmount(BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new PaymentValidationException(ErrorCode.INVALID_AMOUNT, "Amount must be greater than 0");
        }
        if (amount.compareTo(MAX_AMOUNT) > 0) {
            throw new PaymentValidationException(ErrorCode.INVALID_AMOUNT, "Amount must not exceed 1,000,000");
        }
        if (amount.scale() > 2) {
            throw new PaymentValidationException(ErrorCode.INVALID_AMOUNT, "Amount must have at most 2 decimal places");
        }
    }

    private void validateCurrency(String currency) {
        if (currency == null || !SUPPORTED_CURRENCIES.contains(currency.toUpperCase())) {
            throw new PaymentValidationException(ErrorCode.INVALID_CURRENCY,
                    "Currency '" + currency + "' is not supported");
        }
    }

    private void validateAccounts(String source, String destination) {
        if (source == null || destination == null || source.isBlank() || destination.isBlank()) {
            throw new PaymentValidationException(ErrorCode.INVALID_ACCOUNT, "Source and destination accounts are required");
        }
        if (source.trim().equalsIgnoreCase(destination.trim())) {
            throw new PaymentValidationException(ErrorCode.INVALID_ACCOUNT,
                    "Source and destination accounts must be different");
        }
    }

    private void validatePaymentMethodDetails(CreatePaymentRequest request) {
        switch (request.getPaymentMethod()) {
            case UPI -> {
                if (request.getUpiDetails() == null || request.getUpiDetails().getUpiId() == null
                        || request.getUpiDetails().getUpiId().isBlank()) {
                    throw new PaymentValidationException(ErrorCode.INVALID_PAYMENT_METHOD,
                            "upiDetails.upiId is required for UPI payments");
                }
            }
            case CARD -> {
                if (request.getCardDetails() == null
                        || isBlank(request.getCardDetails().getCardNumber())
                        || isBlank(request.getCardDetails().getCardHolderName())
                        || isBlank(request.getCardDetails().getCardExpiry())
                        || isBlank(request.getCardDetails().getCvv())) {
                    throw new PaymentValidationException(ErrorCode.INVALID_PAYMENT_METHOD,
                            "cardDetails (cardNumber, cardHolderName, cardExpiry, cvv) is required for card payments");
                }
                if (!isCardNotExpired(request.getCardDetails().getCardExpiry())) {
                    throw new PaymentValidationException(ErrorCode.INVALID_PAYMENT_METHOD, "Card has expired");
                }
            }
            case NETBANKING -> {
                if (request.getNetBankingDetails() == null
                        || isBlank(request.getNetBankingDetails().getBankName())
                        || isBlank(request.getNetBankingDetails().getBankAccountType())) {
                    throw new PaymentValidationException(ErrorCode.INVALID_PAYMENT_METHOD,
                            "netBankingDetails (bankName, bankAccountType) is required for net banking payments");
                }
            }
            default -> throw new PaymentValidationException(ErrorCode.INVALID_PAYMENT_METHOD, "Unsupported payment method");
        }
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private boolean isCardNotExpired(String expiry) {
        try {
            String[] parts = expiry.split("/");
            int month = Integer.parseInt(parts[0]);
            int year = Integer.parseInt(parts[1]);
            java.time.YearMonth cardMonth = java.time.YearMonth.of(year, month);
            return !cardMonth.isBefore(java.time.YearMonth.now());
        } catch (Exception e) {
            return false;
        }
    }
}

