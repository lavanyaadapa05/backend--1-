import { useEffect, useState } from "react";
import { Chart as ChartJS, registerables } from "chart.js";
import { Line, Pie, Bar } from "react-chartjs-2";
import { PaymentsApi } from "../api.js";
import { formatMoney } from "../utils.js";
import { useToast } from "../Toast.jsx";

ChartJS.register(...registerables);

function fmtSeconds(s) {
  if (s == null) return "—";
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}
function fmtTotalValue(byCurrency) {
  if (!byCurrency || Object.keys(byCurrency).length === 0) return "—";
  return Object.entries(byCurrency).map(([ccy, amt]) => formatMoney(amt, ccy)).join(" · ");
}

export default function Analytics() {
  const [data, setData] = useState(null);
  const toast = useToast();

  useEffect(() => {
    PaymentsApi.getAnalytics().then(setData).catch((err) => toast(`Failed to load analytics: ${err.message}`, "error"));
  }, [toast]);

  if (!data) {
    return (
      <header className="view-header">
        <div><h1>Analytics</h1><p className="subtitle">Loading…</p></div>
      </header>
    );
  }

  const k = data.kpis || {};
  const volume = data.volumeTrend || [];
  const typeDist = data.typeDistribution || { domestic: 0, international: 0 };
  const channels = data.channelDistribution || [];
  const failures = data.failureAnalysis || [];
  const activity = data.recentActivity || [];

  return (
    <>
      <header className="view-header">
        <div>
          <h1>Analytics</h1>
          <p className="subtitle">Operational insights across all payment channels</p>
        </div>
        {data.mockData && <span className="mock-badge">Showing sample data — no payments yet</span>}
      </header>

      <div className="kpi-grid">
        <div className="kpi-card"><span className="kpi-label">Total Payments</span><span className="kpi-value">{k.totalPayments ?? 0}</span></div>
        <div className="kpi-card"><span className="kpi-label">Domestic Payments</span><span className="kpi-value">{k.domesticPayments ?? 0}</span></div>
        <div className="kpi-card"><span className="kpi-label">International Payments</span><span className="kpi-value">{k.internationalPayments ?? 0}</span></div>
        <div className="kpi-card"><span className="kpi-label">Successful Payments</span><span className="kpi-value">{k.successfulPayments ?? 0}</span></div>
        <div className="kpi-card"><span className="kpi-label">Failed Payments</span><span className="kpi-value">{k.failedPayments ?? 0}</span></div>
        <div className="kpi-card"><span className="kpi-label">Success Rate</span><span className="kpi-value">{(k.successRate ?? 0).toFixed ? k.successRate.toFixed(2) : k.successRate}%</span></div>
        <div className="kpi-card"><span className="kpi-label">Avg. Processing Time</span><span className="kpi-value">{fmtSeconds(k.averageProcessingTimeSeconds)}</span></div>
        <div className="kpi-card"><span className="kpi-label">Total Transaction Value</span><span className="kpi-value">{fmtTotalValue(k.totalTransactionValueByCurrency)}</span></div>
      </div>

      <div className="analytics-grid">
        <div className="chart-card span-2">
          <div className="chart-title">Payment Volume Trend</div>
          <Line data={{
            labels: volume.map((p) => p.label),
            datasets: [{ label: "Payments", data: volume.map((p) => p.count), borderColor: "#4338ca", backgroundColor: "rgba(67,56,202,0.12)", tension: 0.35, fill: true, pointBackgroundColor: "#4338ca" }],
          }} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }} />
        </div>
        <div className="chart-card">
          <div className="chart-title">Payment Type Distribution</div>
          <Pie data={{
            labels: ["Domestic", "International"],
            datasets: [{ data: [typeDist.domestic || 0, typeDist.international || 0], backgroundColor: ["#4338ca", "#10b981"] }],
          }} options={{ responsive: true, plugins: { legend: { position: "bottom" } } }} />
        </div>
        <div className="chart-card">
          <div className="chart-title">Payment Channel Distribution</div>
          <Bar data={{
            labels: channels.map((c) => c.channel),
            datasets: [{ label: "Payments", data: channels.map((c) => c.count), backgroundColor: "#4338ca", borderRadius: 6 }],
          }} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }} />
        </div>
        <div className="chart-card">
          <div className="chart-title">Failure Analysis</div>
          <div className="failure-analysis-list">
            {failures.length === 0 && <div className="empty-analytics">No failures recorded 🎉</div>}
            {failures.map((f, i) => (
              <div key={i} className="failure-row">
                <div className="fr-code">{f.errorCode}</div>
                <div className="failure-bar-track"><div className="failure-bar-fill" style={{ width: `${f.percentage}%` }} /></div>
                <div className="fr-count">{f.count} · {f.percentage.toFixed ? f.percentage.toFixed(1) : f.percentage}%</div>
              </div>
            ))}
          </div>
        </div>
        <div className="chart-card">
          <div className="chart-title">Recent Processing Activity</div>
          <div className="activity-list">
            {activity.length === 0 && <div className="empty-analytics">No activity yet.</div>}
            {activity.map((a, i) => (
              <div key={i} className="activity-row">
                <div className="ar-top">
                  <span className="ar-action">{a.action}</span>
                  <span className="ar-time">{a.timestamp}</span>
                </div>
                <div className="ar-meta">{a.performedBy || "SYSTEM"} · {a.previousStatus ? `${a.previousStatus} → ` : ""}{a.currentStatus}{a.remarks ? ` · ${a.remarks}` : ""}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

