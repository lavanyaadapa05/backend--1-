package com.paymentProccessing.backend.service;

import com.paymentProccessing.backend.enums.PaymentStatus;

import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/**
 * Encapsulates the valid payment status transitions (Appendix C):
 *
 * CREATED -> VALIDATED, FAILED
 * VALIDATED -> SENT, FAILED
 * SENT -> COMPLETED, FAILED
 * COMPLETED -> (terminal)
 * FAILED -> (terminal)
 */
public final class PaymentStateMachine {

    private static final Map<PaymentStatus, Set<PaymentStatus>> TRANSITIONS = new EnumMap<>(PaymentStatus.class);

    static {
        TRANSITIONS.put(PaymentStatus.CREATED, EnumSet.of(PaymentStatus.VALIDATED, PaymentStatus.FAILED));
        TRANSITIONS.put(PaymentStatus.VALIDATED, EnumSet.of(PaymentStatus.SENT, PaymentStatus.FAILED));
        TRANSITIONS.put(PaymentStatus.SENT, EnumSet.of(PaymentStatus.COMPLETED, PaymentStatus.FAILED));
        TRANSITIONS.put(PaymentStatus.COMPLETED, EnumSet.noneOf(PaymentStatus.class));
        TRANSITIONS.put(PaymentStatus.FAILED, EnumSet.noneOf(PaymentStatus.class));
    }

    private PaymentStateMachine() {
    }

    public static boolean isValidTransition(PaymentStatus from, PaymentStatus to) {
        if (from == null || to == null) {
            return false;
        }
        return TRANSITIONS.getOrDefault(from, EnumSet.noneOf(PaymentStatus.class)).contains(to);
    }

    public static boolean isTerminal(PaymentStatus status) {
        return status == PaymentStatus.COMPLETED || status == PaymentStatus.FAILED;
    }
}

