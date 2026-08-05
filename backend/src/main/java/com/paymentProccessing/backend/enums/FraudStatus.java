package com.paymentProccessing.backend.enums;

/**
 * Outcome of fraud/risk screening for a payment.
 *
 * LOW risk    -&gt; CLEARED (payment proceeds automatically)
 * MEDIUM risk -&gt; UNDER_REVIEW (held for a bank operations user to approve/reject)
 * HIGH risk   -&gt; BLOCKED (payment is automatically failed/blocked, never sent)
 */
public enum FraudStatus {
    CLEARED,
    UNDER_REVIEW,
    BLOCKED
}

