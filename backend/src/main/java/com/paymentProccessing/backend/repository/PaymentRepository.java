package com.paymentProccessing.backend.repository;

import com.paymentProccessing.backend.entity.Payment;
import com.paymentProccessing.backend.enums.PaymentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, String> {

    Optional<Payment> findByIdempotencyKey(String idempotencyKey);

    boolean existsByIdempotencyKey(String idempotencyKey);

    Page<Payment> findByStatus(PaymentStatus status, Pageable pageable);

    @Query("select p from Payment p where " +
            "(:status is null or p.status = :status) and " +
            "(:search is null or lower(p.reference) like lower(concat('%', :search, '%')) " +
            "  or lower(p.id) like lower(concat('%', :search, '%')) " +
            "  or lower(p.sourceAccount) like lower(concat('%', :search, '%')) " +
            "  or lower(p.destinationAccount) like lower(concat('%', :search, '%')))")
    Page<Payment> search(@Param("status") PaymentStatus status, @Param("search") String search, Pageable pageable);

    List<Payment> findByStatusIn(List<PaymentStatus> statuses);
}

