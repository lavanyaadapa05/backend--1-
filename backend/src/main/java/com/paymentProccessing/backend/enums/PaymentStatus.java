package com.paymentProccessing.backend.enums;

/**
 * Represents the lifecycle status of a payment.
 *
 * CREATED -&gt; VALIDATED -&gt; SENT -&gt; COMPLETED
 *      \-&gt; FAILED (can occur from CREATED, VALIDATED or SENT)
 */
public enum PaymentStatus {
    CREATED,
    VALIDATED,
    SENT,
    COMPLETED,
    FAILED
}

