package com.paymentProccessing.backend.exception;

import com.paymentProccessing.backend.enums.ErrorCode;

public class DuplicatePaymentException extends PaymentApiException {
    public DuplicatePaymentException(String idempotencyKey) {
        super(ErrorCode.DUPLICATE_PAYMENT, "A payment with idempotency key '" + idempotencyKey + "' already exists");
    }
}

