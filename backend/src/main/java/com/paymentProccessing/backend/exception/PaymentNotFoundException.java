package com.paymentProccessing.backend.exception;

import com.paymentProccessing.backend.enums.ErrorCode;

public class PaymentNotFoundException extends PaymentApiException {
    public PaymentNotFoundException(String paymentId) {
        super(ErrorCode.PAYMENT_NOT_FOUND, "Payment not found: " + paymentId);
    }
}

