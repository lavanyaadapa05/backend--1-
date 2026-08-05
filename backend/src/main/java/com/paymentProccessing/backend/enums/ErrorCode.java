package com.paymentProccessing.backend.enums;

import org.springframework.http.HttpStatus;

/**
 * Standard, client-facing error codes for the Payments API. See Appendix B of
 * the project spec for the canonical list.
 */
public enum ErrorCode {
    VALIDATION_FAILED(HttpStatus.BAD_REQUEST, "Payment failed validation checks"),
    INSUFFICIENT_FUNDS(HttpStatus.BAD_REQUEST, "Source account has insufficient funds"),
    INVALID_ACCOUNT(HttpStatus.BAD_REQUEST, "Account number is invalid or doesn't exist"),
    INVALID_CURRENCY(HttpStatus.BAD_REQUEST, "Currency code is not supported"),
    INVALID_AMOUNT(HttpStatus.BAD_REQUEST, "Amount is zero, negative, or invalid"),
    INVALID_PAYMENT_METHOD(HttpStatus.BAD_REQUEST, "Payment method details are invalid or missing"),
    DUPLICATE_PAYMENT(HttpStatus.CONFLICT, "Payment with same idempotency key exists"),
    INVALID_STATUS_TRANSITION(HttpStatus.BAD_REQUEST, "Cannot transition from current status to requested status"),
    PAYMENT_NOT_FOUND(HttpStatus.NOT_FOUND, "Payment ID does not exist"),
    PROCESSING_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "Internal error during payment processing"),
    NETWORK_ERROR(HttpStatus.SERVICE_UNAVAILABLE, "Communication failure with payment network"),
    FRAUD_BLOCKED(HttpStatus.OK, "Payment blocked due to high fraud risk"),
    FRAUD_REJECTED(HttpStatus.OK, "Payment rejected by operations team after fraud review");

    private final HttpStatus httpStatus;
    private final String defaultMessage;

    ErrorCode(HttpStatus httpStatus, String defaultMessage) {
        this.httpStatus = httpStatus;
        this.defaultMessage = defaultMessage;
    }

    public HttpStatus getHttpStatus() {
        return httpStatus;
    }

    public String getDefaultMessage() {
        return defaultMessage;
    }
}

