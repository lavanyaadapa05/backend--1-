package com.paymentProccessing.backend.service;

import com.paymentProccessing.backend.enums.PaymentStatus;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PaymentStateMachineTest {

    @Test
    void createdCanMoveToValidatedOrFailed() {
        assertThat(PaymentStateMachine.isValidTransition(PaymentStatus.CREATED, PaymentStatus.VALIDATED)).isTrue();
        assertThat(PaymentStateMachine.isValidTransition(PaymentStatus.CREATED, PaymentStatus.FAILED)).isTrue();
    }

    @Test
    void createdCannotJumpToSentOrCompleted() {
        assertThat(PaymentStateMachine.isValidTransition(PaymentStatus.CREATED, PaymentStatus.SENT)).isFalse();
        assertThat(PaymentStateMachine.isValidTransition(PaymentStatus.CREATED, PaymentStatus.COMPLETED)).isFalse();
    }

    @Test
    void validatedCanMoveToSentOrFailed() {
        assertThat(PaymentStateMachine.isValidTransition(PaymentStatus.VALIDATED, PaymentStatus.SENT)).isTrue();
        assertThat(PaymentStateMachine.isValidTransition(PaymentStatus.VALIDATED, PaymentStatus.FAILED)).isTrue();
        assertThat(PaymentStateMachine.isValidTransition(PaymentStatus.VALIDATED, PaymentStatus.COMPLETED)).isFalse();
    }

    @Test
    void sentCanMoveToCompletedOrFailed() {
        assertThat(PaymentStateMachine.isValidTransition(PaymentStatus.SENT, PaymentStatus.COMPLETED)).isTrue();
        assertThat(PaymentStateMachine.isValidTransition(PaymentStatus.SENT, PaymentStatus.FAILED)).isTrue();
    }

    @Test
    void completedIsTerminal() {
        assertThat(PaymentStateMachine.isTerminal(PaymentStatus.COMPLETED)).isTrue();
        assertThat(PaymentStateMachine.isValidTransition(PaymentStatus.COMPLETED, PaymentStatus.SENT)).isFalse();
        assertThat(PaymentStateMachine.isValidTransition(PaymentStatus.COMPLETED, PaymentStatus.CREATED)).isFalse();
    }

    @Test
    void failedIsTerminal() {
        assertThat(PaymentStateMachine.isTerminal(PaymentStatus.FAILED)).isTrue();
        assertThat(PaymentStateMachine.isValidTransition(PaymentStatus.FAILED, PaymentStatus.CREATED)).isFalse();
    }
}

