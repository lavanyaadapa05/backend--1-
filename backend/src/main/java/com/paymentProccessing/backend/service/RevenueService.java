package com.paymentProccessing.backend.service;

import com.paymentProccessing.backend.dto.RevenueResponse;
import com.paymentProccessing.backend.entity.Payment;
import com.paymentProccessing.backend.enums.PaymentMethod;
import com.paymentProccessing.backend.enums.PaymentStatus;
import com.paymentProccessing.backend.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.*;
import java.time.*;
import java.time.format.TextStyle;
import java.util.*;
import java.util.stream.*;

@Service @RequiredArgsConstructor
public class RevenueService {
    private final PaymentRepository paymentRepository;
    private static final Map<PaymentMethod, BigDecimal> FEES = Map.of(
            PaymentMethod.UPI, bd("2"), PaymentMethod.IMPS, bd("5"), PaymentMethod.NEFT, bd("10"), PaymentMethod.RTGS, bd("25"),
            PaymentMethod.SWIFT, bd("450"), PaymentMethod.WIRE_TRANSFER, bd("400"), PaymentMethod.CARD, bd("3"), PaymentMethod.NETBANKING, bd("8"));
    private static BigDecimal bd(String value) { return new BigDecimal(value); }

    @Transactional(readOnly = true)
    public RevenueResponse getRevenue() {
        List<Payment> completed = paymentRepository.findByStatusIn(List.of(PaymentStatus.COMPLETED));
        return completed.isEmpty() ? mockResponse() : build(completed, false);
    }
    private RevenueResponse mockResponse() {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        List<RevenueResponse.CommissionBreakdown> breakdown = List.of(
                row("UPI", "2", 96), row("IMPS", "5", 24), row("NEFT", "10", 48), row("RTGS", "25", 14), row("SWIFT", "450", 41), row("WIRE_TRANSFER", "400", 25));
        BigDecimal total = breakdown.stream().map(RevenueResponse.CommissionBreakdown::getRevenueGenerated).reduce(BigDecimal.ZERO, BigDecimal::add);
        List<RevenueResponse.RevenueTrendPoint> trend = IntStream.rangeClosed(0, 6).mapToObj(i -> { LocalDate day = today.minusDays(6 - i); return RevenueResponse.RevenueTrendPoint.builder().date(day.toString()).label(day.getDayOfWeek().getDisplayName(TextStyle.SHORT, Locale.ENGLISH)).revenue(BigDecimal.valueOf(620 + i * 185L)).build(); }).toList();
        return RevenueResponse.builder().todayRevenue(BigDecimal.valueOf(1730)).monthlyRevenue(BigDecimal.valueOf(11280)).totalCommissionEarned(total).totalTransactionsProcessed(248).averageCommissionPerTransaction(total.divide(BigDecimal.valueOf(248), 2, RoundingMode.HALF_UP)).commissionBreakdown(breakdown).revenueTrend(trend).transactionSummary(RevenueResponse.TransactionSummary.builder().domesticPayments(182).internationalPayments(66).totalTransactionValue(BigDecimal.valueOf(4385000)).averageTransactionAmount(BigDecimal.valueOf(17681.45)).build()).mockData(true).build();
    }
    private RevenueResponse.CommissionBreakdown row(String channel, String fee, long count) { BigDecimal commission = bd(fee); return RevenueResponse.CommissionBreakdown.builder().channel(channel).commissionPerTransaction(commission).successfulTransactions(count).revenueGenerated(commission.multiply(BigDecimal.valueOf(count))).build(); }
    private RevenueResponse build(List<Payment> payments, boolean mock) {
        LocalDate today = LocalDate.now(ZoneOffset.UTC); LocalDate monthStart = today.withDayOfMonth(1);
        BigDecimal total = payments.stream().map(this::fee).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal todayRevenue = payments.stream().filter(p -> date(p).equals(today)).map(this::fee).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal monthly = payments.stream().filter(p -> !date(p).isBefore(monthStart)).map(this::fee).reduce(BigDecimal.ZERO, BigDecimal::add);
        List<RevenueResponse.CommissionBreakdown> breakdown = Arrays.stream(PaymentMethod.values()).map(method -> {
            List<Payment> byMethod = payments.stream().filter(p -> p.getPaymentMethod() == method).toList();
            return RevenueResponse.CommissionBreakdown.builder().channel(method.name()).commissionPerTransaction(fee(method)).successfulTransactions(byMethod.size()).revenueGenerated(fee(method).multiply(BigDecimal.valueOf(byMethod.size()))).build();
        }).filter(row -> row.getSuccessfulTransactions() > 0 || mock).toList();
        List<RevenueResponse.RevenueTrendPoint> trend = IntStream.rangeClosed(0, 6).mapToObj(i -> today.minusDays(6 - i)).map(day -> RevenueResponse.RevenueTrendPoint.builder().date(day.toString()).label(day.getDayOfWeek().getDisplayName(TextStyle.SHORT, Locale.ENGLISH)).revenue(payments.stream().filter(p -> date(p).equals(day)).map(this::fee).reduce(BigDecimal.ZERO, BigDecimal::add)).build()).toList();
        long domestic = payments.stream().filter(p -> p.getPaymentMethod().isDomestic()).count();
        BigDecimal transactionValue = payments.stream().map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        return RevenueResponse.builder().todayRevenue(todayRevenue).monthlyRevenue(monthly).totalCommissionEarned(total).totalTransactionsProcessed(payments.size()).averageCommissionPerTransaction(payments.isEmpty() ? BigDecimal.ZERO : total.divide(BigDecimal.valueOf(payments.size()), 2, RoundingMode.HALF_UP)).commissionBreakdown(breakdown).revenueTrend(trend).transactionSummary(RevenueResponse.TransactionSummary.builder().domesticPayments(domestic).internationalPayments(payments.size()-domestic).totalTransactionValue(transactionValue).averageTransactionAmount(payments.isEmpty()?BigDecimal.ZERO:transactionValue.divide(BigDecimal.valueOf(payments.size()),2,RoundingMode.HALF_UP)).build()).mockData(mock).build();
    }
    private BigDecimal fee(Payment payment) { return fee(payment.getPaymentMethod()); }
    private BigDecimal fee(PaymentMethod method) { return FEES.getOrDefault(method, BigDecimal.ZERO); }
    private LocalDate date(Payment payment) { return payment.getCreatedAt() == null ? LocalDate.now(ZoneOffset.UTC) : payment.getCreatedAt().atZone(ZoneOffset.UTC).toLocalDate(); }
}
