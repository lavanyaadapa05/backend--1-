package com.paymentProccessing.backend.repository;

import com.paymentProccessing.backend.entity.RiskAssessment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RiskAssessmentRepository extends JpaRepository<RiskAssessment, Long> {

    List<RiskAssessment> findByPaymentIdOrderByAssessmentTimestampAsc(String paymentId);

    Optional<RiskAssessment> findTopByPaymentIdOrderByAssessmentTimestampDesc(String paymentId);
}

