package com.paymentProccessing.backend.enums;

/**
 * High level category a payment belongs to. Domestic payments move funds
 * within India (UPI / NEFT / RTGS / IMPS); International payments move funds
 * across borders (SWIFT / Wire Transfer).
 */
public enum PaymentType {
    DOMESTIC,
    INTERNATIONAL
}

