package com.paymentProccessing.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.paymentProccessing.backend.dto.CreatePaymentRequest;
import com.paymentProccessing.backend.dto.PaymentResponse;
import com.paymentProccessing.backend.dto.StatusUpdateRequest;
import com.paymentProccessing.backend.enums.ErrorCode;
import com.paymentProccessing.backend.enums.PaymentMethod;
import com.paymentProccessing.backend.enums.PaymentStatus;
import com.paymentProccessing.backend.enums.PaymentType;
import com.paymentProccessing.backend.exception.InvalidStatusTransitionException;
import com.paymentProccessing.backend.exception.PaymentNotFoundException;
import com.paymentProccessing.backend.service.PaymentService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.Instant;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(PaymentController.class)
class PaymentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private PaymentService paymentService;

    private PaymentResponse sampleResponse(String id, PaymentStatus status) {
        return PaymentResponse.builder()
                .id(id)
                .amount(new BigDecimal("100.00"))
                .currency("INR")
                .sourceAccount("a")
                .destinationAccount("b")
                .paymentMethod(PaymentMethod.UPI)
                .status(status)
                .upiId("john@upi")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }

    private CreatePaymentRequest validRequest() {
        CreatePaymentRequest request = new CreatePaymentRequest();
        request.setAmount(new BigDecimal("100.00"));
        request.setCurrency("INR");
        request.setSourceAccount("acc-1");
        request.setDestinationAccount("acc-2");
        request.setPaymentMethod(PaymentMethod.UPI);
        request.setPaymentType(PaymentType.DOMESTIC);
        CreatePaymentRequest.UpiDetails upi = new CreatePaymentRequest.UpiDetails();
        upi.setUpiId("john@upi");
        request.setUpiDetails(upi);
        return request;
    }

    @Test
    void createPaymentReturns201() throws Exception {
        when(paymentService.createPayment(any())).thenReturn(sampleResponse("p1", PaymentStatus.CREATED));

        mockMvc.perform(post("/api/payments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validRequest())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("p1"))
                .andExpect(jsonPath("$.status").value("CREATED"));
    }

    @Test
    void createPaymentWithInvalidAmountReturns400() throws Exception {
        CreatePaymentRequest request = validRequest();
        request.setAmount(new BigDecimal("-1"));

        mockMvc.perform(post("/api/payments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
    }

    @Test
    void getPaymentReturns200() throws Exception {
        when(paymentService.getPayment("p1")).thenReturn(sampleResponse("p1", PaymentStatus.VALIDATED));

        mockMvc.perform(get("/api/payments/p1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("VALIDATED"));
    }

    @Test
    void getPaymentReturns404WhenNotFound() throws Exception {
        when(paymentService.getPayment("missing")).thenThrow(new PaymentNotFoundException("missing"));

        mockMvc.perform(get("/api/payments/missing"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode").value("PAYMENT_NOT_FOUND"));
    }

    @Test
    void updateStatusWithInvalidTransitionReturns400() throws Exception {
        when(paymentService.updateStatus(anyString(), any(), anyString(), any(), any(), any()))
                .thenThrow(new InvalidStatusTransitionException(PaymentStatus.COMPLETED, PaymentStatus.CREATED));

        StatusUpdateRequest req = new StatusUpdateRequest();
        req.setStatus(PaymentStatus.CREATED);

        mockMvc.perform(patch("/api/payments/p1/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("INVALID_STATUS_TRANSITION"));
    }

    @Test
    void updateStatusSuccessReturns200() throws Exception {
        when(paymentService.updateStatus(anyString(), any(), anyString(), any(), any(), any()))
                .thenReturn(sampleResponse("p1", PaymentStatus.FAILED));

        StatusUpdateRequest req = new StatusUpdateRequest();
        req.setStatus(PaymentStatus.FAILED);

        mockMvc.perform(patch("/api/payments/p1/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("FAILED"));
    }
}

