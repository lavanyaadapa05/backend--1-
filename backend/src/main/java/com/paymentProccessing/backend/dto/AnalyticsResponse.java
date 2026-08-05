package com.paymentProccessing.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Aggregated payment analytics for the Analytics dashboard. Every value is
 * calculated dynamically from the current payment data (see AnalyticsService);
 * nothing here is hardcoded except the realistic mock fallback used only when
 * the payments table is empty.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AnalyticsResponse {

    private Kpis kpis;
    private List<VolumePoint> volumeTrend;
    private TypeDistribution typeDistribution;
    private List<ChannelCount> channelDistribution;
    private List<FailureReason> failureAnalysis;
    private List<RecentActivity> recentActivity;
    /** True when the underlying payments table was empty and this response is realistic mock data. */
    private boolean mockData;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Kpis {
        private long totalPayments;
        private long domesticPayments;
        private long internationalPayments;
        private long successfulPayments;
        private long failedPayments;
        private double successRate;
        private double averageProcessingTimeSeconds;
        private Map<String, BigDecimal> totalTransactionValueByCurrency;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class VolumePoint {
        private String date;
        private String label;
        private long count;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class TypeDistribution {
        private long domestic;
        private long international;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ChannelCount {
        private String channel;
        private long count;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class FailureReason {
        private String errorCode;
        private long count;
        private double percentage;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class RecentActivity {
        private String paymentId;
        private String reference;
        private String action;
        private String performedBy;
        private String previousStatus;
        private String currentStatus;
        private String remarks;
        private Instant timestamp;
    }
}
