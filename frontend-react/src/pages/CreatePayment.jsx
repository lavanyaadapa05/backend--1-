import { useMemo, useState } from "react";
import { PaymentsApi } from "../api.js";
import { formatDate, formatMoney } from "../utils.js";
import { useToast } from "../Toast.jsx";

const CHANNELS = {
  UPI: { type: "DOMESTIC", icon: "📱", label: "UPI" },
  NEFT: { type: "DOMESTIC", icon: "🏦", label: "NEFT" },
  RTGS: { type: "DOMESTIC", icon: "🏛️", label: "RTGS" },
  IMPS: { type: "DOMESTIC", icon: "⚡", label: "IMPS" },
  SWIFT: { type: "INTERNATIONAL", icon: "🌐", label: "SWIFT Transfer" },
  WIRE_TRANSFER: { type: "INTERNATIONAL", icon: "💸", label: "Wire Transfer" },
};

const DOMESTIC_BANKS = ["HSBC", "HDFC Bank", "ICICI Bank", "State Bank of India", "Axis Bank", "Kotak Mahindra Bank", "Bank of Baroda", "Punjab National Bank", "IndusInd Bank"];
const INTERNATIONAL_BANKS = [...DOMESTIC_BANKS, "Citi", "JPMorgan Chase", "Bank of America", "Standard Chartered", "Deutsche Bank", "Barclays"];
const BENEFICIARY_COUNTRIES = ["United States", "United Kingdom", "United Arab Emirates", "Singapore", "Germany", "France", "Australia", "Canada", "Japan", "Switzerland", "Hong Kong", "Other"];
const PAYMENT_PURPOSES = ["Family Maintenance", "Education Fees", "Business Payment", "Goods Purchase", "Services Rendered", "Property Purchase", "Investment", "Loan Repayment", "Other"];
const CURRENCIES = { INR: "INR — Indian Rupee", USD: "USD — US Dollar", EUR: "EUR — Euro", GBP: "GBP — British Pound" };
const CURRENCY_SYMBOLS = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };

const AMOUNT_RULES = {
  RTGS: { min: 200000, minMsg: "RTGS requires a minimum of ₹2,00,000 per transaction" },
  UPI: { max: 100000, maxMsg: "UPI transactions cannot exceed ₹1,00,000 per transaction" },
  IMPS: { max: 500000, maxMsg: "IMPS transactions cannot exceed ₹5,00,000 per transaction" },
};
const GLOBAL_MAX_AMOUNT = 1000000;

function amountHint(channel) {
  const rule = AMOUNT_RULES[channel];
  if (rule?.min) return `Minimum ₹${rule.min.toLocaleString("en-IN")} per transaction`;
  if (rule?.max) return `Maximum ₹${rule.max.toLocaleString("en-IN")} per transaction`;
  return `Maximum 10,00,000 (1,000,000) per transaction`;
}

const ACCOUNT_LABELS = {
  UPI: { source: "Payer UPI ID", destination: "Payee UPI ID", sourcePlaceholder: "payer@bank", destinationPlaceholder: "payee@bank" },
};
function accountLabels(channel) {
  return ACCOUNT_LABELS[channel] || {
    source: channel === "SWIFT" || channel === "WIRE_TRANSFER" ? "Sender Account Number" : (channel ? "Sender Account Number" : "Source Account"),
    destination: channel ? "Beneficiary Account Number" : "Destination Account",
    sourcePlaceholder: "e.g. 000123456789", destinationPlaceholder: "e.g. 000987654321",
  };
}

const UPI_VPA_PATTERN = /^[\w.+-]{2,256}@[A-Za-z]{2,64}$/;
const ACCOUNT_NUMBER_PATTERN = /^\d{9,18}$/;
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const SWIFT_BIC_PATTERN = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
const MOBILE_OR_ACCOUNT_PATTERN = /^(\d{10}|\d{9,18})$/;
const ROUTING_NUMBER_PATTERN = /^\d{9}$/;

const initialFields = {
  amount: "", currency: "INR", source: "", destination: "", reference: "",
  senderBank: "", beneficiaryBank: "", ifsc: "", mobileOrAccount: "",
  swiftBic: "", beneficiaryCountry: "", paymentPurpose: "", routingNumber: "",
};

export default function CreatePayment({ onDone, onCreated }) {
  const toast = useToast();
  const [paymentType, setPaymentType] = useState(null);
  const [channel, setChannel] = useState(null);
  const [fields, setFields] = useState(initialFields);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [pendingDuplicate, setPendingDuplicate] = useState(null); // { duplicate, payload }

  const bankList = channel && CHANNELS[channel]?.type === "INTERNATIONAL" ? INTERNATIONAL_BANKS : DOMESTIC_BANKS;
  const currencyCodes = paymentType === "DOMESTIC" ? ["INR"] : ["USD", "GBP", "EUR", "INR"];
  const labels = useMemo(() => accountLabels(channel), [channel]);

  function setField(name, value) {
    setFields((f) => ({ ...f, [name]: value }));
  }

  function selectPaymentType(type) {
    setPaymentType(type);
    setChannel(null);
    setFields((f) => ({ ...f, currency: type === "DOMESTIC" ? "INR" : "USD" }));
    setErrors({});
  }

  function selectChannel(next) {
    // Clear channel-specific values whenever the channel changes (e.g. SWIFT -> Wire
    // Transfer) so stale data never lingers across channels. Amount/Source/
    // Destination/Reference are preserved since they're common to every channel.
    if (channel && channel !== next) {
      setFields((f) => ({
        ...f,
        senderBank: "", beneficiaryBank: "", ifsc: "", mobileOrAccount: "",
        swiftBic: "", beneficiaryCountry: "", paymentPurpose: "", routingNumber: "",
      }));
    }
    setChannel(next);
    setErrors({});
  }

  function buildPayload() {
    const payload = {
      amount: parseFloat(fields.amount),
      currency: fields.currency,
      sourceAccount: fields.source.trim(),
      destinationAccount: fields.destination.trim(),
      paymentMethod: channel,
      paymentType,
      reference: fields.reference.trim() || null,
      customerId: PaymentsApi.customerId(),
      idempotencyKey: crypto.randomUUID ? crypto.randomUUID() : `key-${Date.now()}-${Math.random()}`,
    };
    if (channel === "UPI") {
      payload.upiDetails = { upiId: payload.destinationAccount };
    } else if (["NEFT", "RTGS", "IMPS"].includes(channel)) {
      payload.bankTransferDetails = {
        senderBank: fields.senderBank,
        beneficiaryBank: fields.beneficiaryBank,
        ifscCode: fields.ifsc.trim().toUpperCase(),
        mobileOrAccountNumber: channel === "IMPS" ? fields.mobileOrAccount.trim() : null,
      };
    } else if (["SWIFT", "WIRE_TRANSFER"].includes(channel)) {
      payload.internationalTransferDetails = {
        senderBank: fields.senderBank,
        beneficiaryBank: fields.beneficiaryBank,
        swiftBicCode: fields.swiftBic.trim().toUpperCase(),
        beneficiaryCountry: fields.beneficiaryCountry,
        paymentPurpose: channel === "SWIFT" ? fields.paymentPurpose : null,
        routingNumber: channel === "WIRE_TRANSFER" ? (fields.routingNumber.trim() || null) : null,
      };
    }
    return payload;
  }

  function validateClientSide(payload) {
    const e = {};
    if (!payload.amount || payload.amount <= 0) e.amount = "Enter a valid amount greater than 0";
    if (!payload.sourceAccount) e.source = `${labels.source} is required`;
    if (!payload.destinationAccount) e.destination = `${labels.destination} is required`;
    if (payload.sourceAccount && payload.destinationAccount &&
        payload.sourceAccount.toLowerCase() === payload.destinationAccount.toLowerCase()) {
      e.destination = `Must differ from ${labels.source.toLowerCase()}`;
    }

    const amountRule = AMOUNT_RULES[channel];
    if (!e.amount && amountRule && payload.amount) {
      if (amountRule.min && payload.amount < amountRule.min) e.amount = amountRule.minMsg;
      if (amountRule.max && payload.amount > amountRule.max) e.amount = amountRule.maxMsg;
    }
    if (!e.amount && payload.amount && payload.amount > GLOBAL_MAX_AMOUNT) {
      e.amount = `Amount cannot exceed ${GLOBAL_MAX_AMOUNT.toLocaleString("en-IN")} per transaction`;
    }

    if (channel === "UPI") {
      if (payload.sourceAccount && !UPI_VPA_PATTERN.test(payload.sourceAccount)) e.source = "Enter a valid UPI ID e.g. name@bank";
      if (payload.destinationAccount && !UPI_VPA_PATTERN.test(payload.destinationAccount)) e.destination = "Enter a valid UPI ID e.g. name@bank";
    } else if (["NEFT", "RTGS", "IMPS", "SWIFT", "WIRE_TRANSFER"].includes(channel)) {
      if (payload.sourceAccount && !ACCOUNT_NUMBER_PATTERN.test(payload.sourceAccount)) e.source = "Account number must be 9-18 digits";
      if (payload.destinationAccount && !ACCOUNT_NUMBER_PATTERN.test(payload.destinationAccount)) e.destination = "Account number must be 9-18 digits";
    }

    if (["NEFT", "RTGS", "IMPS"].includes(channel) &&
        (!payload.bankTransferDetails.ifscCode || !IFSC_PATTERN.test(payload.bankTransferDetails.ifscCode))) {
      e.ifsc = "Enter a valid 11-character IFSC code e.g. HDFC0001234";
    }
    if (channel === "IMPS") {
      const val = payload.bankTransferDetails.mobileOrAccountNumber;
      if (!val || !MOBILE_OR_ACCOUNT_PATTERN.test(val)) e.mobileOrAccount = "Enter a 10-digit mobile number or a 9-18 digit account number";
    }
    if (["SWIFT", "WIRE_TRANSFER"].includes(channel)) {
      const bic = payload.internationalTransferDetails.swiftBicCode;
      if (!bic || !SWIFT_BIC_PATTERN.test(bic)) e.swiftBic = "Enter a valid 8 or 11 character SWIFT/BIC code";
    }
    if (channel === "WIRE_TRANSFER") {
      const routing = payload.internationalTransferDetails.routingNumber;
      if (routing && !ROUTING_NUMBER_PATTERN.test(routing)) e.routingNumber = "Routing number must be exactly 9 digits";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function findPotentialDuplicate(payload) {
    try {
      const recent = await PaymentsApi.listPayments({ page: 0, size: 20, sortBy: "createdAt", direction: "DESC" });
      const cutoff = Date.now() - 2 * 60 * 1000;
      return (recent.content || []).find((p) => {
        const createdAt = new Date(p.createdAt).getTime();
        if (createdAt < cutoff) return false;
        return p.sourceAccount === payload.sourceAccount && p.destinationAccount === payload.destinationAccount &&
          Number(p.amount) === Number(payload.amount) && p.currency === payload.currency &&
          (p.reference || "") === (payload.reference || "");
      }) || null;
    } catch (e) {
      return null; // fail open
    }
  }

  async function submitPayment(payload) {
    setSubmitting(true);
    try {
      const created = await PaymentsApi.createPayment(payload);
      toast(`Payment created — status: ${created.status}`, "success");
      // Mirror the original flow: switch back to the dashboard, then pop open
      // the payment's details modal (Details / Risk Assessment / Audit Trail
      // tabs) a moment later so the transition doesn't feel abrupt.
      if (onCreated) {
        setTimeout(() => onCreated(created.id), 400);
      } else {
        onDone();
      }
    } catch (err) {
      const errorCode = err.body?.errorCode;
      const details = err.body?.details;
      toast(`${errorCode || "Error"}: ${err.message}`, "error");
      if (details) {
        const e = {};
        details.forEach((d) => {
          const f = (d.split(":")[0] || "").toLowerCase();
          if (f.includes("amount")) e.amount = d;
          if (f.includes("source")) e.source = d;
          if (f.includes("destination")) e.destination = d;
          if (f.includes("ifsc")) e.ifsc = d;
          if (f.includes("mobileoraccountnumber")) e.mobileOrAccount = d;
          if (f.includes("swiftbiccode")) e.swiftBic = d;
          if (f.includes("routingnumber")) e.routingNumber = d;
        });
        setErrors((prev) => ({ ...prev, ...e }));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting || !channel) return;
    const payload = buildPayload();
    if (!validateClientSide(payload)) return;
    const duplicate = await findPotentialDuplicate(payload);
    if (duplicate) { setPendingDuplicate({ duplicate, payload }); return; }
    await submitPayment(payload);
  }

  // ---- Digit/charset restriction helpers (typing-level, mirrors the original UX) ----
  function digitsOnly(v, max) { return v.replace(/\D/g, "").slice(0, max); }
  function upperAlnum(v, max) { return v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, max); }
  function accountCharset(v) {
    if (channel === "UPI") return v.replace(/[^\w.+\-@]/g, "").slice(0, 256);
    return digitsOnly(v, 18);
  }

  const currencyPrefix = CURRENCY_SYMBOLS[fields.currency] || fields.currency;

  return (
    <>
      <header className="view-header">
        <div>
          <h1>New Payment</h1>
          <p className="subtitle">Initiate a domestic or international payment</p>
        </div>
      </header>

      <div className="create-card">
        <p className="section-label">1. Select Payment Type</p>
        <div className="payment-type-cards">
          <button type="button" className={`type-card ${paymentType === "DOMESTIC" ? "active" : ""}`} onClick={() => selectPaymentType("DOMESTIC")}>
            <span className="type-check">✓</span>
            <span className="type-icon">🏠</span>
            <span className="type-title">Domestic Payment</span>
            <span className="type-desc">Send money within India via UPI, NEFT, RTGS or IMPS</span>
          </button>
          <button type="button" className={`type-card ${paymentType === "INTERNATIONAL" ? "active" : ""}`} onClick={() => selectPaymentType("INTERNATIONAL")}>
            <span className="type-check">✓</span>
            <span className="type-icon">🌍</span>
            <span className="type-title">International Payment</span>
            <span className="type-desc">Send money abroad via SWIFT or Wire Transfer</span>
          </button>
        </div>

        {paymentType && (
          <div className="channel-section">
            <p className="section-label">2. Select Payment Channel</p>
            {paymentType === "DOMESTIC" && (
              <div className="channel-cards" data-group="DOMESTIC">
                {["UPI", "NEFT", "RTGS", "IMPS"].map((c) => (
                  <button key={c} type="button" className={`channel-card ${channel === c ? "active" : ""}`} onClick={() => selectChannel(c)}>
                    <span className="channel-icon">{CHANNELS[c].icon}</span> {CHANNELS[c].label}
                  </button>
                ))}
              </div>
            )}
            {paymentType === "INTERNATIONAL" && (
              <div className="channel-cards" data-group="INTERNATIONAL">
                {["SWIFT", "WIRE_TRANSFER"].map((c) => (
                  <button key={c} type="button" className={`channel-card ${channel === c ? "active" : ""}`} onClick={() => selectChannel(c)}>
                    <span className="channel-icon">{CHANNELS[c].icon}</span> {CHANNELS[c].label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {channel && (
          <form id="payment-form" onSubmit={handleSubmit} noValidate>
            <p className="section-label">3. Payment Details</p>
            <div className="form-grid">
              <div className="form-group">
                <label>Amount</label>
                <div className="amount-input">
                  <span>{currencyPrefix}</span>
                  <input type="number" step="0.01" min="0.01" placeholder="0.00" required
                    value={fields.amount}
                    onChange={(e) => {
                      const v = e.target.value;
                      setField("amount", v.includes(".") && v.split(".")[1]?.length > 2 ? parseFloat(v).toFixed(2) : v);
                    }} />
                </div>
                <small className="hint-text">{amountHint(channel)}</small>
                <small className="error-text">{errors.amount || ""}</small>
              </div>
              <div className="form-group">
                <label>Currency</label>
                <select value={fields.currency} onChange={(e) => setField("currency", e.target.value)}>
                  {currencyCodes.map((c) => <option key={c} value={c}>{CURRENCIES[c]}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>{labels.source}</label>
                <input type="text" required placeholder={labels.sourcePlaceholder} value={fields.source}
                  inputMode={channel === "UPI" ? "email" : "numeric"} maxLength={channel === "UPI" ? 256 : 18}
                  onChange={(e) => setField("source", accountCharset(e.target.value))} />
                <small className="hint-text">{channel === "UPI" ? "Valid UPI VPA e.g. name@bank" : "9-18 digit numeric account number"}</small>
                <small className="error-text">{errors.source || ""}</small>
              </div>
              <div className="form-group">
                <label>{labels.destination}</label>
                <input type="text" required placeholder={labels.destinationPlaceholder} value={fields.destination}
                  inputMode={channel === "UPI" ? "email" : "numeric"} maxLength={channel === "UPI" ? 256 : 18}
                  onChange={(e) => setField("destination", accountCharset(e.target.value))} />
                <small className="hint-text">{channel === "UPI" ? "Valid UPI VPA e.g. name@bank" : "9-18 digit numeric account number"}</small>
                <small className="error-text">{errors.destination || ""}</small>
              </div>

              {["NEFT", "RTGS", "IMPS", "SWIFT", "WIRE_TRANSFER"].includes(channel) && (<>
                <div className="form-group">
                  <label>Sender Bank</label>
                  <select value={fields.senderBank} onChange={(e) => setField("senderBank", e.target.value)}>
                    <option value="">Select bank…</option>
                    {bankList.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Beneficiary Bank</label>
                  <select value={fields.beneficiaryBank} onChange={(e) => setField("beneficiaryBank", e.target.value)}>
                    <option value="">Select bank…</option>
                    {bankList.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </>)}

              {["NEFT", "RTGS", "IMPS"].includes(channel) && (
                <div className="form-group">
                  <label>IFSC Code</label>
                  <input type="text" placeholder="e.g. HDFC0001234" maxLength={11} value={fields.ifsc}
                    onChange={(e) => setField("ifsc", upperAlnum(e.target.value, 11))} />
                  <small className="hint-text">Format: 4 letters + 0 + 6 alphanumeric characters (e.g. HDFC0001234) — exactly 11 characters</small>
                  <small className="error-text">{errors.ifsc || ""}</small>
                </div>
              )}

              {channel === "IMPS" && (
                <div className="form-group">
                  <label>Mobile Number or Account Number</label>
                  <input type="text" placeholder="e.g. 9876543210" value={fields.mobileOrAccount}
                    onChange={(e) => setField("mobileOrAccount", digitsOnly(e.target.value, 18))} />
                  <small className="hint-text">10-digit mobile number, or a 9-18 digit bank account number</small>
                  <small className="error-text">{errors.mobileOrAccount || ""}</small>
                </div>
              )}

              {["SWIFT", "WIRE_TRANSFER"].includes(channel) && (<>
                <div className="form-group">
                  <label>SWIFT/BIC Code</label>
                  <input type="text" placeholder="e.g. HSBCGB2LXXX" maxLength={11} value={fields.swiftBic}
                    onChange={(e) => setField("swiftBic", upperAlnum(e.target.value, 11))} />
                  <small className="hint-text">8 or 11 character SWIFT/BIC code (e.g. HSBCGB2L or HSBCGB2LXXX)</small>
                  <small className="error-text">{errors.swiftBic || ""}</small>
                </div>
                <div className="form-group">
                  <label>Beneficiary Country</label>
                  <select value={fields.beneficiaryCountry} onChange={(e) => setField("beneficiaryCountry", e.target.value)}>
                    <option value="">Select country…</option>
                    {BENEFICIARY_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </>)}

              {channel === "SWIFT" && (
                <div className="form-group">
                  <label>Payment Purpose</label>
                  <select value={fields.paymentPurpose} onChange={(e) => setField("paymentPurpose", e.target.value)}>
                    <option value="">Select purpose…</option>
                    {PAYMENT_PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              )}

              {channel === "WIRE_TRANSFER" && (
                <div className="form-group">
                  <label>Routing Number <span className="optional">(if applicable)</span></label>
                  <input type="text" placeholder="e.g. 026009593" value={fields.routingNumber}
                    onChange={(e) => setField("routingNumber", digitsOnly(e.target.value, 9))} />
                  <small className="hint-text">Optional — must be exactly 9 digits if provided (US ABA routing number)</small>
                  <small className="error-text">{errors.routingNumber || ""}</small>
                </div>
              )}

              <div className="form-group span-2">
                <label>Reference / Description <span className="optional">(optional)</span></label>
                <input type="text" placeholder="e.g. Rent payment for July" value={fields.reference}
                  onChange={(e) => setField("reference", e.target.value)} />
              </div>
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={onDone}>Cancel</button>
              <button type="submit" className={`btn btn-primary btn-lg ${submitting ? "is-loading" : ""}`} disabled={submitting}>
                {submitting ? "Processing…" : "Pay Now"}
              </button>
            </div>
          </form>
        )}
      </div>

      {pendingDuplicate && (
        <div className="modal-overlay open" onClick={() => setPendingDuplicate(null)}>
          <div className="modal modal-warning" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setPendingDuplicate(null)}>×</button>
            <div className="duplicate-icon">⚠️</div>
            <h2 className="duplicate-title">Potential Duplicate Payment</h2>
            <p className="duplicate-message">A payment with similar details was recently submitted. Please verify whether you intend to create another payment.</p>
            <div className="detail-grid">
              <div className="detail-item"><div className="label">Payment ID</div><div className="value mono">{pendingDuplicate.duplicate.id}</div></div>
              <div className="detail-item"><div className="label">Reference</div><div className="value">{pendingDuplicate.duplicate.reference || "—"}</div></div>
              <div className="detail-item"><div className="label">Amount</div><div className="value">{formatMoney(pendingDuplicate.duplicate.amount, pendingDuplicate.duplicate.currency)}</div></div>
              <div className="detail-item"><div className="label">Source Account</div><div className="value mono">{pendingDuplicate.duplicate.sourceAccount}</div></div>
              <div className="detail-item"><div className="label">Destination Account</div><div className="value mono">{pendingDuplicate.duplicate.destinationAccount}</div></div>
              <div className="detail-item"><div className="label">Created Time</div><div className="value">{formatDate(pendingDuplicate.duplicate.createdAt)}</div></div>
              <div className="detail-item"><div className="label">Status</div><div className="value"><span className={`status-badge status-${pendingDuplicate.duplicate.status}`}>{pendingDuplicate.duplicate.status}</span></div></div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setPendingDuplicate(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={async () => {
                const payload = pendingDuplicate.payload;
                setPendingDuplicate(null);
                await submitPayment(payload);
              }}>Create Anyway</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

