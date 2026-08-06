package com.paymentProccessing.backend.service;

import com.paymentProccessing.backend.dto.CreatePaymentRequest;
import com.paymentProccessing.backend.dto.PageResponse;
import com.paymentProccessing.backend.dto.PaymentResponse;
import com.paymentProccessing.backend.dto.RiskAssessmentResponse;
import com.paymentProccessing.backend.dto.StatusHistoryResponse;
import com.paymentProccessing.backend.entity.Payment;
import com.paymentProccessing.backend.entity.PaymentStatusHistory;
import com.paymentProccessing.backend.entity.RiskAssessment;
import com.paymentProccessing.backend.enums.ErrorCode;
import com.paymentProccessing.backend.enums.FraudStatus;
import com.paymentProccessing.backend.enums.PaymentMethod;
import com.paymentProccessing.backend.enums.PaymentStatus;
import com.paymentProccessing.backend.enums.RiskLevel;
import com.paymentProccessing.backend.exception.InvalidStatusTransitionException;
import com.paymentProccessing.backend.exception.PaymentApiException;
import com.paymentProccessing.backend.exception.PaymentNotFoundException;
import com.paymentProccessing.backend.repository.PaymentRepository;
import com.paymentProccessing.backend.repository.PaymentStatusHistoryRepository;
import com.paymentProccessing.backend.repository.RiskAssessmentRepository;
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
    private final FraudDetectionService fraudDetectionService;
    private final RiskAssessmentRepository riskAssessmentRepository;

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
                .customerId(request.getCustomerId() == null || request.getCustomerId().isBlank() ? "DEMO-CUSTOMER" : request.getCustomerId())
                .amount(request.getAmount())
                .currency(request.getCurrency().toUpperCase())
                .sourceAccount(request.getSourceAccount())
                .destinationAccount(request.getDestinationAccount())
                .paymentMethod(request.getPaymentMethod())
                .paymentType(request.getPaymentType())
                .status(PaymentStatus.CREATED)
                .reference(request.getReference())
                .build();

        applyMethodDetails(payment, request);

        // ---- Fraud / risk screening (runs before the payment is even persisted) ----
        FraudDetectionService.RiskAssessmentResult risk = fraudDetectionService.assess(payment);
        payment.setRiskScore(risk.getScore());
        payment.setRiskLevel(risk.getLevel());

        String decision;
        if (risk.getLevel() == RiskLevel.HIGH) {
            payment.setFraudStatus(FraudStatus.BLOCKED);
            payment.setStatus(PaymentStatus.FAILED);
            payment.setErrorCode(ErrorCode.FRAUD_BLOCKED);
            payment.setErrorMessage("Payment blocked due to high fraud risk.");
            decision = "AUTO_BLOCKED";
        } else if (risk.getLevel() == RiskLevel.MEDIUM) {
            payment.setFraudStatus(FraudStatus.UNDER_REVIEW);
            decision = "PENDING_REVIEW";
        } else {
            payment.setFraudStatus(FraudStatus.CLEARED);
            decision = "AUTO_CLEARED";
        }

        Payment saved = paymentRepository.save(payment);

        RiskAssessment assessment = RiskAssessment.builder()
                .payment(saved)
                .riskScore(risk.getScore())
                .riskLevel(risk.getLevel())
                .triggeredRules(RiskAssessment.joinRules(risk.getTriggeredRules()))
                .decision(decision)
                .build();
        riskAssessmentRepository.save(assessment);

        recordHistory(saved, null, saved.getStatus(), "USER", "Payment created");
        recordAudit(saved, "Fraud validation completed", "FRAUD_ENGINE",
                "Risk score " + risk.getScore() + "/100 (" + risk.getLevel() + ")");
        recordAudit(saved, "Risk score generated", "FRAUD_ENGINE", String.join("; ", risk.getTriggeredRules()));

        if (risk.getLevel() == RiskLevel.HIGH) {
            recordAudit(saved, "Payment blocked due to fraud risk", "FRAUD_ENGINE",
                    "Automatically blocked — risk score " + risk.getScore() + "/100");
        } else if (risk.getLevel() == RiskLevel.MEDIUM) {
            recordAudit(saved, "Payment flagged for review", "FRAUD_ENGINE",
                    "Held for bank operator review — risk score " + risk.getScore() + "/100");
        }

        if (risk.getLevel() == RiskLevel.LOW) {
            simulationService.scheduleProcessing(saved.getId());
        }

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
        } else if ((request.getPaymentMethod() == PaymentMethod.NEFT
                || request.getPaymentMethod() == PaymentMethod.RTGS
                || request.getPaymentMethod() == PaymentMethod.IMPS)
                && request.getBankTransferDetails() != null) {
            var details = request.getBankTransferDetails();
            payment.setSenderBankName(details.getSenderBank());
            payment.setBeneficiaryBankName(details.getBeneficiaryBank());
            payment.setIfscCode(details.getIfscCode());
            payment.setMobileOrAccountNumber(details.getMobileOrAccountNumber());
        } else if ((request.getPaymentMethod() == PaymentMethod.SWIFT
                || request.getPaymentMethod() == PaymentMethod.WIRE_TRANSFER)
                && request.getInternationalTransferDetails() != null) {
            var details = request.getInternationalTransferDetails();
            payment.setSenderBankName(details.getSenderBank());
            payment.setBeneficiaryBankName(details.getBeneficiaryBank());
            payment.setSwiftBicCode(details.getSwiftBicCode());
            payment.setBeneficiaryCountry(details.getBeneficiaryCountry());
            payment.setPaymentPurpose(details.getPaymentPurpose());
            payment.setRoutingNumber(details.getRoutingNumber());
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
    public PageResponse<PaymentResponse> listPayments(PaymentStatus status, RiskLevel riskLevel, String search, String customerId, Pageable pageable) {
        Page<Payment> page = paymentRepository.search(status, riskLevel, (search == null || search.isBlank()) ? null : search,
                (customerId == null || customerId.isBlank()) ? null : customerId, pageable);
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

    /** Latest fraud/risk assessment for a payment, for the Risk Assessment UI section. */
    @Transactional(readOnly = true)
    public RiskAssessmentResponse getRisk(String id) {
        findOrThrow(id); // ensures 404 if missing
        return riskAssessmentRepository.findTopByPaymentIdOrderByAssessmentTimestampDesc(id)
                .map(RiskAssessmentResponse::from)
                .orElseThrow(() -> new PaymentApiException(ErrorCode.PAYMENT_NOT_FOUND, "No risk assessment found for payment " + id));
    }

    /**
     * Bank operator decision (APPROVE/REJECT) on a MEDIUM-risk payment that is
     * currently held UNDER_REVIEW. Approving resumes normal processing;
     * rejecting fails the payment permanently.
     */
    @Transactional
    public PaymentResponse decideRisk(String id, String decision, String triggeredBy, String notes) {
        Payment payment = findOrThrow(id);
        if (payment.getFraudStatus() != FraudStatus.UNDER_REVIEW) {
            throw new PaymentApiException(ErrorCode.INVALID_STATUS_TRANSITION,
                    "Payment is not currently pending fraud review (fraudStatus=" + payment.getFraudStatus() + ")");
        }

        riskAssessmentRepository.findTopByPaymentIdOrderByAssessmentTimestampDesc(id).ifPresent(assessment -> {
            assessment.setDecision("APPROVE".equalsIgnoreCase(decision) ? "APPROVED" : "REJECTED");
            riskAssessmentRepository.save(assessment);
        });

        if ("APPROVE".equalsIgnoreCase(decision)) {
            payment.setFraudStatus(FraudStatus.CLEARED);
            Payment saved = paymentRepository.save(payment);
            recordAudit(saved, "Payment approved after review", triggeredBy,
                    notes != null && !notes.isBlank() ? notes : "Approved by bank operations after manual review");
            simulationService.scheduleProcessing(saved.getId());
            return PaymentResponse.from(saved);
        } else {
            PaymentStatus current = payment.getStatus();
            payment.setFraudStatus(FraudStatus.BLOCKED);
            payment.setStatus(PaymentStatus.FAILED);
            payment.setErrorCode(ErrorCode.FRAUD_REJECTED);
            payment.setErrorMessage("Payment rejected by operations team after fraud review.");
            Payment saved = paymentRepository.save(payment);
            recordHistory(saved, current, PaymentStatus.FAILED, triggeredBy,
                    notes != null && !notes.isBlank() ? notes : "Rejected after fraud review");
            return PaymentResponse.from(saved);
        }
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

    /** Records a non-state-transition audit event (e.g. fraud/risk events) with a custom action label. */
    @Transactional
    public void recordAudit(Payment payment, String action, String triggeredBy, String notes) {
        PaymentStatusHistory history = PaymentStatusHistory.builder()
                .payment(payment)
                .fromStatus(payment.getStatus())
                .toStatus(payment.getStatus())
                .triggeredBy(triggeredBy)
                .notes(notes)
                .actionOverride(action)
                .build();
        historyRepository.save(history);
    }

    private Payment findOrThrow(String id) {
        return paymentRepository.findById(id).orElseThrow(() -> new PaymentNotFoundException(id));
    }
}




