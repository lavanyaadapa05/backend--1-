package com.paymentProccessing.backend.service;

import com.paymentProccessing.backend.dto.CreatePaymentRequest;
import com.paymentProccessing.backend.enums.ErrorCode;
import com.paymentProccessing.backend.enums.PaymentMethod;
import com.paymentProccessing.backend.enums.PaymentType;
import com.paymentProccessing.backend.exception.PaymentValidationException;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Business validation rules beyond simple bean-validation annotations
 * (Appendix C). Also encodes real-world payment-network business rules
 * (RTGS minimum amount, UPI/IMPS per-transaction caps, account number
 * formats) so the system behaves like a real payments processor rather than
 * a generic form.
 */
@Component
public class PaymentValidationService {

    private static final Set<String> SUPPORTED_CURRENCIES = Set.of(
            "USD", "EUR", "GBP", "INR", "JPY", "AUD", "CAD", "SGD", "AED", "CHF"
    );

    private static final BigDecimal MAX_AMOUNT = new BigDecimal("1000000");

    // ---------- Real-world payment network limits (Appendix: UPI/NEFT/RTGS/IMPS rules) ----------
    private static final BigDecimal RTGS_MIN_AMOUNT = new BigDecimal("200000"); // RTGS mandates a min of ₹2,00,000
    private static final BigDecimal UPI_MAX_AMOUNT = new BigDecimal("100000");  // Standard UPI per-txn cap
    private static final BigDecimal IMPS_MAX_AMOUNT = new BigDecimal("500000"); // Standard IMPS per-txn cap

    private static final Pattern DOMESTIC_ACCOUNT_NUMBER = Pattern.compile("^\\d{9,18}$");
    private static final Pattern UPI_VPA = Pattern.compile("^[\\w.+-]{2,256}@[A-Za-z]{2,64}$");
    private static final Pattern IFSC_CODE = Pattern.compile("^[A-Za-z]{4}0[A-Za-z0-9]{6}$");
    private static final Pattern SWIFT_BIC = Pattern.compile("^[A-Za-z]{6}[A-Za-z0-9]{2}([A-Za-z0-9]{3})?$");
    private static final Pattern MOBILE_OR_ACCOUNT = Pattern.compile("^(\\d{10}|\\d{9,18})$");
    private static final Pattern ROUTING_NUMBER = Pattern.compile("^\\d{9}$");

    public void validate(CreatePaymentRequest request) {
        validateAmount(request.getAmount());
        validateCurrency(request.getCurrency());
        validateAccounts(request.getSourceAccount(), request.getDestinationAccount());
        validatePaymentTypeConsistency(request);
        validatePaymentMethodDetails(request);
        validateChannelAmountRules(request);
        validateAccountNumberFormats(request);
    }

    private void validateAmount(BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new PaymentValidationException(ErrorCode.INVALID_AMOUNT, "Amount must be greater than 0");
        }
        if (amount.compareTo(MAX_AMOUNT) > 0) {
            throw new PaymentValidationException(ErrorCode.INVALID_AMOUNT, "Amount must not exceed 1,000,000");
        }
        if (amount.scale() > 2) {
            throw new PaymentValidationException(ErrorCode.INVALID_AMOUNT, "Amount must have at most 2 decimal places");
        }
    }

    private void validateCurrency(String currency) {
        if (currency == null || !SUPPORTED_CURRENCIES.contains(currency.toUpperCase())) {
            throw new PaymentValidationException(ErrorCode.INVALID_CURRENCY,
                    "Currency '" + currency + "' is not supported");
        }
    }

    private void validateAccounts(String source, String destination) {
        if (source == null || destination == null || source.isBlank() || destination.isBlank()) {
            throw new PaymentValidationException(ErrorCode.INVALID_ACCOUNT, "Source and destination accounts are required");
        }
        if (source.trim().equalsIgnoreCase(destination.trim())) {
            throw new PaymentValidationException(ErrorCode.INVALID_ACCOUNT,
                    "Source and destination accounts must be different");
        }
    }

    /** Ensures the chosen channel actually belongs to the declared payment type (e.g. can't pick SWIFT under DOMESTIC). */
    private void validatePaymentTypeConsistency(CreatePaymentRequest request) {
        PaymentType type = request.getPaymentType();
        PaymentMethod method = request.getPaymentMethod();
        if (type == null || method == null) {
            return; // caught by @NotNull bean validation already
        }
        boolean isInternationalChannel = method == PaymentMethod.SWIFT || method == PaymentMethod.WIRE_TRANSFER;
        if (type == PaymentType.DOMESTIC && isInternationalChannel) {
            throw new PaymentValidationException(ErrorCode.INVALID_PAYMENT_METHOD,
                    method + " is an international channel and cannot be used with paymentType DOMESTIC");
        }
        if (type == PaymentType.INTERNATIONAL && !isInternationalChannel) {
            throw new PaymentValidationException(ErrorCode.INVALID_PAYMENT_METHOD,
                    method + " is a domestic channel and cannot be used with paymentType INTERNATIONAL");
        }
    }

    /**
     * Enforces real UPI/NEFT/RTGS/IMPS network rules:
     * - RTGS requires a minimum of ₹2,00,000 per transaction (real NPCI/RBI rule).
     * - UPI is capped at ₹1,00,000 per transaction for standard retail transfers.
     * - IMPS is capped at ₹5,00,000 per transaction.
     */
    private void validateChannelAmountRules(CreatePaymentRequest request) {
        BigDecimal amount = request.getAmount();
        if (amount == null || request.getPaymentMethod() == null) {
            return;
        }
        switch (request.getPaymentMethod()) {
            case RTGS -> {
                if (amount.compareTo(RTGS_MIN_AMOUNT) < 0) {
                    throw new PaymentValidationException(ErrorCode.INVALID_AMOUNT,
                            "RTGS requires a minimum amount of ₹2,00,000 per transaction");
                }
            }
            case UPI -> {
                if (amount.compareTo(UPI_MAX_AMOUNT) > 0) {
                    throw new PaymentValidationException(ErrorCode.INVALID_AMOUNT,
                            "UPI transactions cannot exceed ₹1,00,000 per transaction");
                }
            }
            case IMPS -> {
                if (amount.compareTo(IMPS_MAX_AMOUNT) > 0) {
                    throw new PaymentValidationException(ErrorCode.INVALID_AMOUNT,
                            "IMPS transactions cannot exceed ₹5,00,000 per transaction");
                }
            }
            default -> { /* NEFT, SWIFT, WIRE_TRANSFER, CARD, NETBANKING have no extra tier rule here */ }
        }
    }

    /**
     * Validates the source/destination account identifiers match the format
     * expected for the chosen channel (VPA for UPI, 9-18 digit numeric
     * account number for bank-transfer channels).
     */
    private void validateAccountNumberFormats(CreatePaymentRequest request) {
        PaymentMethod method = request.getPaymentMethod();
        if (method == null) return;
        String source = request.getSourceAccount();
        String destination = request.getDestinationAccount();

        if (method == PaymentMethod.UPI) {
            if (source != null && !UPI_VPA.matcher(source.trim()).matches()) {
                throw new PaymentValidationException(ErrorCode.INVALID_ACCOUNT,
                        "sourceAccount must be a valid UPI VPA e.g. name@bank");
            }
            if (destination != null && !UPI_VPA.matcher(destination.trim()).matches()) {
                throw new PaymentValidationException(ErrorCode.INVALID_ACCOUNT,
                        "destinationAccount must be a valid UPI VPA e.g. name@bank");
            }
        } else if (method == PaymentMethod.NEFT || method == PaymentMethod.RTGS || method == PaymentMethod.IMPS
                || method == PaymentMethod.SWIFT || method == PaymentMethod.WIRE_TRANSFER) {
            if (source != null && !DOMESTIC_ACCOUNT_NUMBER.matcher(source.trim()).matches()) {
                throw new PaymentValidationException(ErrorCode.INVALID_ACCOUNT,
                        "sourceAccount (sender account number) must be 9-18 digits");
            }
            if (destination != null && !DOMESTIC_ACCOUNT_NUMBER.matcher(destination.trim()).matches()) {
                throw new PaymentValidationException(ErrorCode.INVALID_ACCOUNT,
                        "destinationAccount (beneficiary account number) must be 9-18 digits");
            }
        }
    }

    private void validatePaymentMethodDetails(CreatePaymentRequest request) {
        switch (request.getPaymentMethod()) {
            case UPI -> {
                if (request.getUpiDetails() == null || request.getUpiDetails().getUpiId() == null
                        || request.getUpiDetails().getUpiId().isBlank()) {
                    throw new PaymentValidationException(ErrorCode.INVALID_PAYMENT_METHOD,
                            "upiDetails.upiId is required for UPI payments");
                }
            }
            case CARD -> {
                if (request.getCardDetails() == null
                        || isBlank(request.getCardDetails().getCardNumber())
                        || isBlank(request.getCardDetails().getCardHolderName())
                        || isBlank(request.getCardDetails().getCardExpiry())
                        || isBlank(request.getCardDetails().getCvv())) {
                    throw new PaymentValidationException(ErrorCode.INVALID_PAYMENT_METHOD,
                            "cardDetails (cardNumber, cardHolderName, cardExpiry, cvv) is required for card payments");
                }
                if (!isCardNotExpired(request.getCardDetails().getCardExpiry())) {
                    throw new PaymentValidationException(ErrorCode.INVALID_PAYMENT_METHOD, "Card has expired");
                }
            }
            case NETBANKING -> {
                if (request.getNetBankingDetails() == null
                        || isBlank(request.getNetBankingDetails().getBankName())
                        || isBlank(request.getNetBankingDetails().getBankAccountType())) {
                    throw new PaymentValidationException(ErrorCode.INVALID_PAYMENT_METHOD,
                            "netBankingDetails (bankName, bankAccountType) is required for net banking payments");
                }
            }
            case NEFT, RTGS -> {
                var details = request.getBankTransferDetails();
                if (details == null || isBlank(details.getSenderBank()) || isBlank(details.getBeneficiaryBank())
                        || isBlank(details.getIfscCode())) {
                    throw new PaymentValidationException(ErrorCode.INVALID_PAYMENT_METHOD,
                            "bankTransferDetails (senderBank, beneficiaryBank, ifscCode) is required for " + request.getPaymentMethod() + " payments");
                }
                validateIfscFormat(details.getIfscCode());
            }
            case IMPS -> {
                var details = request.getBankTransferDetails();
                if (details == null || isBlank(details.getSenderBank()) || isBlank(details.getBeneficiaryBank())
                        || isBlank(details.getIfscCode()) || isBlank(details.getMobileOrAccountNumber())) {
                    throw new PaymentValidationException(ErrorCode.INVALID_PAYMENT_METHOD,
                            "bankTransferDetails (senderBank, beneficiaryBank, ifscCode, mobileOrAccountNumber) is required for IMPS payments");
                }
                validateIfscFormat(details.getIfscCode());
                if (!MOBILE_OR_ACCOUNT.matcher(details.getMobileOrAccountNumber().trim()).matches()) {
                    throw new PaymentValidationException(ErrorCode.INVALID_PAYMENT_METHOD,
                            "mobileOrAccountNumber must be a 10 digit mobile number or a 9-18 digit account number");
                }
            }
            case SWIFT -> {
                var details = request.getInternationalTransferDetails();
                if (details == null || isBlank(details.getSenderBank()) || isBlank(details.getBeneficiaryBank())
                        || isBlank(details.getSwiftBicCode()) || isBlank(details.getBeneficiaryCountry())
                        || isBlank(details.getPaymentPurpose())) {
                    throw new PaymentValidationException(ErrorCode.INVALID_PAYMENT_METHOD,
                            "internationalTransferDetails (senderBank, beneficiaryBank, swiftBicCode, beneficiaryCountry, paymentPurpose) is required for SWIFT payments");
                }
                validateSwiftBicFormat(details.getSwiftBicCode());
            }
            case WIRE_TRANSFER -> {
                var details = request.getInternationalTransferDetails();
                if (details == null || isBlank(details.getSenderBank()) || isBlank(details.getBeneficiaryBank())
                        || isBlank(details.getSwiftBicCode()) || isBlank(details.getBeneficiaryCountry())) {
                    throw new PaymentValidationException(ErrorCode.INVALID_PAYMENT_METHOD,
                            "internationalTransferDetails (senderBank, beneficiaryBank, swiftBicCode, beneficiaryCountry) is required for Wire Transfer payments");
                }
                validateSwiftBicFormat(details.getSwiftBicCode());
                if (!isBlank(details.getRoutingNumber()) && !ROUTING_NUMBER.matcher(details.getRoutingNumber().trim()).matches()) {
                    throw new PaymentValidationException(ErrorCode.INVALID_PAYMENT_METHOD,
                            "routingNumber must be exactly 9 digits if provided");
                }
            }
            default -> throw new PaymentValidationException(ErrorCode.INVALID_PAYMENT_METHOD, "Unsupported payment method");
        }
    }

    private void validateIfscFormat(String ifscCode) {
        if (!IFSC_CODE.matcher(ifscCode.trim()).matches()) {
            throw new PaymentValidationException(ErrorCode.INVALID_PAYMENT_METHOD,
                    "ifscCode must be a valid 11 character IFSC code e.g. HDFC0001234 (4 letters + 0 + 6 alphanumeric)");
        }
    }

    private void validateSwiftBicFormat(String swiftBicCode) {
        if (!SWIFT_BIC.matcher(swiftBicCode.trim()).matches()) {
            throw new PaymentValidationException(ErrorCode.INVALID_PAYMENT_METHOD,
                    "swiftBicCode must be a valid 8 or 11 character SWIFT/BIC code e.g. HSBCGB2L or HSBCGB2LXXX");
        }
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private boolean isCardNotExpired(String expiry) {
        try {
            String[] parts = expiry.split("/");
            int month = Integer.parseInt(parts[0]);
            int year = Integer.parseInt(parts[1]);
            java.time.YearMonth cardMonth = java.time.YearMonth.of(year, month);
            return !cardMonth.isBefore(java.time.YearMonth.now());
        } catch (Exception e) {
            return false;
        }
    }
}

