package com.paymentProccessing.backend.service;

import com.paymentProccessing.backend.dto.CreatePaymentRequest;
import com.paymentProccessing.backend.enums.ErrorCode;
import com.paymentProccessing.backend.enums.PaymentMethod;
import com.paymentProccessing.backend.enums.PaymentType;
import com.paymentProccessing.backend.exception.PaymentApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PaymentValidationServiceTest {

    private PaymentValidationService service;

    @BeforeEach
    void setUp() {
        service = new PaymentValidationService();
    }

    private CreatePaymentRequest validUpiRequest() {
        CreatePaymentRequest request = new CreatePaymentRequest();
        request.setAmount(new BigDecimal("100.00"));
        request.setCurrency("INR");
        request.setSourceAccount("payer@upi");
        request.setDestinationAccount("payee@upi");
        request.setPaymentMethod(PaymentMethod.UPI);
        request.setPaymentType(PaymentType.DOMESTIC);
        CreatePaymentRequest.UpiDetails upi = new CreatePaymentRequest.UpiDetails();
        upi.setUpiId("john@upi");
        request.setUpiDetails(upi);
        return request;
    }

    @Test
    void validRequestPassesValidation() {
        assertThatCode(() -> service.validate(validUpiRequest()));
    }

    private void assertThatCode(Runnable runnable) {
        runnable.run();
    }

    @Test
    void negativeAmountIsRejected() {
        CreatePaymentRequest req = validUpiRequest();
        req.setAmount(new BigDecimal("-5"));
        assertThatThrownBy(() -> service.validate(req))
                .isInstanceOf(PaymentApiException.class)
                .satisfies(ex -> assertThat(((PaymentApiException) ex).getErrorCode()).isEqualTo(ErrorCode.INVALID_AMOUNT));
    }

    @Test
    void zeroAmountIsRejected() {
        CreatePaymentRequest req = validUpiRequest();
        req.setAmount(BigDecimal.ZERO);
        assertThatThrownBy(() -> service.validate(req)).isInstanceOf(PaymentApiException.class);
    }

    @Test
    void amountOverLimitIsRejected() {
        CreatePaymentRequest req = validUpiRequest();
        req.setAmount(new BigDecimal("1000001"));
        assertThatThrownBy(() -> service.validate(req)).isInstanceOf(PaymentApiException.class);
    }

    @Test
    void unsupportedCurrencyIsRejected() {
        CreatePaymentRequest req = validUpiRequest();
        req.setCurrency("XYZ");
        assertThatThrownBy(() -> service.validate(req))
                .isInstanceOf(PaymentApiException.class)
                .satisfies(ex -> assertThat(((PaymentApiException) ex).getErrorCode()).isEqualTo(ErrorCode.INVALID_CURRENCY));
    }

    @Test
    void sameSourceAndDestinationIsRejected() {
        CreatePaymentRequest req = validUpiRequest();
        req.setDestinationAccount(req.getSourceAccount());
        assertThatThrownBy(() -> service.validate(req))
                .isInstanceOf(PaymentApiException.class)
                .satisfies(ex -> assertThat(((PaymentApiException) ex).getErrorCode()).isEqualTo(ErrorCode.INVALID_ACCOUNT));
    }

    @Test
    void upiWithoutUpiIdIsRejected() {
        CreatePaymentRequest req = validUpiRequest();
        req.setUpiDetails(null);
        assertThatThrownBy(() -> service.validate(req))
                .isInstanceOf(PaymentApiException.class)
                .satisfies(ex -> assertThat(((PaymentApiException) ex).getErrorCode()).isEqualTo(ErrorCode.INVALID_PAYMENT_METHOD));
    }

    @Test
    void expiredCardIsRejected() {
        CreatePaymentRequest req = validUpiRequest();
        req.setPaymentMethod(PaymentMethod.CARD);
        req.setUpiDetails(null);
        CreatePaymentRequest.CardDetails card = new CreatePaymentRequest.CardDetails();
        card.setCardNumber("4111111111111111");
        card.setCardHolderName("John Doe");
        card.setCardExpiry("01/2020");
        card.setCvv("123");
        req.setCardDetails(card);
        assertThatThrownBy(() -> service.validate(req)).isInstanceOf(PaymentApiException.class);
    }

    private CreatePaymentRequest.BankTransferDetails validBankTransferDetails() {
        CreatePaymentRequest.BankTransferDetails details = new CreatePaymentRequest.BankTransferDetails();
        details.setSenderBank("HDFC Bank");
        details.setBeneficiaryBank("ICICI Bank");
        details.setIfscCode("HDFC0001234");
        return details;
    }

    private CreatePaymentRequest neftRequest(BigDecimal amount) {
        CreatePaymentRequest request = new CreatePaymentRequest();
        request.setAmount(amount);
        request.setCurrency("INR");
        request.setSourceAccount("123456789012");
        request.setDestinationAccount("987654321098");
        request.setPaymentMethod(PaymentMethod.NEFT);
        request.setPaymentType(PaymentType.DOMESTIC);
        request.setBankTransferDetails(validBankTransferDetails());
        return request;
    }

    @Test
    void rtgsBelowMinimumAmountIsRejected() {
        CreatePaymentRequest request = neftRequest(new BigDecimal("50000"));
        request.setPaymentMethod(PaymentMethod.RTGS);
        assertThatThrownBy(() -> service.validate(request))
                .isInstanceOf(PaymentApiException.class)
                .satisfies(ex -> assertThat(((PaymentApiException) ex).getErrorCode()).isEqualTo(ErrorCode.INVALID_AMOUNT));
    }

    @Test
    void rtgsAtOrAboveMinimumAmountPasses() {
        CreatePaymentRequest request = neftRequest(new BigDecimal("200000"));
        request.setPaymentMethod(PaymentMethod.RTGS);
        assertThatCode(() -> service.validate(request));
    }

    @Test
    void upiOverStandardCapIsRejected() {
        CreatePaymentRequest request = validUpiRequest();
        request.setAmount(new BigDecimal("150000"));
        assertThatThrownBy(() -> service.validate(request))
                .isInstanceOf(PaymentApiException.class)
                .satisfies(ex -> assertThat(((PaymentApiException) ex).getErrorCode()).isEqualTo(ErrorCode.INVALID_AMOUNT));
    }

    @Test
    void invalidIfscCodeIsRejected() {
        CreatePaymentRequest request = neftRequest(new BigDecimal("5000"));
        request.getBankTransferDetails().setIfscCode("BADCODE");
        assertThatThrownBy(() -> service.validate(request))
                .isInstanceOf(PaymentApiException.class)
                .satisfies(ex -> assertThat(((PaymentApiException) ex).getErrorCode()).isEqualTo(ErrorCode.INVALID_PAYMENT_METHOD));
    }

    @Test
    void nonNumericAccountNumberIsRejectedForBankTransfer() {
        CreatePaymentRequest request = neftRequest(new BigDecimal("5000"));
        request.setSourceAccount("not-a-number");
        assertThatThrownBy(() -> service.validate(request))
                .isInstanceOf(PaymentApiException.class)
                .satisfies(ex -> assertThat(((PaymentApiException) ex).getErrorCode()).isEqualTo(ErrorCode.INVALID_ACCOUNT));
    }

    @Test
    void domesticPaymentTypeWithInternationalChannelIsRejected() {
        CreatePaymentRequest request = neftRequest(new BigDecimal("5000"));
        request.setPaymentMethod(PaymentMethod.SWIFT);
        CreatePaymentRequest.InternationalTransferDetails intl = new CreatePaymentRequest.InternationalTransferDetails();
        intl.setSenderBank("HSBC");
        intl.setBeneficiaryBank("Citi");
        intl.setSwiftBicCode("HSBCGB2L");
        intl.setBeneficiaryCountry("United States");
        intl.setPaymentPurpose("Business Services");
        request.setInternationalTransferDetails(intl);
        assertThatThrownBy(() -> service.validate(request))
                .isInstanceOf(PaymentApiException.class)
                .satisfies(ex -> assertThat(((PaymentApiException) ex).getErrorCode()).isEqualTo(ErrorCode.INVALID_PAYMENT_METHOD));
    }
}

