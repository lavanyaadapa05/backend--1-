package com.paymentProccessing.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Body for a bank operator's decision on a MEDIUM-risk payment held for review.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class RiskDecisionRequest {

    @NotBlank(message = "decision is required")
    @Pattern(regexp = "APPROVE|REJECT", message = "decision must be APPROVE or REJECT")
    private String decision;

    private String notes;
}

