package com.paymentProccessing.backend.service;

import com.paymentProccessing.backend.dto.CreatePaymentRequest;
import com.paymentProccessing.backend.dto.PaymentResponse;
import com.paymentProccessing.backend.entity.Payment;
import com.paymentProccessing.backend.enums.ErrorCode;
import com.paymentProccessing.backend.enums.PaymentMethod;
import com.paymentProccessing.backend.enums.PaymentStatus;
import com.paymentProccessing.backend.enums.PaymentType;
import com.paymentProccessing.backend.exception.InvalidStatusTransitionException;
import com.paymentProccessing.backend.exception.PaymentApiException;
import com.paymentProccessing.backend.exception.PaymentNotFoundException;
import com.paymentProccessing.backend.repository.PaymentRepository;
import com.paymentProccessing.backend.repository.PaymentStatusHistoryRepository;
import com.paymentProccessing.backend.repository.RiskAssessmentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentServiceTest {

    @Mock
    private PaymentRepository paymentRepository;

    @Mock
    private PaymentStatusHistoryRepository historyRepository;

    @Mock
    private PaymentSimulationService simulationService;

    @Mock
    private RiskAssessmentRepository riskAssessmentRepository;

    private PaymentValidationService validationService;
    private FraudDetectionService fraudDetectionService;

    private PaymentService paymentService;

    @BeforeEach
    void setUp() {
        validationService = new PaymentValidationService();
        fraudDetectionService = new FraudDetectionService(paymentRepository);
        paymentService = new PaymentService(paymentRepository, historyRepository, validationService, simulationService,
                fraudDetectionService, riskAssessmentRepository);
        lenient().when(riskAssessmentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    private CreatePaymentRequest upiRequest() {
        CreatePaymentRequest request = new CreatePaymentRequest();
        request.setAmount(new BigDecimal("250.50"));
        request.setCurrency("INR");
        request.setSourceAccount("payer@upi");
        request.setDestinationAccount("payee@upi");
        request.setPaymentMethod(PaymentMethod.UPI);
        request.setPaymentType(PaymentType.DOMESTIC);
        CreatePaymentRequest.UpiDetails upi = new CreatePaymentRequest.UpiDetails();
        upi.setUpiId("payer@upi");
        request.setUpiDetails(upi);
        return request;
    }

    @Test
    void createPaymentPersistsAndSchedulesSimulation() {
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));

        PaymentResponse response = paymentService.createPayment(upiRequest());

        assertThat(response.getStatus()).isEqualTo(PaymentStatus.CREATED);
        assertThat(response.getUpiId()).isEqualTo("payer@upi");
        verify(simulationService, times(1)).scheduleProcessing(anyString());
        // 1 "Payment created" + 2 fraud audit entries ("Fraud validation completed", "Risk score generated")
        verify(historyRepository, times(3)).save(any());
    }

    @Test
    void duplicateIdempotencyKeyReturnsExistingPaymentWithoutCreatingNew() {
        CreatePaymentRequest request = upiRequest();
        request.setIdempotencyKey("idem-123");

        Payment existing = Payment.builder()
                .id("existing-id")
                .idempotencyKey("idem-123")
                .amount(request.getAmount())
                .currency("INR")
                .sourceAccount("acc-src")
                .destinationAccount("acc-dst")
                .paymentMethod(PaymentMethod.UPI)
                .status(PaymentStatus.VALIDATED)
                .build();

        when(paymentRepository.findByIdempotencyKey("idem-123")).thenReturn(Optional.of(existing));

        PaymentResponse response = paymentService.createPayment(request);

        assertThat(response.getId()).isEqualTo("existing-id");
        assertThat(response.getStatus()).isEqualTo(PaymentStatus.VALIDATED);
        verify(paymentRepository, never()).save(any());
        verify(simulationService, never()).scheduleProcessing(any());
    }

    @Test
    void getPaymentThrowsNotFoundWhenMissing() {
        when(paymentRepository.findById("missing")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> paymentService.getPayment("missing"))
                .isInstanceOf(PaymentNotFoundException.class);
    }

    @Test
    void validTransitionUpdatesStatusAndRecordsHistory() {
        Payment payment = Payment.builder()
                .id("p1")
                .amount(BigDecimal.TEN)
                .currency("USD")
                .sourceAccount("a")
                .destinationAccount("b")
                .paymentMethod(PaymentMethod.UPI)
                .status(PaymentStatus.CREATED)
                .build();

        when(paymentRepository.findById("p1")).thenReturn(Optional.of(payment));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));

        PaymentResponse response = paymentService.updateStatus("p1", PaymentStatus.VALIDATED, "USER", "ok", null, null);

        assertThat(response.getStatus()).isEqualTo(PaymentStatus.VALIDATED);

        ArgumentCaptor<PaymentStatus> toCaptor = ArgumentCaptor.forClass(PaymentStatus.class);
        verify(historyRepository).save(argThat(h -> h.getFromStatus() == PaymentStatus.CREATED
                && h.getToStatus() == PaymentStatus.VALIDATED));
    }

    @Test
    void invalidTransitionIsRejected() {
        Payment payment = Payment.builder()
                .id("p1")
                .amount(BigDecimal.TEN)
                .currency("USD")
                .sourceAccount("a")
                .destinationAccount("b")
                .paymentMethod(PaymentMethod.UPI)
                .status(PaymentStatus.COMPLETED)
                .build();

        when(paymentRepository.findById("p1")).thenReturn(Optional.of(payment));

        assertThatThrownBy(() -> paymentService.updateStatus("p1", PaymentStatus.CREATED, "USER", null, null, null))
                .isInstanceOf(InvalidStatusTransitionException.class);
    }

    @Test
    void failingTransitionSetsErrorDetails() {
        Payment payment = Payment.builder()
                .id("p1")
                .amount(BigDecimal.TEN)
                .currency("USD")
                .sourceAccount("a")
                .destinationAccount("b")
                .paymentMethod(PaymentMethod.UPI)
                .status(PaymentStatus.SENT)
                .build();

        when(paymentRepository.findById("p1")).thenReturn(Optional.of(payment));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));

        PaymentResponse response = paymentService.updateStatus("p1", PaymentStatus.FAILED, "SIMULATOR", "network down",
                ErrorCode.NETWORK_ERROR, "Simulated network failure");

        assertThat(response.getStatus()).isEqualTo(PaymentStatus.FAILED);
        assertThat(response.getErrorCode()).isEqualTo(ErrorCode.NETWORK_ERROR);
        assertThat(response.getErrorMessage()).isEqualTo("Simulated network failure");
    }

    @Test
    void invalidAmountThrowsValidationError() {
        CreatePaymentRequest request = upiRequest();
        request.setAmount(BigDecimal.ZERO);
        assertThatThrownBy(() -> paymentService.createPayment(request))
                .isInstanceOf(PaymentApiException.class)
                .satisfies(ex -> assertThat(((PaymentApiException) ex).getErrorCode()).isEqualTo(ErrorCode.INVALID_AMOUNT));
        verify(paymentRepository, never()).save(any());
    }
}

