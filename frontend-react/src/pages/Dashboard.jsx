import { useCallback, useEffect, useRef, useState } from "react";
import { PaymentsApi } from "../api.js";
import { APP_CONFIG } from "../config.js";
import { formatMoney, methodIcon, riskBadgeLabel, timeAgo } from "../utils.js";

const STATUS_TABS = [
  { label: "All", value: "" },
  { label: "Created", value: "CREATED" },
  { label: "Validated", value: "VALIDATED" },
  { label: "Sent", value: "SENT" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Failed", value: "FAILED" },
];

function RiskBadge({ level }) {
  const { text, cls } = riskBadgeLabel(level);
  return <span className={`risk-badge ${cls}`}>{text}</span>;
}

export default function Dashboard({ onNewPayment, onOpenPayment, refreshToken, customerPortal = false, riskOnly = false }) {
  const [status, setStatus] = useState("");
  const [riskLevel, setRiskLevel] = useState(riskOnly ? "HIGH" : "");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState({ content: [], totalPages: 0 });
  const [stats, setStats] = useState({ total: 0, created: 0, validated: 0, sent: 0, completed: 0, failed: 0 });
  const [loadError, setLoadError] = useState(false);
  const searchDebounce = useRef(null);
  const size = APP_CONFIG.PAGE_SIZE;
  const customerId = customerPortal ? PaymentsApi.customerId() : undefined;

  const loadPayments = useCallback(async () => {
    try {
      const data = await PaymentsApi.listPayments({
        status: status || undefined,
        riskLevel: riskLevel || undefined,
        search: search || undefined,
        customerId,
        page,
        size,
      });
      setPageData(data);
      setLoadError(false);
    } catch (err) {
      setLoadError(true);
    }
  }, [status, riskLevel, search, customerId, page, size]);

  const loadStats = useCallback(async () => {
    try {
      const [all, created, validated, sent, completed, failed] = await Promise.all([
        PaymentsApi.listPayments({ customerId, page: 0, size: 1 }),
        PaymentsApi.listPayments({ customerId, status: "CREATED", page: 0, size: 1 }),
        PaymentsApi.listPayments({ customerId, status: "VALIDATED", page: 0, size: 1 }),
        PaymentsApi.listPayments({ customerId, status: "SENT", page: 0, size: 1 }),
        PaymentsApi.listPayments({ customerId, status: "COMPLETED", page: 0, size: 1 }),
        PaymentsApi.listPayments({ customerId, status: "FAILED", page: 0, size: 1 }),
      ]);
      setStats({
        total: all.totalElements, created: created.totalElements, validated: validated.totalElements,
        sent: sent.totalElements, completed: completed.totalElements, failed: failed.totalElements,
      });
    } catch (e) { /* silent */ }
  }, [customerId]);

  useEffect(() => { loadPayments(); loadStats(); }, [loadPayments, loadStats]);

  // Re-fetch whenever the parent bumps refreshToken (e.g. a payment was just
  // created from the New Payment screen, or approved/rejected from the modal).
  useEffect(() => {
    if (refreshToken === undefined) return;
    loadPayments(); loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  // Poll for live status updates while the dashboard is visible.
  useEffect(() => {
    const id = setInterval(() => { loadPayments(); }, APP_CONFIG.POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [loadPayments]);

  function handleSearchChange(e) {
    const value = e.target.value;
    clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => { setSearch(value.trim()); setPage(0); }, 350);
  }

  const inFlight = stats.created + stats.validated + stats.sent;
  const completionRate = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <>
      <header className="view-header">
        <div>
          <span className="page-kicker">LIVE OPERATIONS</span>
          <h1>{riskOnly ? "Risk monitoring" : "Payment command center"}</h1>
          <p className="subtitle">{riskOnly ? "Review high-risk payments, investigate assessments, and take decisions from the payment detail view." : "Monitor payment movement, risk posture, and every decision from one clear operational view."}</p>
        </div>
        {!riskOnly && customerPortal && onNewPayment && <button className="btn btn-primary" onClick={onNewPayment}>+ Create payment</button>}
      </header>

      <section className="command-hero">
        <div className="command-hero-copy">
          <span className="hero-live-dot"><i /> Live payment rail</span>
          <h2>{inFlight ? `${inFlight} payments are moving now` : "Your payment rail is ready"}</h2>
          <p>{inFlight ? "Processing updates are refreshed automatically. Open any payment to inspect its full audit trail." : "Create a payment to begin tracking validation, delivery, fraud screening, and confirmation."}</p>
        </div>
        <div className="hero-metrics">
          <div><span>Completion rate</span><strong>{completionRate}%</strong></div>
          <div><span>In flight</span><strong>{inFlight}</strong></div>
        </div>
      </section>

      <div className="stats-row">
        <div className="stat-card"><span className="stat-label">Total</span><span className="stat-value">{stats.total}</span></div>
        <div className="stat-card stat-created"><span className="stat-label">Created</span><span className="stat-value">{stats.created}</span></div>
        <div className="stat-card stat-validated"><span className="stat-label">Validated</span><span className="stat-value">{stats.validated}</span></div>
        <div className="stat-card stat-sent"><span className="stat-label">Sent</span><span className="stat-value">{stats.sent}</span></div>
        <div className="stat-card stat-completed"><span className="stat-label">Completed</span><span className="stat-value">{stats.completed}</span></div>
        <div className="stat-card stat-failed"><span className="stat-label">Failed</span><span className="stat-value">{stats.failed}</span></div>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 5L20.49 19l-5-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/></svg>
          <input type="text" placeholder="Search by ID, account or reference…" onChange={handleSearchChange} />
        </div>
        <div className="status-tabs">
          {STATUS_TABS.map((t) => (
            <button key={t.value} className={`tab ${status === t.value ? "active" : ""}`}
              onClick={() => { setStatus(t.value); setPage(0); }}>{t.label}</button>
          ))}
        </div>
        <select className="risk-filter-select" value={riskLevel} onChange={(e) => { setRiskLevel(e.target.value); setPage(0); }}>
          <option value="">All Risks</option>
          <option value="LOW">Low Risk</option>
          <option value="MEDIUM">Medium Risk</option>
          <option value="HIGH">High Risk</option>
        </select>
        <button className="btn btn-ghost" title="Refresh" onClick={loadPayments}>⟳</button>
      </div>

      <div className="table-wrap">
        <table className="payments-table">
          <thead>
            <tr>
              <th>Payment ID</th><th>Method</th><th>Amount</th><th>To</th>
              <th>Status</th><th>Risk</th><th>Created</th><th></th>
            </tr>
          </thead>
          <tbody>
            {loadError && (
              <tr><td colSpan={8} className="empty-state">⚠ Could not load payments. Is the backend running on {APP_CONFIG.API_BASE_URL}?</td></tr>
            )}
            {!loadError && pageData.content.length === 0 && (
              <tr><td colSpan={8} className="empty-state">No payments found. Create your first payment!</td></tr>
            )}
            {!loadError && pageData.content.map((p) => (
              <tr key={p.id} onClick={() => onOpenPayment(p.id)}>
                <td className="mono">{p.id.substring(0, 8)}…</td>
                <td><span className="method-chip">{methodIcon(p.paymentMethod)} {p.paymentMethod}</span></td>
                <td><strong>{formatMoney(p.amount, p.currency)}</strong></td>
                <td className="mono">{p.destinationAccount}</td>
                <td><span className={`status-badge status-${p.status}`}>{p.status}</span></td>
                <td><RiskBadge level={p.riskLevel} /></td>
                <td>{timeAgo(p.createdAt)}</td>
                <td>›</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pageData.totalPages > 1 && (
        <div className="pagination">
          {Array.from({ length: pageData.totalPages }, (_, i) => (
            <button key={i} className={i === page ? "active" : ""} onClick={() => setPage(i)}>{i + 1}</button>
          ))}
        </div>
      )}
    </>
  );
}

