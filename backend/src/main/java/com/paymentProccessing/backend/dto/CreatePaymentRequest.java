package com.paymentProccessing.backend.dto;

import com.paymentProccessing.backend.enums.PaymentMethod;
import com.paymentProccessing.backend.enums.PaymentType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * Request payload for creating a new payment. Only the fields relevant to the
 * chosen {@link PaymentMethod} need to be supplied.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CreatePaymentRequest {

    /** Optional client supplied key to guarantee idempotent submission. */
    @Size(max = 100, message = "idempotencyKey must be at most 100 characters")
    private String idempotencyKey;

    @NotNull(message = "amount is required")
    @DecimalMin(value = "0.01", message = "amount must be greater than 0")
    @DecimalMax(value = "1000000", message = "amount must not exceed 1,000,000")
    @Digits(integer = 17, fraction = 2, message = "amount must have at most 2 decimal places")
    private BigDecimal amount;

    @NotBlank(message = "currency is required")
    @Pattern(regexp = "^[A-Z]{3}$", message = "currency must be a valid 3 letter ISO 4217 code")
    private String currency;

    @NotBlank(message = "sourceAccount is required")
    @Size(max = 40, message = "sourceAccount must be at most 40 characters")
    private String sourceAccount;

    @NotBlank(message = "destinationAccount is required")
    @Size(max = 40, message = "destinationAccount must be at most 40 characters")
    private String destinationAccount;

    @NotNull(message = "paymentMethod is required")
    private PaymentMethod paymentMethod;

    @NotNull(message = "paymentType is required (DOMESTIC or INTERNATIONAL)")
    private PaymentType paymentType;

    @Size(max = 255)
    private String reference;

    @Valid
    private UpiDetails upiDetails;

    @Valid
    private CardDetails cardDetails;

    @Valid
    private NetBankingDetails netBankingDetails;

    @Valid
    private BankTransferDetails bankTransferDetails;

    @Valid
    private InternationalTransferDetails internationalTransferDetails;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UpiDetails {
        @NotBlank(message = "upiId is required for UPI payments")
        @Pattern(regexp = "^[\\w.+-]{2,256}@[A-Za-z]{2,64}$", message = "upiId must be a valid VPA e.g. name@bank")
        private String upiId;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CardDetails {
        @NotBlank(message = "cardNumber is required for card payments")
        @Pattern(regexp = "^\\d{12,19}$", message = "cardNumber must be 12-19 digits")
        private String cardNumber;

        @NotBlank(message = "cardHolderName is required for card payments")
        private String cardHolderName;

        @NotBlank(message = "cardExpiry is required for card payments")
        @Pattern(regexp = "^(0[1-9]|1[0-2])/\\d{4}$", message = "cardExpiry must be in MM/YYYY format")
        private String cardExpiry;

        @NotBlank(message = "cvv is required for card payments")
        @Pattern(regexp = "^\\d{3,4}$", message = "cvv must be 3-4 digits")
        private String cvv;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class NetBankingDetails {
        @NotBlank(message = "bankName is required for net banking payments")
        private String bankName;

        @NotBlank(message = "bankAccountType is required for net banking payments")
        @Pattern(regexp = "^(SAVINGS|CURRENT)$", message = "bankAccountType must be SAVINGS or CURRENT")
        private String bankAccountType;
    }

    /** Used for NEFT / RTGS / IMPS domestic bank transfers. */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BankTransferDetails {
        @NotBlank(message = "senderBank is required")
        private String senderBank;

        @NotBlank(message = "beneficiaryBank is required")
        private String beneficiaryBank;

        @NotBlank(message = "ifscCode is required")
        @Size(min = 11, max = 11, message = "ifscCode must be exactly 11 characters")
        @Pattern(regexp = "^[A-Za-z]{4}0[A-Za-z0-9]{6}$", message = "ifscCode must be a valid IFSC code e.g. HDFC0001234 (4 letters + 0 + 6 alphanumeric)")
        private String ifscCode;

        /** Only required for IMPS - the beneficiary's mobile number or account number. */
        @Pattern(regexp = "^(\\d{10}|\\d{9,18})$", message = "mobileOrAccountNumber must be a 10 digit mobile number or a 9-18 digit account number")
        private String mobileOrAccountNumber;
    }

    /** Used for SWIFT / Wire international transfers. */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class InternationalTransferDetails {
        @NotBlank(message = "senderBank is required")
        private String senderBank;

        @NotBlank(message = "beneficiaryBank is required")
        private String beneficiaryBank;

        @NotBlank(message = "swiftBicCode is required")
        @Pattern(regexp = "^[A-Za-z]{6}[A-Za-z0-9]{2}([A-Za-z0-9]{3})?$",
                message = "swiftBicCode must be a valid 8 or 11 character SWIFT/BIC code e.g. HSBCGB2L or HSBCGB2LXXX")
        private String swiftBicCode;

        @NotBlank(message = "beneficiaryCountry is required")
        private String beneficiaryCountry;

        /** Required for SWIFT transfers, optional for Wire transfers. */
        private String paymentPurpose;

        /** Only applicable for Wire transfers (US ABA routing number format). */
        @Pattern(regexp = "^$|^\\d{9}$", message = "routingNumber must be exactly 9 digits if provided")
        private String routingNumber;
    }
}

