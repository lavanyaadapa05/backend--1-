import { useCallback, useEffect, useRef, useState } from "react";
import { PaymentsApi } from "../api.js";
import { formatDate, formatMoney, methodIcon, timeAgo } from "../utils.js";
import { useToast } from "../Toast.jsx";

const ACTION_EMOJI = {
  CREATED: "🆕",
  VALIDATED: "✅",
  SENT: "📤",
  COMPLETED: "🎉",
  FAILED: "⚠️",
  RISK_REVIEW: "🕵️",
  APPROVED: "👍",
  REJECTED: "👎",
};
function actionEmoji(status) {
  return ACTION_EMOJI[status] || "🔔";
}

export default function History({ onOpenPayment }) {
  const [search, setSearch] = useState("");
  const [payments, setPayments] = useState([]);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState(null);
  const [selectedHistory, setSelectedHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activity, setActivity] = useState([]);
  const searchDebounce = useRef(null);
  const toast = useToast();

  const loadPayments = useCallback(async (term) => {
    try {
      const data = await PaymentsApi.listPayments({ search: term || undefined, page: 0, size: 12, sortBy: "createdAt", direction: "DESC" });
      setPayments(data.content || []);
      setLoadError(false);
    } catch (e) {
      setLoadError(true);
    }
  }, []);

  useEffect(() => { loadPayments(""); }, [loadPayments]);

  useEffect(() => {
    PaymentsApi.getAnalytics()
      .then((d) => setActivity(d.recentActivity || []))
      .catch((err) => toast(`Failed to load recent activity: ${err.message}`, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearchChange(e) {
    const value = e.target.value;
    setSearch(value);
    clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => loadPayments(value.trim()), 350);
  }

  async function openPaymentHistory(p) {
    setSelected(p);
    setHistoryLoading(true);
    try {
      const h = await PaymentsApi.getHistory(p.id);
      setSelectedHistory(h);
    } catch (e) {
      toast(`Failed to load history: ${e.message}`, "error");
      setSelectedHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  return (
    <>
      <header className="view-header">
        <div>
          <h1>🕘 History &amp; Audit Trail</h1>
          <p className="subtitle">Track every lifecycle event across all payments</p>
        </div>
      </header>

      <div className="history-layout">
        <div className="history-col history-col-activity">
          <div className="chart-card">
            <div className="chart-title">🌐 Recent Global Activity</div>
            <div className="activity-list history-activity-list">
              {activity.length === 0 && <div className="empty-analytics">No activity recorded yet.</div>}
              {activity.map((a, i) => (
                <div key={i} className="activity-row history-activity-row">
                  <span className="history-activity-emoji">{actionEmoji(a.currentStatus)}</span>
                  <div style={{ flex: 1 }}>
                    <div className="ar-top">
                      <span className="ar-action">{a.action}</span>
                      <span className="ar-time">{a.timestamp}</span>
                    </div>
                    <div className="ar-meta">{a.performedBy || "SYSTEM"} · {a.previousStatus ? `${a.previousStatus} → ` : ""}{a.currentStatus}{a.remarks ? ` · ${a.remarks}` : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="history-col history-col-lookup">
          <div className="chart-card">
            <div className="chart-title">🔎 Find a Payment's Full Trail</div>
            <div className="search-box history-search">
              <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 5L20.49 19l-5-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z" /></svg>
              <input type="text" placeholder="Search by ID, account or reference…" value={search} onChange={handleSearchChange} />
            </div>

            <div className="history-payment-list">
              {loadError && <div className="empty-analytics">⚠ Could not load payments.</div>}
              {!loadError && payments.length === 0 && <div className="empty-analytics">No payments found.</div>}
              {!loadError && payments.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`history-payment-item ${selected?.id === p.id ? "active" : ""}`}
                  onClick={() => openPaymentHistory(p)}
                >
                  <span className="method-chip">{methodIcon(p.paymentMethod)} {p.paymentMethod}</span>
                  <span className="mono">{p.id.substring(0, 8)}…</span>
                  <strong>{formatMoney(p.amount, p.currency)}</strong>
                  <span className={`status-badge status-${p.status}`}>{p.status}</span>
                  <span className="history-payment-time">{timeAgo(p.createdAt)}</span>
                </button>
              ))}
            </div>
          </div>

          {selected && (
            <div className="chart-card history-trail-card">
              <div className="chart-title">
                📜 Audit Trail — <span className="mono">{selected.id.substring(0, 10)}…</span>
                <button type="button" className="btn btn-ghost btn-sm history-view-btn" onClick={() => onOpenPayment?.(selected.id)}>Open Full Details →</button>
              </div>
              {historyLoading && <div className="empty-analytics">Loading…</div>}
              {!historyLoading && (
                <div className="timeline">
                  {selectedHistory.length === 0 && <div className="t-meta">No audit history yet.</div>}
                  {selectedHistory.map((h, i) => (
                    <div key={i} className="timeline-item" data-status={h.toStatus}>
                      <div className="t-status">{actionEmoji(h.toStatus)} {h.action || (h.fromStatus ? `${h.fromStatus} → ${h.toStatus}` : `${h.toStatus}`)}</div>
                      <div className="t-meta">{formatDate(h.changedAt)} · performed by {h.triggeredBy}{h.fromStatus ? ` · ${h.fromStatus} → ${h.toStatus}` : ` · → ${h.toStatus}`}</div>
                      {h.notes && <div className="t-notes">{h.notes}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

