import { useCallback, useEffect, useState } from "react";
import { PaymentsApi } from "../api.js";
import { APP_CONFIG } from "../config.js";
import { formatDate, formatMoney, methodIcon, riskBadgeLabel } from "../utils.js";
import { useToast } from "../Toast.jsx";

const FAILURE_META = {
  NETWORK_ERROR: { reason: "Network Connectivity Issue", category: "TEMPORARY" },
  PAYMENT_TIMEOUT: { reason: "Payment Gateway Timeout", category: "TEMPORARY" },
  BANK_SERVER_UNAVAILABLE: { reason: "Bank Server Unavailable", category: "TEMPORARY" },
  PROCESSING_ERROR: { reason: "Downstream Processing Error", category: "TEMPORARY" },
  VALIDATION_FAILED: { reason: "Automated Validation Failed", category: "TEMPORARY" },
  INSUFFICIENT_FUNDS: { reason: "Insufficient Account Balance", category: "INSUFFICIENT_FUNDS" },
  INVALID_ACCOUNT: { reason: "Invalid Account Details", category: "INVALID_INPUT" },
  INVALID_IFSC: { reason: "Invalid IFSC Code", category: "INVALID_INPUT" },
  INVALID_CURRENCY: { reason: "Unsupported Currency", category: "INVALID_INPUT" },
  INVALID_AMOUNT: { reason: "Invalid Payment Amount", category: "INVALID_INPUT" },
  INVALID_PAYMENT_METHOD: { reason: "Invalid Payment Method Details", category: "INVALID_INPUT" },
};
function failureMeta(errorCode) { return FAILURE_META[errorCode] || { reason: "Processing Error", category: "TEMPORARY" }; }

function accountLabels(channel) {
  const map = {
    UPI: { source: "Payer UPI ID", destination: "Payee UPI ID" },
  };
  return map[channel] || { source: "Source Account", destination: "Destination Account" };
}

function RiskBadge({ level }) {
  const { text, cls } = riskBadgeLabel(level);
  return <span className={`risk-badge ${cls}`}>{text}</span>;
}

const LIFECYCLE_STEPS = ["CREATED", "VALIDATED", "SENT", "COMPLETED"];
function LifecycleTrack({ status }) {
  const failed = status === "FAILED";
  const currentIndex = LIFECYCLE_STEPS.indexOf(status);
  return (
    <div className="lifecycle-track">
      {LIFECYCLE_STEPS.map((step, i) => {
        let cls = "";
        if (failed) {
          cls = i === 0 ? "done" : "failed";
        } else if (currentIndex === -1) {
          cls = "";
        } else if (i < currentIndex || (i === currentIndex && step === "COMPLETED")) {
          cls = "done";
        } else if (i === currentIndex) {
          cls = "current";
        }
        return (
          <div key={step} className={`lifecycle-node ${cls}`}>
            <span className="dot" />
            <span className="label">{step}</span>
          </div>
        );
      })}
      {failed && (
        <div className="lifecycle-node failed">
          <span className="dot" />
          <span className="label">Failed</span>
        </div>
      )}
    </div>
  );
}

function MethodDetails({ p }) {
  if (p.paymentMethod === "UPI") {
    return <div className="detail-item"><div className="label">UPI ID</div><div className="value">{p.upiId || "—"}</div></div>;
  }
  if (p.paymentMethod === "CARD") {
    return (<>
      <div className="detail-item"><div className="label">Card</div><div className="value">{p.cardNetwork || ""} {p.cardNumberMasked || ""}</div></div>
      <div className="detail-item"><div className="label">Cardholder</div><div className="value">{p.cardHolderName || "—"}</div></div>
    </>);
  }
  if (p.paymentMethod === "NETBANKING") {
    return (<>
      <div className="detail-item"><div className="label">Bank</div><div className="value">{p.bankName || "—"}</div></div>
      <div className="detail-item"><div className="label">Account Type</div><div className="value">{p.bankAccountType || "—"}</div></div>
    </>);
  }
  if (["NEFT", "RTGS", "IMPS"].includes(p.paymentMethod)) {
    return (<>
      <div className="detail-item"><div className="label">Sender Bank</div><div className="value">{p.senderBankName || "—"}</div></div>
      <div className="detail-item"><div className="label">Beneficiary Bank</div><div className="value">{p.beneficiaryBankName || "—"}</div></div>
      <div className="detail-item"><div className="label">IFSC Code</div><div className="value mono">{p.ifscCode || "—"}</div></div>
      {p.paymentMethod === "IMPS" && <div className="detail-item"><div className="label">Mobile / Account No.</div><div className="value mono">{p.mobileOrAccountNumber || "—"}</div></div>}
    </>);
  }
  if (["SWIFT", "WIRE_TRANSFER"].includes(p.paymentMethod)) {
    return (<>
      <div className="detail-item"><div className="label">Sender Bank</div><div className="value">{p.senderBankName || "—"}</div></div>
      <div className="detail-item"><div className="label">Beneficiary Bank</div><div className="value">{p.beneficiaryBankName || "—"}</div></div>
      <div className="detail-item"><div className="label">SWIFT/BIC Code</div><div className="value mono">{p.swiftBicCode || "—"}</div></div>
      <div className="detail-item"><div className="label">Beneficiary Country</div><div className="value">{p.beneficiaryCountry || "—"}</div></div>
      {p.paymentMethod === "SWIFT" && <div className="detail-item"><div className="label">Payment Purpose</div><div className="value">{p.paymentPurpose || "—"}</div></div>}
      {p.paymentMethod === "WIRE_TRANSFER" && p.routingNumber && <div className="detail-item"><div className="label">Routing Number</div><div className="value mono">{p.routingNumber}</div></div>}
    </>);
  }
  return null;
}

export default function PaymentDetailsModal({ paymentId, onClose, onChanged }) {
  const [payment, setPayment] = useState(null);
  const [history, setHistory] = useState([]);
  const [risk, setRisk] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [decisionPending, setDecisionPending] = useState(false);
  const toast = useToast();

  const refresh = useCallback(async () => {
    try {
      const [p, h, r] = await Promise.all([
        PaymentsApi.getPayment(paymentId),
        PaymentsApi.getHistory(paymentId),
        PaymentsApi.getRisk(paymentId).catch(() => null),
      ]);
      setPayment(p); setHistory(h); setRisk(r); setLoadFailed(false);
    } catch (err) {
      setLoadFailed(true);
    }
  }, [paymentId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Poll for live status updates. React state (activeTab) is untouched by
  // this refresh, so — unlike the old vanilla-JS version — switching to the
  // Audit Trail tab no longer gets reset back to Details every few seconds.
  useEffect(() => {
    const id = setInterval(refresh, APP_CONFIG.POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  async function decideRisk(decision) {
    setDecisionPending(true);
    try {
      await PaymentsApi.decideRisk(paymentId, decision);
      toast(decision === "APPROVE" ? "Payment approved — resuming processing." : "Payment rejected.", decision === "APPROVE" ? "success" : "error");
      await refresh();
      onChanged && onChanged();
    } catch (err) {
      toast(`Failed to ${decision.toLowerCase()} payment: ${err.message}`, "error");
    } finally {
      setDecisionPending(false);
    }
  }

  if (loadFailed) {
    return (
      <div className="modal-overlay open" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <button className="modal-close" onClick={onClose}>×</button>
          <div className="error-box"><strong>Failed to load payment</strong>Could not reach the API.</div>
        </div>
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="modal-overlay open" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>Loading…</div>
      </div>
    );
  }

  const p = payment;
  const labels = accountLabels(p.paymentMethod);
  const meta = failureMeta(p.errorCode);
  const failedEntry = p.status === "FAILED" ? [...history].reverse().find((h) => h.toStatus === "FAILED") : null;
  const failedAt = failedEntry ? failedEntry.changedAt : p.updatedAt;
  const fraudStatusLabel = { CLEARED: "Cleared", UNDER_REVIEW: "Under Review", BLOCKED: "Blocked" }[p.fraudStatus] || p.fraudStatus;

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <div className="detail-tabs">
          <button type="button" className={`detail-tab ${activeTab === "details" ? "active" : ""}`} onClick={() => setActiveTab("details")}>Details</button>
          <button type="button" className={`detail-tab ${activeTab === "risk" ? "active" : ""}`} onClick={() => setActiveTab("risk")}>Risk Assessment</button>
          <button type="button" className={`detail-tab ${activeTab === "audit" ? "active" : ""}`} onClick={() => setActiveTab("audit")}>Audit Trail</button>
        </div>

        <div className="detail-header">
          <div>
            <div className="detail-amount">{formatMoney(p.amount, p.currency)}</div>
            <div className="detail-id">ID: {p.id}</div>
          </div>
          <span className={`status-badge status-${p.status}`}>{p.status}</span>
        </div>

        <LifecycleTrack status={p.status} />

        <div className={`detail-panel ${activeTab !== "details" ? "hidden" : ""}`}>
          {p.status === "FAILED" && (
            <div className="failure-section">
              <div className="failure-title">⚠ Failure Details</div>
              <div className="failure-grid">
                <div className="failure-item"><div className="label">Error Code</div><div className="value mono">{p.errorCode || "PROCESSING_ERROR"}</div></div>
                <div className="failure-item"><div className="label">Failure Reason</div><div className="value">{meta.reason}</div></div>
                <div className="failure-item span-2"><div className="label">Error Description</div><div className="value">{p.errorMessage || "Payment could not be processed."}</div></div>
                <div className="failure-item"><div className="label">Failed Timestamp</div><div className="value">{formatDate(failedAt)}</div></div>
              </div>
            </div>
          )}
          <div className="detail-grid">
            <div className="detail-item"><div className="label">Payment ID</div><div className="value mono">{p.id}</div></div>
            <div className="detail-item"><div className="label">Reference</div><div className="value">{p.reference || "—"}</div></div>
            <div className="detail-item"><div className="label">Amount</div><div className="value">{formatMoney(p.amount, p.currency)}</div></div>
            <div className="detail-item"><div className="label">Currency</div><div className="value">{p.currency}</div></div>
            <div className="detail-item"><div className="label">Payment Type</div><div className="value">{p.paymentType || "—"}</div></div>
            <div className="detail-item"><div className="label">Payment Channel</div><div className="value">{methodIcon(p.paymentMethod)} {p.paymentMethod}</div></div>
            <div className="detail-item"><div className="label">Current Status</div><div className="value"><span className={`status-badge status-${p.status}`}>{p.status}</span></div></div>
            <div className="detail-item"><div className="label">{labels.source}</div><div className="value mono">{p.sourceAccount}</div></div>
            <div className="detail-item"><div className="label">{labels.destination}</div><div className="value mono">{p.destinationAccount}</div></div>
            <MethodDetails p={p} />
            <div className="detail-item"><div className="label">Created Date</div><div className="value">{formatDate(p.createdAt)}</div></div>
            <div className="detail-item"><div className="label">Updated Date</div><div className="value">{formatDate(p.updatedAt)}</div></div>
          </div>
        </div>

        <div className={`detail-panel ${activeTab !== "risk" ? "hidden" : ""}`}>
          {!p.riskLevel && <div className="t-meta">No fraud/risk assessment recorded for this payment.</div>}
          {p.riskLevel && (<>
            {p.fraudStatus === "BLOCKED" && <div className="fraud-blocked-banner">⛔ Payment blocked due to high fraud risk.</div>}
            {p.fraudStatus === "UNDER_REVIEW" && (
              <div className="fraud-review-banner">
                <div className="frb-title">⚠ This payment is held for bank operator review (MEDIUM risk).</div>
                <div className="fraud-review-actions">
                  <button type="button" className="btn btn-approve" disabled={decisionPending} onClick={() => decideRisk("APPROVE")}>
                    {decisionPending ? "Approving…" : "Approve Payment"}
                  </button>
                  <button type="button" className="btn btn-reject" disabled={decisionPending} onClick={() => decideRisk("REJECT")}>
                    {decisionPending ? "Rejecting…" : "Reject Payment"}
                  </button>
                </div>
              </div>
            )}
            <div className="risk-summary-grid">
              <div className="risk-summary-card"><span className="rs-label">Risk Level</span><span className="rs-value"><RiskBadge level={p.riskLevel} /></span></div>
              <div className="risk-summary-card"><span className="rs-label">Risk Score</span><span className="rs-value">{p.riskScore ?? "—"}/100</span></div>
              <div className="risk-summary-card"><span className="rs-label">Fraud Status</span><span className="rs-value">{fraudStatusLabel}</span></div>
            </div>
            <div className="risk-rules-title">Triggered Risk Rules</div>
            <div className="risk-rules-list">
              {(risk?.triggeredRules?.length ? risk.triggeredRules : null)?.map((r, i) => (
                <div key={i} className="risk-rule-item"><span className="rr-check">✓</span> {r}</div>
              )) || <div className="t-meta">No specific risk rules triggered.</div>}
            </div>
            {risk && <div className="risk-meta-line">Validated at {formatDate(risk.assessmentTimestamp)} · Decision: {risk.decision || "—"}</div>}
          </>)}
        </div>

        <div className={`detail-panel ${activeTab !== "audit" ? "hidden" : ""}`}>
          <div className="timeline-title">Audit Trail</div>
          <div className="timeline">
            {history.length === 0 && <div className="t-meta">No audit history yet.</div>}
            {history.map((h, i) => (
              <div key={i} className="timeline-item" data-status={h.toStatus}>
                <div className="t-status">{h.action || (h.fromStatus ? `${h.fromStatus} → ${h.toStatus}` : `${h.toStatus}`)}</div>
                <div className="t-meta">{formatDate(h.changedAt)} · performed by {h.triggeredBy}{h.fromStatus ? ` · ${h.fromStatus} → ${h.toStatus}` : ` · → ${h.toStatus}`}</div>
                {h.notes && <div className="t-notes">{h.notes}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

