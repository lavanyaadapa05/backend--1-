package com.paymentProccessing.backend.service;

import com.paymentProccessing.backend.dto.AnalyticsResponse;
import com.paymentProccessing.backend.entity.Payment;
import com.paymentProccessing.backend.entity.PaymentStatusHistory;
import com.paymentProccessing.backend.enums.PaymentMethod;
import com.paymentProccessing.backend.enums.PaymentStatus;
import com.paymentProccessing.backend.repository.PaymentRepository;
import com.paymentProccessing.backend.repository.PaymentStatusHistoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Computes operational analytics for the Analytics dashboard purely from
 * existing Payment / PaymentStatusHistory records — nothing is hardcoded.
 * If the payments table is empty, a realistic mock snapshot is generated
 * in-memory (never persisted) so the dashboard still renders meaningfully.
 */
@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private static final int TREND_DAYS = 7;
    private static final int RECENT_ACTIVITY_LIMIT = 20;

    private final PaymentRepository paymentRepository;
    private final PaymentStatusHistoryRepository historyRepository;

    @Transactional(readOnly = true)
    public AnalyticsResponse getAnalytics() {
        List<Payment> payments = paymentRepository.findAll();
        if (payments.isEmpty()) {
            return buildMockAnalytics();
        }
        return buildAnalytics(payments);
    }

    private AnalyticsResponse buildAnalytics(List<Payment> payments) {
        long total = payments.size();
        long domestic = payments.stream().filter(p -> p.getPaymentMethod().isDomestic()).count();
        long international = total - domestic;
        long successful = payments.stream().filter(p -> p.getStatus() == PaymentStatus.COMPLETED).count();
        long failed = payments.stream().filter(p -> p.getStatus() == PaymentStatus.FAILED).count();
        double successRate = total == 0 ? 0.0 : round(successful * 100.0 / total);

        double avgProcessingSeconds = payments.stream()
                .filter(p -> p.getStatus() == PaymentStatus.COMPLETED)
                .mapToLong(p -> Duration.between(p.getCreatedAt(), p.getUpdatedAt()).getSeconds())
                .average()
                .orElse(0.0);

        Map<String, BigDecimal> totalsByCurrency = payments.stream()
                .collect(Collectors.groupingBy(
                        Payment::getCurrency,
                        LinkedHashMap::new,
                        Collectors.reducing(BigDecimal.ZERO, Payment::getAmount, BigDecimal::add)));

        AnalyticsResponse.Kpis kpis = AnalyticsResponse.Kpis.builder()
                .totalPayments(total)
                .domesticPayments(domestic)
                .internationalPayments(international)
                .successfulPayments(successful)
                .failedPayments(failed)
                .successRate(successRate)
                .averageProcessingTimeSeconds(round(avgProcessingSeconds))
                .totalTransactionValueByCurrency(totalsByCurrency)
                .build();

        return AnalyticsResponse.builder()
                .kpis(kpis)
                .volumeTrend(buildVolumeTrend(payments))
                .typeDistribution(AnalyticsResponse.TypeDistribution.builder()
                        .domestic(domestic).international(international).build())
                .channelDistribution(buildChannelDistribution(payments))
                .failureAnalysis(buildFailureAnalysis(payments, failed))
                .recentActivity(buildRecentActivity())
                .mockData(false)
                .build();
    }

    private List<AnalyticsResponse.VolumePoint> buildVolumeTrend(List<Payment> payments) {
        Map<LocalDate, Long> countsByDay = payments.stream()
                .collect(Collectors.groupingBy(
                        p -> p.getCreatedAt().atZone(ZoneOffset.UTC).toLocalDate(),
                        Collectors.counting()));

        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        List<AnalyticsResponse.VolumePoint> trend = new ArrayList<>();
        for (int i = TREND_DAYS - 1; i >= 0; i--) {
            LocalDate day = today.minusDays(i);
            trend.add(AnalyticsResponse.VolumePoint.builder()
                    .date(day.toString())
                    .label(day.getDayOfWeek().getDisplayName(TextStyle.SHORT, Locale.ENGLISH))
                    .count(countsByDay.getOrDefault(day, 0L))
                    .build());
        }
        return trend;
    }

    private List<AnalyticsResponse.ChannelCount> buildChannelDistribution(List<Payment> payments) {
        Map<PaymentMethod, Long> counts = payments.stream()
                .collect(Collectors.groupingBy(Payment::getPaymentMethod, Collectors.counting()));
        return java.util.Arrays.stream(PaymentMethod.values())
                .map(m -> AnalyticsResponse.ChannelCount.builder()
                        .channel(m.name())
                        .count(counts.getOrDefault(m, 0L))
                        .build())
                .filter(c -> c.getCount() > 0)
                .sorted(Comparator.comparingLong(AnalyticsResponse.ChannelCount::getCount).reversed())
                .collect(Collectors.toList());
    }

    private List<AnalyticsResponse.FailureReason> buildFailureAnalysis(List<Payment> payments, long totalFailed) {
        if (totalFailed == 0) {
            return List.of();
        }
        Map<String, Long> counts = payments.stream()
                .filter(p -> p.getStatus() == PaymentStatus.FAILED)
                .collect(Collectors.groupingBy(
                        p -> p.getErrorCode() != null ? p.getErrorCode().name() : "PROCESSING_ERROR",
                        Collectors.counting()));

        return counts.entrySet().stream()
                .map(e -> AnalyticsResponse.FailureReason.builder()
                        .errorCode(e.getKey())
                        .count(e.getValue())
                        .percentage(round(e.getValue() * 100.0 / totalFailed))
                        .build())
                .sorted(Comparator.comparingLong(AnalyticsResponse.FailureReason::getCount).reversed())
                .collect(Collectors.toList());
    }

    private List<AnalyticsResponse.RecentActivity> buildRecentActivity() {
        List<PaymentStatusHistory> recent = historyRepository.findTop20ByOrderByChangedAtDesc();
        return recent.stream()
                .limit(RECENT_ACTIVITY_LIMIT)
                .map(h -> AnalyticsResponse.RecentActivity.builder()
                        .paymentId(h.getPayment().getId())
                        .reference(h.getPayment().getReference())
                        .action(h.getAction())
                        .performedBy(h.getTriggeredBy())
                        .previousStatus(h.getFromStatus() != null ? h.getFromStatus().name() : null)
                        .currentStatus(h.getToStatus().name())
                        .remarks(h.getNotes())
                        .timestamp(h.getChangedAt())
                        .build())
                .collect(Collectors.toList());
    }

    private double round(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }

    /** Realistic sample snapshot shown only when there are no payments in the database yet. */
    private AnalyticsResponse buildMockAnalytics() {
        AnalyticsResponse.Kpis kpis = AnalyticsResponse.Kpis.builder()
                .totalPayments(248)
                .domesticPayments(182)
                .internationalPayments(66)
                .successfulPayments(221)
                .failedPayments(27)
                .successRate(89.11)
                .averageProcessingTimeSeconds(4.6)
                .totalTransactionValueByCurrency(Map.of(
                        "INR", new BigDecimal("18452300.00"),
                        "USD", new BigDecimal("94500.00"),
                        "EUR", new BigDecimal("31250.00"),
                        "GBP", new BigDecimal("12800.00")))
                .build();

        List<AnalyticsResponse.VolumePoint> trend = new ArrayList<>();
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        long[] sample = {28, 34, 41, 37, 45, 30, 33};
        for (int i = 0; i < TREND_DAYS; i++) {
            LocalDate day = today.minusDays(TREND_DAYS - 1 - i);
            DayOfWeek dow = day.getDayOfWeek();
            trend.add(AnalyticsResponse.VolumePoint.builder()
                    .date(day.toString())
                    .label(dow.getDisplayName(TextStyle.SHORT, Locale.ENGLISH))
                    .count(sample[i])
                    .build());
        }

        List<AnalyticsResponse.ChannelCount> channels = List.of(
                AnalyticsResponse.ChannelCount.builder().channel("UPI").count(96).build(),
                AnalyticsResponse.ChannelCount.builder().channel("NEFT").count(48).build(),
                AnalyticsResponse.ChannelCount.builder().channel("IMPS").count(24).build(),
                AnalyticsResponse.ChannelCount.builder().channel("RTGS").count(14).build(),
                AnalyticsResponse.ChannelCount.builder().channel("SWIFT").count(41).build(),
                AnalyticsResponse.ChannelCount.builder().channel("WIRE_TRANSFER").count(25).build());

        List<AnalyticsResponse.FailureReason> failures = List.of(
                AnalyticsResponse.FailureReason.builder().errorCode("NETWORK_ERROR").count(9).percentage(33.33).build(),
                AnalyticsResponse.FailureReason.builder().errorCode("VALIDATION_FAILED").count(8).percentage(29.63).build(),
                AnalyticsResponse.FailureReason.builder().errorCode("PROCESSING_ERROR").count(6).percentage(22.22).build(),
                AnalyticsResponse.FailureReason.builder().errorCode("INSUFFICIENT_FUNDS").count(4).percentage(14.81).build());

        java.time.Instant now = java.time.Instant.now();
        List<AnalyticsResponse.RecentActivity> activity = List.of(
                activityRow(now.minusSeconds(120), "Payment Created", "USER", null, "CREATED", "Payment submitted"),
                activityRow(now.minusSeconds(105), "Validated", "SIMULATOR", "CREATED", "VALIDATED", "Automated validation passed"),
                activityRow(now.minusSeconds(90), "Sent", "SIMULATOR", "VALIDATED", "SENT", "Payment transmitted to destination system"),
                activityRow(now.minusSeconds(60), "Completed", "SIMULATOR", "SENT", "COMPLETED", "Payment confirmed by destination system"),
                activityRow(now.minusSeconds(45), "Duplicate Warning Triggered", "SYSTEM", "CREATED", "CREATED", "Matching submission detected within 2 minutes"),
                activityRow(now.minusSeconds(20), "Retry Requested", "USER", "FAILED", "CREATED", "Retry #1 requested for failed payment"),
                activityRow(now.minusSeconds(5), "Payment Failed", "SIMULATOR", "SENT", "FAILED", "Simulated network failure while sending payment"));

        return AnalyticsResponse.builder()
                .kpis(kpis)
                .volumeTrend(trend)
                .typeDistribution(AnalyticsResponse.TypeDistribution.builder().domestic(182).international(66).build())
                .channelDistribution(channels)
                .failureAnalysis(failures)
                .recentActivity(activity)
                .mockData(true)
                .build();
    }

    private AnalyticsResponse.RecentActivity activityRow(java.time.Instant ts, String action, String performedBy,
                                                           String previous, String current, String remarks) {
        return AnalyticsResponse.RecentActivity.builder()
                .paymentId(java.util.UUID.randomUUID().toString())
                .reference("SAMPLE-DATA")
                .action(action)
                .performedBy(performedBy)
                .previousStatus(previous)
                .currentStatus(current)
                .remarks(remarks)
                .timestamp(ts)
                .build();
    }
}
