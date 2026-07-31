package com.paymentProccessing.backend.service;

import com.paymentProccessing.backend.dto.CreatePaymentRequest;
import com.paymentProccessing.backend.enums.ErrorCode;
import com.paymentProccessing.backend.enums.PaymentMethod;
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
        request.setSourceAccount("acc-1");
        request.setDestinationAccount("acc-2");
        request.setPaymentMethod(PaymentMethod.UPI);
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
}

