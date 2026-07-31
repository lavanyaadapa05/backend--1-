package com.paymentProccessing.backend.exception;

import com.paymentProccessing.backend.enums.ErrorCode;

public class PaymentValidationException extends PaymentApiException {
    public PaymentValidationException(ErrorCode errorCode, String message) {
        super(errorCode, message);
    }
}

