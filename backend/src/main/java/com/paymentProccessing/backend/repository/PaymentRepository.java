package com.paymentProccessing.backend.repository;

import com.paymentProccessing.backend.entity.Payment;
import com.paymentProccessing.backend.enums.PaymentStatus;
import com.paymentProccessing.backend.enums.RiskLevel;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, String> {

    Optional<Payment> findByIdempotencyKey(String idempotencyKey);

    boolean existsByIdempotencyKey(String idempotencyKey);

    Page<Payment> findByStatus(PaymentStatus status, Pageable pageable);

    @Query("select p from Payment p where " +
            "(:status is null or p.status = :status) and " +
            "(:riskLevel is null or p.riskLevel = :riskLevel) and " +
            "(:customerId is null or p.customerId = :customerId) and " +
            "(:search is null or (lower(p.reference) like lower(concat('%', :search, '%')) " +
            "  or lower(p.id) like lower(concat('%', :search, '%')) " +
            "  or lower(p.sourceAccount) like lower(concat('%', :search, '%')) " +
            "  or lower(p.destinationAccount) like lower(concat('%', :search, '%'))))")
    Page<Payment> search(@Param("status") PaymentStatus status, @Param("riskLevel") RiskLevel riskLevel,
                          @Param("search") String search, @Param("customerId") String customerId, Pageable pageable);

    List<Payment> findByStatusIn(List<PaymentStatus> statuses);

    /** Velocity check: how many payments has this source account submitted since the given instant. */
    long countBySourceAccountAndCreatedAtAfter(String sourceAccount, Instant after);

    /** Whether this destination account has ever successfully received a payment before (first-time-payee check). */
    boolean existsByDestinationAccountAndStatus(String destinationAccount, PaymentStatus status);
}



