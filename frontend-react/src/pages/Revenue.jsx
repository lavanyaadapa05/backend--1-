import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import { PaymentsApi } from "../api.js";
import { formatMoney } from "../utils.js";
import { useToast } from "../Toast.jsx";

export default function Revenue() {
  const [data, setData] = useState(null); const toast = useToast();
  useEffect(() => { PaymentsApi.getRevenue().then(setData).catch(e => toast(`Failed to load revenue: ${e.message}`, "error")); }, [toast]);
  if (!data) return <header className="view-header"><div><h1>Revenue Dashboard</h1><p className="subtitle">Loading revenue intelligence…</p></div></header>;
  const summary = data.transactionSummary || {}; const trend = data.revenueTrend || [];
  return <>
    <header className="view-header"><div><h1>Revenue Dashboard</h1><p className="subtitle">Processing revenue generated from successfully completed payments.</p></div>{data.mockData && <span className="mock-badge">No completed payments yet</span>}</header>
    <div className="kpi-grid revenue-kpis">
      <div className="kpi-card"><span className="kpi-label">Today's Revenue</span><span className="kpi-value">{formatMoney(data.todayRevenue, "INR")}</span></div>
      <div className="kpi-card"><span className="kpi-label">Monthly Revenue</span><span className="kpi-value">{formatMoney(data.monthlyRevenue, "INR")}</span></div>
      <div className="kpi-card"><span className="kpi-label">Commission Earned</span><span className="kpi-value">{formatMoney(data.totalCommissionEarned, "INR")}</span></div>
      <div className="kpi-card"><span className="kpi-label">Transactions Processed</span><span className="kpi-value">{data.totalTransactionsProcessed}</span></div>
      <div className="kpi-card"><span className="kpi-label">Average Commission</span><span className="kpi-value">{formatMoney(data.averageCommissionPerTransaction, "INR")}</span></div>
    </div>
    <div className="analytics-grid">
      <section className="chart-card span-2"><div className="chart-title">Revenue trend</div><Line data={{labels: trend.map(p => p.label), datasets:[{label:"Revenue (INR)",data:trend.map(p=>p.revenue),borderColor:"#4338ca",backgroundColor:"rgba(67,56,202,.12)",fill:true,tension:.35}]}} options={{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}} /></section>
      <section className="chart-card"><div className="chart-title">Transaction summary</div><div className="revenue-summary"><div><span>Domestic payments</span><strong>{summary.domesticPayments || 0}</strong></div><div><span>International payments</span><strong>{summary.internationalPayments || 0}</strong></div><div><span>Total transaction value</span><strong>{formatMoney(summary.totalTransactionValue, "INR")}</strong></div><div><span>Average transaction amount</span><strong>{formatMoney(summary.averageTransactionAmount, "INR")}</strong></div></div></section>
      <section className="chart-card span-2"><div className="chart-title">Commission by payment channel</div><div className="commission-grid">{(data.commissionBreakdown || []).map(row => <div className="commission-row" key={row.channel}><span className="method-chip">{row.channel}</span><span>Fee <strong>{formatMoney(row.commissionPerTransaction,"INR")}</strong></span><span>{row.successfulTransactions} successful</span><strong>{formatMoney(row.revenueGenerated,"INR")}</strong></div>)}</div></section>
    </div>
  </>;
}
