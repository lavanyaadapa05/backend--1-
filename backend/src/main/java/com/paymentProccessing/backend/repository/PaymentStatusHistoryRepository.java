package com.paymentProccessing.backend.repository;

import com.paymentProccessing.backend.entity.PaymentStatusHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PaymentStatusHistoryRepository extends JpaRepository<PaymentStatusHistory, Long> {

    List<PaymentStatusHistory> findByPaymentIdOrderByChangedAtAsc(String paymentId);

    List<PaymentStatusHistory> findTop20ByOrderByChangedAtDesc();
}

