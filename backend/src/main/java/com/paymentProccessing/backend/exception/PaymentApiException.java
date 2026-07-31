package com.paymentProccessing.backend.exception;

import com.paymentProccessing.backend.enums.ErrorCode;
import lombok.Getter;

/**
 * Base unchecked exception carrying a client-facing {@link ErrorCode}.
 */
@Getter
public class PaymentApiException extends RuntimeException {

    private final ErrorCode errorCode;

    public PaymentApiException(ErrorCode errorCode) {
        super(errorCode.getDefaultMessage());
        this.errorCode = errorCode;
    }

    public PaymentApiException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }
}

