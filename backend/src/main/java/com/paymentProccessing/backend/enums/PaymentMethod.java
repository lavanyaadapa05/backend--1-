package com.paymentProccessing.backend.enums;

/**
 * Supported payment methods/instruments.
 */
public enum PaymentMethod {
    UPI,
    CARD,
    NETBANKING,
    NEFT,
    RTGS,
    IMPS,
    SWIFT,
    WIRE_TRANSFER;

    /**
     * Whether this payment method is used for domestic transfers.
     * SWIFT and WIRE_TRANSFER are treated as international/cross-border methods.
     */
    public boolean isDomestic() {
        return this != SWIFT && this != WIRE_TRANSFER;
    }
}

