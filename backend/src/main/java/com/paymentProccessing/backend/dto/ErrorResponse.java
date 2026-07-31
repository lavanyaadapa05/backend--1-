package com.paymentProccessing.backend.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.paymentProccessing.backend.enums.ErrorCode;
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
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ErrorResponse {

    private Instant timestamp;
    private int status;
    private ErrorCode errorCode;
    private String message;
    private String path;
    private List<String> details;
}

