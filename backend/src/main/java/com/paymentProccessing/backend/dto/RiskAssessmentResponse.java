package com.paymentProccessing.backend.dto;

import com.paymentProccessing.backend.entity.RiskAssessment;
import com.paymentProccessing.backend.enums.RiskLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RiskAssessmentResponse {

    private Long assessmentId;
    private String paymentId;
    private Integer riskScore;
    private RiskLevel riskLevel;
    private List<String> triggeredRules;
    private Instant assessmentTimestamp;
    private String decision;

    public static RiskAssessmentResponse from(RiskAssessment r) {
        return RiskAssessmentResponse.builder()
                .assessmentId(r.getAssessmentId())
                .paymentId(r.getPayment().getId())
                .riskScore(r.getRiskScore())
                .riskLevel(r.getRiskLevel())
                .triggeredRules(r.getTriggeredRulesList())
                .assessmentTimestamp(r.getAssessmentTimestamp())
                .decision(r.getDecision())
                .build();
    }
}

