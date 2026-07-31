package com.paymentProccessing.backend.exception;

import com.paymentProccessing.backend.enums.ErrorCode;
import com.paymentProccessing.backend.enums.PaymentStatus;

public class InvalidStatusTransitionException extends PaymentApiException {
    public InvalidStatusTransitionException(PaymentStatus from, PaymentStatus to) {
        super(ErrorCode.INVALID_STATUS_TRANSITION,
                "Cannot transition payment from " + from + " to " + to);
    }
}

