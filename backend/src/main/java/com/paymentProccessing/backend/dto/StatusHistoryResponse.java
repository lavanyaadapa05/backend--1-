package com.paymentProccessing.backend.dto;

import com.paymentProccessing.backend.entity.PaymentStatusHistory;
import com.paymentProccessing.backend.enums.PaymentStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StatusHistoryResponse {

    private Long id;
    private PaymentStatus fromStatus;
    private PaymentStatus toStatus;
    private String triggeredBy;
    private String notes;
    private Instant changedAt;

    public static StatusHistoryResponse from(PaymentStatusHistory h) {
        return StatusHistoryResponse.builder()
                .id(h.getId())
                .fromStatus(h.getFromStatus())
                .toStatus(h.getToStatus())
                .triggeredBy(h.getTriggeredBy())
                .notes(h.getNotes())
                .changedAt(h.getChangedAt())
                .build();
    }
}

