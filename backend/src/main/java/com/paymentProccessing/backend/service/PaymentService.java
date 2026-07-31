package com.paymentProccessing.backend.service;

import com.paymentProccessing.backend.dto.CreatePaymentRequest;
import com.paymentProccessing.backend.dto.PageResponse;
import com.paymentProccessing.backend.dto.PaymentResponse;
import com.paymentProccessing.backend.dto.StatusHistoryResponse;
import com.paymentProccessing.backend.entity.Payment;
import com.paymentProccessing.backend.entity.PaymentStatusHistory;
import com.paymentProccessing.backend.enums.ErrorCode;
import com.paymentProccessing.backend.enums.PaymentMethod;
import com.paymentProccessing.backend.enums.PaymentStatus;
import com.paymentProccessing.backend.exception.InvalidStatusTransitionException;
import com.paymentProccessing.backend.exception.PaymentNotFoundException;
import com.paymentProccessing.backend.repository.PaymentRepository;
import com.paymentProccessing.backend.repository.PaymentStatusHistoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final PaymentStatusHistoryRepository historyRepository;
    private final PaymentValidationService validationService;
    private final PaymentSimulationService simulationService;

    /**
     * Creates a new payment. If an idempotencyKey is supplied and a payment
     * already exists with that key, the EXISTING payment is returned instead
     * of creating a duplicate (idempotent create).
     */
    @Transactional
    public PaymentResponse createPayment(CreatePaymentRequest request) {
        if (request.getIdempotencyKey() != null && !request.getIdempotencyKey().isBlank()) {
            var existing = paymentRepository.findByIdempotencyKey(request.getIdempotencyKey());
            if (existing.isPresent()) {
                return PaymentResponse.from(existing.get());
            }
        }

        validationService.validate(request);

        Payment payment = Payment.builder()
                .id(java.util.UUID.randomUUID().toString())
                .idempotencyKey(request.getIdempotencyKey())
                .amount(request.getAmount())
                .currency(request.getCurrency().toUpperCase())
                .sourceAccount(request.getSourceAccount())
                .destinationAccount(request.getDestinationAccount())
                .paymentMethod(request.getPaymentMethod())
                .status(PaymentStatus.CREATED)
                .reference(request.getReference())
                .build();

        applyMethodDetails(payment, request);

        payment = paymentRepository.save(payment);

        recordHistory(payment, null, PaymentStatus.CREATED, "USER", "Payment created");

        Payment saved = paymentRepository.save(payment);

        simulationService.scheduleProcessing(saved.getId());

        return PaymentResponse.from(saved);
    }

    private void applyMethodDetails(Payment payment, CreatePaymentRequest request) {
        if (request.getPaymentMethod() == PaymentMethod.UPI && request.getUpiDetails() != null) {
            payment.setUpiId(request.getUpiDetails().getUpiId());
        } else if (request.getPaymentMethod() == PaymentMethod.CARD && request.getCardDetails() != null) {
            String number = request.getCardDetails().getCardNumber();
            payment.setCardNumberMasked(maskCard(number));
            payment.setCardHolderName(request.getCardDetails().getCardHolderName());
            payment.setCardExpiry(request.getCardDetails().getCardExpiry());
            payment.setCardNetwork(detectCardNetwork(number));
        } else if (request.getPaymentMethod() == PaymentMethod.NETBANKING && request.getNetBankingDetails() != null) {
            payment.setBankName(request.getNetBankingDetails().getBankName());
            payment.setBankAccountType(request.getNetBankingDetails().getBankAccountType());
        }
    }

    private String maskCard(String cardNumber) {
        if (cardNumber == null || cardNumber.length() < 4) {
            return "****";
        }
        String last4 = cardNumber.substring(cardNumber.length() - 4);
        return "**** **** **** " + last4;
    }

    private String detectCardNetwork(String cardNumber) {
        if (cardNumber == null || cardNumber.isBlank()) return "UNKNOWN";
        if (cardNumber.startsWith("4")) return "VISA";
        if (cardNumber.matches("^5[1-5].*") || cardNumber.matches("^2[2-7].*")) return "MASTERCARD";
        if (cardNumber.startsWith("6")) return "RUPAY";
        if (cardNumber.startsWith("34") || cardNumber.startsWith("37")) return "AMEX";
        return "UNKNOWN";
    }

    @Transactional(readOnly = true)
    public PaymentResponse getPayment(String id) {
        Payment payment = findOrThrow(id);
        return PaymentResponse.from(payment);
    }

    @Transactional(readOnly = true)
    public PageResponse<PaymentResponse> listPayments(PaymentStatus status, String search, Pageable pageable) {
        Page<Payment> page = paymentRepository.search(status, (search == null || search.isBlank()) ? null : search, pageable);
        List<PaymentResponse> content = page.getContent().stream().map(PaymentResponse::from).toList();
        return PageResponse.<PaymentResponse>builder()
                .content(content)
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .last(page.isLast())
                .build();
    }

    @Transactional(readOnly = true)
    public List<StatusHistoryResponse> getHistory(String id) {
        findOrThrow(id); // ensures 404 if missing
        return historyRepository.findByPaymentIdOrderByChangedAtAsc(id).stream()
                .map(StatusHistoryResponse::from)
                .toList();
    }

    /**
     * Manually / programmatically transition a payment's status, validating
     * against the allowed state machine and recording an audit entry.
     */
    @Transactional
    public PaymentResponse updateStatus(String id, PaymentStatus newStatus, String triggeredBy, String notes,
                                         ErrorCode errorCode, String errorMessage) {
        Payment payment = findOrThrow(id);
        PaymentStatus current = payment.getStatus();

        if (current == newStatus) {
            return PaymentResponse.from(payment); // no-op / retry safe
        }

        if (!PaymentStateMachine.isValidTransition(current, newStatus)) {
            throw new InvalidStatusTransitionException(current, newStatus);
        }

        payment.setStatus(newStatus);
        if (newStatus == PaymentStatus.FAILED) {
            payment.setErrorCode(errorCode != null ? errorCode : ErrorCode.PROCESSING_ERROR);
            payment.setErrorMessage(errorMessage != null ? errorMessage : "Payment processing failed");
        }

        Payment saved = paymentRepository.save(payment);
        recordHistory(saved, current, newStatus, triggeredBy, notes);
        return PaymentResponse.from(saved);
    }

    @Transactional
    public void recordHistory(Payment payment, PaymentStatus from, PaymentStatus to, String triggeredBy, String notes) {
        PaymentStatusHistory history = PaymentStatusHistory.builder()
                .payment(payment)
                .fromStatus(from)
                .toStatus(to)
                .triggeredBy(triggeredBy)
                .notes(notes)
                .build();
        historyRepository.save(history);
    }

    private Payment findOrThrow(String id) {
        return paymentRepository.findById(id).orElseThrow(() -> new PaymentNotFoundException(id));
    }
}

