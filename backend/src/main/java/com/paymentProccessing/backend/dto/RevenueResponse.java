package com.paymentProccessing.backend.dto;

import lombok.*;
import java.math.BigDecimal;
import java.util.List;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class RevenueResponse {
    private BigDecimal todayRevenue;
    private BigDecimal monthlyRevenue;
    private BigDecimal totalCommissionEarned;
    private long totalTransactionsProcessed;
    private BigDecimal averageCommissionPerTransaction;
    private List<CommissionBreakdown> commissionBreakdown;
    private List<RevenueTrendPoint> revenueTrend;
    private TransactionSummary transactionSummary;
    private boolean mockData;

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class CommissionBreakdown { private String channel; private BigDecimal commissionPerTransaction; private long successfulTransactions; private BigDecimal revenueGenerated; }
    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class RevenueTrendPoint { private String date; private String label; private BigDecimal revenue; }
    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class TransactionSummary { private long domesticPayments; private long internationalPayments; private BigDecimal totalTransactionValue; private BigDecimal averageTransactionAmount; }
}
