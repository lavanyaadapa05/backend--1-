// PayFlow frontend application logic.
(() => {
  const state = {
    view: "dashboard",
    paymentType: null,
    channel: null,
    status: "",
    riskLevel: "",
    search: "",
    page: 0,
    size: window.APP_CONFIG.PAGE_SIZE,
    totalPages: 0,
    openPaymentId: null,
    submitting: false,
  };

  // ---------------- Utilities ----------------
  const $ = (sel) => document.querySelector(sel);
  const $all = (sel) => Array.from(document.querySelectorAll(sel));

  function formatMoney(amount, currency) {
    try {
      return new Intl.NumberFormat("en-IN", { style: "currency", currency: currency || "INR" }).format(amount);
    } catch (e) {
      return `${currency} ${Number(amount).toFixed(2)}`;
    }
  }

  function formatDate(iso) {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }

  function timeAgo(iso) {
    if (!iso) return "";
    const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  function toast(message, type = "info") {
    const container = $("#toast-container");
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  function methodIcon(method) {
    return {
      UPI: "📱", CARD: "💳", NETBANKING: "🏦",
      NEFT: "🏦", RTGS: "🏛️", IMPS: "⚡", SWIFT: "🌐", WIRE_TRANSFER: "💸",
    }[method] || "💰";
  }

  const RISK_DOT = { LOW: "🟢", MEDIUM: "🟡", HIGH: "🔴" };
  function riskBadge(level) {
    if (!level) return `<span class="risk-badge">—</span>`;
    return `<span class="risk-badge risk-${level}">${RISK_DOT[level] || ""} ${level}</span>`;
  }

  // ---------------- Payment type / channel configuration ----------------
  const CHANNELS = {
    UPI: { type: "DOMESTIC", icon: "📱", label: "UPI" },
    NEFT: { type: "DOMESTIC", icon: "🏦", label: "NEFT" },
    RTGS: { type: "DOMESTIC", icon: "🏛️", label: "RTGS" },
    IMPS: { type: "DOMESTIC", icon: "⚡", label: "IMPS" },
    SWIFT: { type: "INTERNATIONAL", icon: "🌐", label: "SWIFT Transfer" },
    WIRE_TRANSFER: { type: "INTERNATIONAL", icon: "💸", label: "Wire Transfer" },
  };

  const DOMESTIC_BANKS = [
    "HSBC", "HDFC Bank", "ICICI Bank", "State Bank of India", "Axis Bank",
    "Kotak Mahindra Bank", "Bank of Baroda", "Punjab National Bank", "IndusInd Bank",
  ];
  const INTERNATIONAL_BANKS = [
    ...DOMESTIC_BANKS, "Citi", "JPMorgan Chase", "Bank of America", "Standard Chartered", "Deutsche Bank", "Barclays",
  ];

  const BENEFICIARY_COUNTRIES = [
    "United States", "United Kingdom", "United Arab Emirates", "Singapore", "Germany",
    "France", "Australia", "Canada", "Japan", "Switzerland", "Hong Kong", "Other",
  ];

  const PAYMENT_PURPOSES = [
    "Family Maintenance", "Education Fees", "Business Payment", "Goods Purchase",
    "Services Rendered", "Property Purchase", "Investment", "Loan Repayment", "Other",
  ];

  const CURRENCIES = { INR: "INR — Indian Rupee", USD: "USD — US Dollar", EUR: "EUR — Euro", GBP: "GBP — British Pound" };
  const CURRENCY_SYMBOLS = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };

  // Real-world per-channel amount rules (RBI/NPCI-style limits used for client-side hints + validation)
  const AMOUNT_RULES = {
    RTGS: { min: 200000, minMsg: "RTGS requires a minimum of ₹2,00,000 per transaction" },
    UPI: { max: 100000, maxMsg: "UPI transactions cannot exceed ₹1,00,000 per transaction" },
    IMPS: { max: 500000, maxMsg: "IMPS transactions cannot exceed ₹5,00,000 per transaction" },
  };

  function amountHint(channel) {
    const rule = AMOUNT_RULES[channel];
    if (!rule) return "";
    if (rule.min) return `Minimum ₹${rule.min.toLocaleString("en-IN")} per transaction`;
    if (rule.max) return `Maximum ₹${rule.max.toLocaleString("en-IN")} per transaction`;
    return "";
  }

  const ACCOUNT_LABELS = {
    UPI: { source: "Payer UPI ID", destination: "Payee UPI ID", sourcePlaceholder: "payer@bank", destinationPlaceholder: "payee@bank" },
    NEFT: { source: "Sender Account Number", destination: "Beneficiary Account Number", sourcePlaceholder: "e.g. 000123456789", destinationPlaceholder: "e.g. 000987654321" },
    RTGS: { source: "Sender Account Number", destination: "Beneficiary Account Number", sourcePlaceholder: "e.g. 000123456789", destinationPlaceholder: "e.g. 000987654321" },
    IMPS: { source: "Sender Account Number", destination: "Beneficiary Account Number", sourcePlaceholder: "e.g. 000123456789", destinationPlaceholder: "e.g. 000987654321" },
    SWIFT: { source: "Sender Account Number", destination: "Beneficiary Account Number", sourcePlaceholder: "e.g. 000123456789", destinationPlaceholder: "e.g. 000987654321" },
    WIRE_TRANSFER: { source: "Sender Account Number", destination: "Beneficiary Account Number", sourcePlaceholder: "e.g. 000123456789", destinationPlaceholder: "e.g. 000987654321" },
  };

  function accountLabels(channel) {
    return ACCOUNT_LABELS[channel] || { source: "Source Account", destination: "Destination Account", sourcePlaceholder: "e.g. ACC1001", destinationPlaceholder: "e.g. ACC2002" };
  }

  function isTerminal(status) {
    return status === "COMPLETED" || status === "FAILED";
  }

  // ---------------- View switching ----------------
  function switchView(view) {
    state.view = view;
    $all(".view").forEach((v) => v.classList.remove("active"));
    $(`#view-${view}`).classList.add("active");
    $all(".nav-item").forEach((n) => n.classList.toggle("active", n.dataset.view === view));
    if (view === "dashboard") loadPayments();
    if (view === "create") resetForm();
    if (view === "analytics") loadAnalytics();
  }

  $all(".nav-item").forEach((btn) => btn.addEventListener("click", () => switchView(btn.dataset.view)));
  $("#btn-new-payment").addEventListener("click", () => switchView("create"));
  $("#btn-cancel-create").addEventListener("click", () => switchView("dashboard"));

  // ---------------- Connection status ----------------
  async function checkConnection() {
    const dot = $("#pulse-dot") || null;
    try {
      await PaymentsApi.ping();
      $("#conn-status").textContent = "API Connected";
      document.querySelector(".pulse-dot").classList.add("online");
    } catch (e) {
      $("#conn-status").textContent = "API Offline";
      document.querySelector(".pulse-dot").classList.remove("online");
    }
  }

  // ---------------- Dashboard ----------------
  async function loadPayments() {
    const tbody = $("#payments-tbody");
    try {
      const page = await PaymentsApi.listPayments({
        status: state.status || undefined,
        riskLevel: state.riskLevel || undefined,
        search: state.search || undefined,
        page: state.page,
        size: state.size,
      });
      state.totalPages = page.totalPages;
      renderTable(page.content);
      renderPagination(page);
      updateStats(page.content);
      checkConnection();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state">⚠ Could not load payments. Is the backend running on ${window.APP_CONFIG.API_BASE_URL}?</td></tr>`;
      checkConnection();
    }
  }

  async function updateStats() {
    try {
      const [all, created, validated, sent, completed, failed] = await Promise.all([
        PaymentsApi.listPayments({ page: 0, size: 1 }),
        PaymentsApi.listPayments({ status: "CREATED", page: 0, size: 1 }),
        PaymentsApi.listPayments({ status: "VALIDATED", page: 0, size: 1 }),
        PaymentsApi.listPayments({ status: "SENT", page: 0, size: 1 }),
        PaymentsApi.listPayments({ status: "COMPLETED", page: 0, size: 1 }),
        PaymentsApi.listPayments({ status: "FAILED", page: 0, size: 1 }),
      ]);
      $("#stat-total").textContent = all.totalElements;
      $("#stat-created").textContent = created.totalElements;
      $("#stat-validated").textContent = validated.totalElements;
      $("#stat-sent").textContent = sent.totalElements;
      $("#stat-completed").textContent = completed.totalElements;
      $("#stat-failed").textContent = failed.totalElements;
    } catch (e) { /* silent */ }
  }

  function renderTable(payments) {
    const tbody = $("#payments-tbody");
    if (!payments || payments.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No payments found. Create your first payment!</td></tr>`;
      return;
    }
    tbody.innerHTML = payments.map((p) => `
      <tr data-id="${p.id}">
        <td class="mono">${p.id.substring(0, 8)}…</td>
        <td><span class="method-chip">${methodIcon(p.paymentMethod)} ${p.paymentMethod}</span></td>
        <td><strong>${formatMoney(p.amount, p.currency)}</strong></td>
        <td class="mono">${p.destinationAccount}</td>
        <td><span class="status-badge status-${p.status}">${p.status}</span></td>
        <td>${riskBadge(p.riskLevel)}</td>
        <td>${timeAgo(p.createdAt)}</td>
        <td>›</td>
      </tr>
    `).join("");

    $all("#payments-tbody tr[data-id]").forEach((row) => {
      row.addEventListener("click", () => openDetails(row.dataset.id));
    });
  }

  function renderPagination(page) {
    const el = $("#pagination");
    if (page.totalPages <= 1) { el.innerHTML = ""; return; }
    let html = "";
    for (let i = 0; i < page.totalPages; i++) {
      html += `<button data-page="${i}" class="${i === page.page ? "active" : ""}">${i + 1}</button>`;
    }
    el.innerHTML = html;
    $all("#pagination button").forEach((btn) => {
      btn.addEventListener("click", () => { state.page = Number(btn.dataset.page); loadPayments(); });
    });
  }

  $("#search-input").addEventListener("input", debounce((e) => {
    state.search = e.target.value.trim();
    state.page = 0;
    loadPayments();
  }, 350));

  $all(".tab").forEach((tab) => tab.addEventListener("click", () => {
    $all(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    state.status = tab.dataset.status;
    state.page = 0;
    loadPayments();
  }));

  $("#risk-filter").addEventListener("change", (e) => {
    state.riskLevel = e.target.value;
    state.page = 0;
    loadPayments();
  });

  $("#btn-refresh").addEventListener("click", loadPayments);

  function debounce(fn, delay) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
  }

  // ---------------- Analytics ----------------
  let volumeChart = null;
  let typeChart = null;
  let channelChart = null;

  function fmtSeconds(s) {
    if (s == null) return "—";
    if (s < 60) return `${s.toFixed(1)}s`;
    return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
  }

  function fmtTotalValue(byCurrency) {
    if (!byCurrency || Object.keys(byCurrency).length === 0) return "—";
    return Object.entries(byCurrency)
      .map(([ccy, amt]) => formatMoney(amt, ccy))
      .join(" · ");
  }

  async function loadAnalytics() {
    try {
      const data = await PaymentsApi.getAnalytics();
      renderAnalytics(data);
    } catch (err) {
      toast(`Failed to load analytics: ${err.message}`, "error");
    }
  }

  function renderAnalytics(data) {
    $("#analytics-mock-badge").classList.toggle("hidden", !data.mockData);

    const k = data.kpis || {};
    $("#kpi-total").textContent = k.totalPayments ?? 0;
    $("#kpi-domestic").textContent = k.domesticPayments ?? 0;
    $("#kpi-international").textContent = k.internationalPayments ?? 0;
    $("#kpi-success").textContent = k.successfulPayments ?? 0;
    $("#kpi-failed").textContent = k.failedPayments ?? 0;
    $("#kpi-rate").textContent = `${(k.successRate ?? 0).toFixed ? k.successRate.toFixed(2) : k.successRate}%`;
    $("#kpi-avg-time").textContent = fmtSeconds(k.averageProcessingTimeSeconds);
    $("#kpi-total-value").textContent = fmtTotalValue(k.totalTransactionValueByCurrency);

    renderVolumeChart(data.volumeTrend || []);
    renderTypeChart(data.typeDistribution || { domestic: 0, international: 0 });
    renderChannelChart(data.channelDistribution || []);
    renderFailureAnalysis(data.failureAnalysis || []);
    renderRecentActivity(data.recentActivity || []);
  }

  function renderVolumeChart(points) {
    const ctx = document.getElementById("chart-volume");
    const labels = points.map((p) => p.label);
    const counts = points.map((p) => p.count);
    if (volumeChart) volumeChart.destroy();
    volumeChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Payments",
          data: counts,
          borderColor: "#6c5ce7",
          backgroundColor: "rgba(108,92,231,0.12)",
          tension: 0.35,
          fill: true,
          pointBackgroundColor: "#6c5ce7",
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
  }

  function renderTypeChart(dist) {
    const ctx = document.getElementById("chart-type");
    if (typeChart) typeChart.destroy();
    typeChart = new Chart(ctx, {
      type: "pie",
      data: {
        labels: ["Domestic", "International"],
        datasets: [{ data: [dist.domestic || 0, dist.international || 0], backgroundColor: ["#6c5ce7", "#00c896"] }],
      },
      options: { responsive: true, plugins: { legend: { position: "bottom" } } },
    });
  }

  function renderChannelChart(channels) {
    const ctx = document.getElementById("chart-channel");
    if (channelChart) channelChart.destroy();
    channelChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: channels.map((c) => c.channel),
        datasets: [{ label: "Payments", data: channels.map((c) => c.count), backgroundColor: "#6c5ce7", borderRadius: 6 }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
  }

  function renderFailureAnalysis(failures) {
    const el = $("#failure-list");
    if (!failures.length) {
      el.innerHTML = `<div class="empty-analytics">No failures recorded 🎉</div>`;
      return;
    }
    el.innerHTML = failures.map((f) => `
      <div class="failure-row">
        <div class="fr-code">${f.errorCode}</div>
        <div class="failure-bar-track"><div class="failure-bar-fill" style="width:${f.percentage}%"></div></div>
        <div class="fr-count">${f.count} · ${f.percentage.toFixed ? f.percentage.toFixed(1) : f.percentage}%</div>
      </div>
    `).join("");
  }

  function renderRecentActivity(activity) {
    const el = $("#activity-list");
    if (!activity.length) {
      el.innerHTML = `<div class="empty-analytics">No activity yet.</div>`;
      return;
    }
    el.innerHTML = activity.map((a) => `
      <div class="activity-row">
        <div class="ar-top">
          <span class="ar-action">${a.action}</span>
          <span class="ar-time">${timeAgo(a.timestamp)}</span>
        </div>
        <div class="ar-meta">${a.performedBy || "SYSTEM"} · ${a.previousStatus ? `${a.previousStatus} → ` : ""}${a.currentStatus}${a.remarks ? ` · ${a.remarks}` : ""}</div>
      </div>
    `).join("");
  }

  // ---------------- Payment Details Modal ----------------
  async function openDetails(id) {
    state.openPaymentId = id;
    $("#details-modal").classList.add("open");
    $("#details-content").innerHTML = "Loading…";
    await refreshDetails(id);
  }

  async function refreshDetails(id) {
    try {
      const [payment, history, risk] = await Promise.all([
        PaymentsApi.getPayment(id),
        PaymentsApi.getHistory(id),
        PaymentsApi.getRisk(id).catch(() => null),
      ]);
      renderDetails(payment, history, risk);
    } catch (err) {
      $("#details-content").innerHTML = `<div class="error-box"><strong>Failed to load payment</strong>${err.message}</div>`;
    }
  }

  function renderDetails(p, history, risk) {
    const failureHtml = renderFailureSection(p, history);
    const methodDetailsHtml = renderMethodDetails(p);
    const riskHtml = renderRiskPanel(p, risk);

    const auditHtml = history.map((h) => `
      <div class="timeline-item">
        <div class="t-status">${h.action || (h.fromStatus ? `${h.fromStatus} → ${h.toStatus}` : `${h.toStatus}`)}</div>
        <div class="t-meta">${formatDate(h.changedAt)} · performed by ${h.triggeredBy}${h.fromStatus ? ` · ${h.fromStatus} → ${h.toStatus}` : ` · → ${h.toStatus}`}</div>
        ${h.notes ? `<div class="t-notes">${h.notes}</div>` : ""}
      </div>
    `).join("") || `<div class="t-meta">No audit history yet.</div>`;

    $("#details-content").innerHTML = `
      <div class="detail-header">
        <div>
          <div class="detail-amount">${formatMoney(p.amount, p.currency)}</div>
          <div class="detail-id">ID: ${p.id}</div>
        </div>
        <span class="status-badge status-${p.status}">${p.status}</span>
      </div>

      <div class="detail-panel" data-panel="details">
        ${failureHtml}
        <div class="detail-grid">
          <div class="detail-item"><div class="label">Payment ID</div><div class="value mono">${p.id}</div></div>
          <div class="detail-item"><div class="label">Reference</div><div class="value">${p.reference || "—"}</div></div>
          <div class="detail-item"><div class="label">Amount</div><div class="value">${formatMoney(p.amount, p.currency)}</div></div>
          <div class="detail-item"><div class="label">Currency</div><div class="value">${p.currency}</div></div>
          <div class="detail-item"><div class="label">Payment Type</div><div class="value">${p.paymentType || "—"}</div></div>
          <div class="detail-item"><div class="label">Payment Channel</div><div class="value">${methodIcon(p.paymentMethod)} ${p.paymentMethod}</div></div>
          <div class="detail-item"><div class="label">Current Status</div><div class="value"><span class="status-badge status-${p.status}">${p.status}</span></div></div>
          <div class="detail-item"><div class="label">${accountLabels(p.paymentMethod).source}</div><div class="value mono">${p.sourceAccount}</div></div>
          <div class="detail-item"><div class="label">${accountLabels(p.paymentMethod).destination}</div><div class="value mono">${p.destinationAccount}</div></div>
          ${methodDetailsHtml}
          <div class="detail-item"><div class="label">Created Date</div><div class="value">${formatDate(p.createdAt)}</div></div>
          <div class="detail-item"><div class="label">Updated Date</div><div class="value">${formatDate(p.updatedAt)}</div></div>
        </div>
      </div>

      <div class="detail-panel hidden" data-panel="risk">
        ${riskHtml}
      </div>

      <div class="detail-panel hidden" data-panel="audit">
        <div class="timeline-title">Audit Trail</div>
        <div class="timeline">${auditHtml}</div>
      </div>
    `;

    $all("#detail-tabs .detail-tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === "details"));
    $all(".detail-panel").forEach((panel) => panel.classList.toggle("hidden", panel.dataset.panel !== "details"));

    if (p.status === "FAILED") {
      const retryBtn = document.getElementById("btn-retry-payment");
      if (retryBtn) retryBtn.addEventListener("click", () => retryPayment(p));
      const editBtn = document.getElementById("btn-edit-payment");
      if (editBtn) editBtn.addEventListener("click", () => editPayment(p));
    }

    const approveBtn = document.getElementById("btn-approve-risk");
    if (approveBtn) approveBtn.addEventListener("click", () => decideRisk(p.id, "APPROVE"));
    const rejectBtn = document.getElementById("btn-reject-risk");
    if (rejectBtn) rejectBtn.addEventListener("click", () => decideRisk(p.id, "REJECT"));
  }

  // ---------------- Risk Assessment (Bank Operator Fraud Review) ----------------
  function renderRiskPanel(p, risk) {
    if (!p.riskLevel) {
      return `<div class="t-meta">No fraud/risk assessment recorded for this payment.</div>`;
    }

    let banner = "";
    if (p.fraudStatus === "BLOCKED") {
      banner = `<div class="fraud-blocked-banner">⛔ Payment blocked due to high fraud risk.</div>`;
    } else if (p.fraudStatus === "UNDER_REVIEW") {
      banner = `
        <div class="fraud-review-banner">
          <div class="frb-title">⚠ This payment is held for bank operator review (MEDIUM risk).</div>
          <div class="fraud-review-actions">
            <button type="button" class="btn btn-approve" id="btn-approve-risk">Approve Payment</button>
            <button type="button" class="btn btn-reject" id="btn-reject-risk">Reject Payment</button>
          </div>
        </div>`;
    }

    const rulesList = (risk && risk.triggeredRules && risk.triggeredRules.length)
      ? risk.triggeredRules.map((r) => `<div class="risk-rule-item"><span class="rr-check">✓</span> ${r}</div>`).join("")
      : `<div class="t-meta">No specific risk rules triggered.</div>`;

    const fraudStatusLabel = { CLEARED: "Cleared", UNDER_REVIEW: "Under Review", BLOCKED: "Blocked" }[p.fraudStatus] || p.fraudStatus;

    return `
      ${banner}
      <div class="risk-summary-grid">
        <div class="risk-summary-card">
          <span class="rs-label">Risk Level</span>
          <span class="rs-value">${riskBadge(p.riskLevel)}</span>
        </div>
        <div class="risk-summary-card">
          <span class="rs-label">Risk Score</span>
          <span class="rs-value">${p.riskScore ?? "—"}/100</span>
        </div>
        <div class="risk-summary-card">
          <span class="rs-label">Fraud Status</span>
          <span class="rs-value">${fraudStatusLabel}</span>
        </div>
      </div>
      <div class="risk-rules-title">Triggered Risk Rules</div>
      <div class="risk-rules-list">${rulesList}</div>
      ${risk ? `<div class="risk-meta-line">Validated at ${formatDate(risk.assessmentTimestamp)} · Decision: ${risk.decision || "—"}</div>` : ""}
    `;
  }

  async function decideRisk(paymentId, decision) {
    const btnId = decision === "APPROVE" ? "btn-approve-risk" : "btn-reject-risk";
    const btn = document.getElementById(btnId);
    if (btn) { btn.disabled = true; btn.textContent = decision === "APPROVE" ? "Approving…" : "Rejecting…"; }
    try {
      await PaymentsApi.decideRisk(paymentId, decision);
      toast(decision === "APPROVE" ? "Payment approved — resuming processing." : "Payment rejected.", decision === "APPROVE" ? "success" : "error");
      await refreshDetails(paymentId);
      if (state.view === "dashboard") loadPayments();
    } catch (err) {
      toast(`Failed to ${decision.toLowerCase()} payment: ${err.message}`, "error");
      if (btn) { btn.disabled = false; btn.textContent = decision === "APPROVE" ? "Approve Payment" : "Reject Payment"; }
    }
  }

  $("#detail-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".detail-tab");
    if (!btn) return;
    $all("#detail-tabs .detail-tab").forEach((t) => t.classList.toggle("active", t === btn));
    $all(".detail-panel").forEach((panel) => panel.classList.toggle("hidden", panel.dataset.panel !== btn.dataset.tab));
  });


  // ---------------- Failure Details (Feature 1) ----------------
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

  function failureMeta(errorCode) {
    return FAILURE_META[errorCode] || { reason: "Processing Error", category: "TEMPORARY" };
  }

  function renderFailureSection(p, history) {
    if (p.status !== "FAILED") return "";
    const meta = failureMeta(p.errorCode);
    const failedEntry = [...history].reverse().find((h) => h.toStatus === "FAILED");
    const failedAt = failedEntry ? failedEntry.changedAt : p.updatedAt;

    let actionHtml;
    if (meta.category === "INVALID_INPUT") {
      actionHtml = `<button type="button" class="btn btn-primary" id="btn-edit-payment">Edit Payment</button>`;
    } else if (meta.category === "INSUFFICIENT_FUNDS") {
      actionHtml = `
        <button type="button" class="btn btn-primary" id="btn-retry-payment">Retry Payment</button>
        <div class="failure-helper">Retry after ensuring sufficient account balance.</div>`;
    } else {
      actionHtml = `<button type="button" class="btn btn-primary" id="btn-retry-payment">Retry Payment</button>`;
    }

    return `
      <div class="failure-section">
        <div class="failure-title">⚠ Failure Details</div>
        <div class="failure-grid">
          <div class="failure-item"><div class="label">Error Code</div><div class="value mono">${p.errorCode || "PROCESSING_ERROR"}</div></div>
          <div class="failure-item"><div class="label">Failure Reason</div><div class="value">${meta.reason}</div></div>
          <div class="failure-item span-2"><div class="label">Error Description</div><div class="value">${p.errorMessage || "Payment could not be processed."}</div></div>
          <div class="failure-item"><div class="label">Failed Timestamp</div><div class="value">${formatDate(failedAt)}</div></div>
        </div>
        <div class="failure-actions">${actionHtml}</div>
      </div>`;
  }

  function retryPayment(p) {
    const btn = document.getElementById("btn-retry-payment");
    if (btn) { btn.disabled = true; btn.textContent = "Retrying…"; }
    setTimeout(() => {
      toast(`Retry submitted for payment ${p.id.substring(0, 8)}… it will be reprocessed shortly.`, "success");
      $("#details-modal").classList.remove("open");
      state.openPaymentId = null;
    }, 900);
  }

  function editPayment(p) {
    $("#details-modal").classList.remove("open");
    state.openPaymentId = null;
    switchView("create");

    const channel = p.paymentMethod;
    const channelMeta = CHANNELS[channel];
    if (channelMeta) {
      selectPaymentType(channelMeta.type);
      selectChannel(channel);
      if (channelMeta.type === "INTERNATIONAL") $("#f-currency").value = p.currency;
    }
    $("#f-amount").value = p.amount;
    $("#f-source").value = p.sourceAccount || "";
    $("#f-destination").value = p.destinationAccount || "";
    $("#f-reference").value = p.reference || "";

    if (channel === "NEFT" || channel === "RTGS" || channel === "IMPS") {
      $("#f-sender-bank").value = p.senderBankName || "";
      $("#f-beneficiary-bank").value = p.beneficiaryBankName || "";
      $("#f-ifsc").value = p.ifscCode || "";
      if (channel === "IMPS") $("#f-mobile-or-account").value = p.mobileOrAccountNumber || "";
    } else if (channel === "SWIFT" || channel === "WIRE_TRANSFER") {
      $("#f-sender-bank").value = p.senderBankName || "";
      $("#f-beneficiary-bank").value = p.beneficiaryBankName || "";
      $("#f-swift-bic").value = p.swiftBicCode || "";
      $("#f-beneficiary-country").value = p.beneficiaryCountry || "";
      if (channel === "SWIFT") $("#f-payment-purpose").value = p.paymentPurpose || "";
      if (channel === "WIRE_TRANSFER") $("#f-routing-number").value = p.routingNumber || "";
    }
    toast("Review the corrected details and resubmit the payment.", "info");
  }

  function renderMethodDetails(p) {
    if (p.paymentMethod === "UPI") {
      return `<div class="detail-item"><div class="label">UPI ID</div><div class="value">${p.upiId || "—"}</div></div>`;
    }
    if (p.paymentMethod === "CARD") {
      return `
        <div class="detail-item"><div class="label">Card</div><div class="value">${p.cardNetwork || ""} ${p.cardNumberMasked || ""}</div></div>
        <div class="detail-item"><div class="label">Cardholder</div><div class="value">${p.cardHolderName || "—"}</div></div>`;
    }
    if (p.paymentMethod === "NETBANKING") {
      return `
        <div class="detail-item"><div class="label">Bank</div><div class="value">${p.bankName || "—"}</div></div>
        <div class="detail-item"><div class="label">Account Type</div><div class="value">${p.bankAccountType || "—"}</div></div>`;
    }
    if (p.paymentMethod === "NEFT" || p.paymentMethod === "RTGS" || p.paymentMethod === "IMPS") {
      return `
        <div class="detail-item"><div class="label">Sender Bank</div><div class="value">${p.senderBankName || "—"}</div></div>
        <div class="detail-item"><div class="label">Beneficiary Bank</div><div class="value">${p.beneficiaryBankName || "—"}</div></div>
        <div class="detail-item"><div class="label">IFSC Code</div><div class="value mono">${p.ifscCode || "—"}</div></div>
        ${p.paymentMethod === "IMPS" ? `<div class="detail-item"><div class="label">Mobile / Account No.</div><div class="value mono">${p.mobileOrAccountNumber || "—"}</div></div>` : ""}`;
    }
    if (p.paymentMethod === "SWIFT" || p.paymentMethod === "WIRE_TRANSFER") {
      return `
        <div class="detail-item"><div class="label">Sender Bank</div><div class="value">${p.senderBankName || "—"}</div></div>
        <div class="detail-item"><div class="label">Beneficiary Bank</div><div class="value">${p.beneficiaryBankName || "—"}</div></div>
        <div class="detail-item"><div class="label">SWIFT/BIC Code</div><div class="value mono">${p.swiftBicCode || "—"}</div></div>
        <div class="detail-item"><div class="label">Beneficiary Country</div><div class="value">${p.beneficiaryCountry || "—"}</div></div>
        ${p.paymentMethod === "SWIFT" ? `<div class="detail-item"><div class="label">Payment Purpose</div><div class="value">${p.paymentPurpose || "—"}</div></div>` : ""}
        ${p.paymentMethod === "WIRE_TRANSFER" && p.routingNumber ? `<div class="detail-item"><div class="label">Routing Number</div><div class="value mono">${p.routingNumber}</div></div>` : ""}`;
    }
    return "";
  }

  $("#close-details").addEventListener("click", () => {
    $("#details-modal").classList.remove("open");
    state.openPaymentId = null;
  });
  $("#details-modal").addEventListener("click", (e) => {
    if (e.target.id === "details-modal") {
      $("#details-modal").classList.remove("open");
      state.openPaymentId = null;
    }
  });

  // ---------------- Create Payment ----------------
  function populateSelect(selectEl, values) {
    if (!selectEl) return;
    const current = selectEl.value;
    selectEl.innerHTML = values.map((v) => `<option value="${v}">${v}</option>`).join("");
    if (values.includes(current)) selectEl.value = current;
  }

  function updateCurrencyOptions(paymentType) {
    const codes = paymentType === "DOMESTIC" ? ["INR"] : ["USD", "GBP", "EUR", "INR"];
    $("#f-currency").innerHTML = codes.map((c) => `<option value="${c}">${CURRENCIES[c]}</option>`).join("");
    $("#f-currency").value = codes[0];
    $("#currency-prefix").textContent = CURRENCY_SYMBOLS[codes[0]] || codes[0];
  }

  function selectPaymentType(type) {
    state.paymentType = type;
    state.channel = null;
    $all(".type-card").forEach((c) => c.classList.toggle("active", c.dataset.type === type));
    $("#channel-section").classList.remove("hidden");
    $("#channel-cards-domestic").classList.toggle("hidden", type !== "DOMESTIC");
    $("#channel-cards-international").classList.toggle("hidden", type !== "INTERNATIONAL");
    $all(".channel-card").forEach((c) => c.classList.remove("active"));
    $("#payment-form").classList.add("hidden");
    updateCurrencyOptions(type);
  }

  function updateFormForChannel(channel) {
    const labels = accountLabels(channel);
    $("#label-source").textContent = labels.source;
    $("#label-destination").textContent = labels.destination;
    $("#f-source").placeholder = labels.sourcePlaceholder;
    $("#f-destination").placeholder = labels.destinationPlaceholder;

    const isUpi = channel === "UPI";
    $("#f-source").maxLength = isUpi ? 256 : 18;
    $("#f-destination").maxLength = isUpi ? 256 : 18;
    $("#f-source").inputMode = isUpi ? "email" : "numeric";
    $("#f-destination").inputMode = isUpi ? "email" : "numeric";
    $("#hint-source").textContent = isUpi ? "Valid UPI VPA e.g. name@bank" : "9-18 digit numeric account number";
    $("#hint-destination").textContent = isUpi ? "Valid UPI VPA e.g. name@bank" : "9-18 digit numeric account number";
    $("#hint-amount").textContent = amountHint(channel);

    $all(".channel-fields").forEach((f) => {
      const applicable = f.dataset.for.split(",").includes(channel);
      f.classList.toggle("hidden", !applicable);
    });

    const bankList = CHANNELS[channel].type === "INTERNATIONAL" ? INTERNATIONAL_BANKS : DOMESTIC_BANKS;
    populateSelect($("#f-sender-bank"), bankList);
    populateSelect($("#f-beneficiary-bank"), bankList);
    populateSelect($("#f-beneficiary-country"), BENEFICIARY_COUNTRIES);
    populateSelect($("#f-payment-purpose"), PAYMENT_PURPOSES);
  }

  function selectChannel(channel) {
    state.channel = channel;
    $all(".channel-card").forEach((c) => c.classList.toggle("active", c.dataset.channel === channel));
    $("#payment-form").classList.remove("hidden");
    updateFormForChannel(channel);
  }

  $all(".type-card").forEach((card) => card.addEventListener("click", () => selectPaymentType(card.dataset.type)));
  $all(".channel-card").forEach((card) => card.addEventListener("click", () => selectChannel(card.dataset.channel)));

  // ---------------- Real-time strict input restrictions (typing-level) ----------------
  function restrictInput(el, transformFn) {
    if (!el) return;
    el.addEventListener("input", () => {
      const caretFromEnd = el.value.length - el.selectionStart;
      const transformed = transformFn(el.value);
      if (transformed !== el.value) {
        el.value = transformed;
        const pos = Math.max(0, el.value.length - caretFromEnd);
        el.setSelectionRange(pos, pos);
      }
    });
  }

  // IFSC: uppercase letters + digits only, max 11 chars
  restrictInput($("#f-ifsc"), (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11));
  // SWIFT/BIC: uppercase letters + digits only, max 11 chars
  restrictInput($("#f-swift-bic"), (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11));
  // Routing number: digits only, max 9
  restrictInput($("#f-routing-number"), (v) => v.replace(/\D/g, "").slice(0, 9));
  // Mobile or account number (IMPS): digits only, max 18
  restrictInput($("#f-mobile-or-account"), (v) => v.replace(/\D/g, "").slice(0, 18));

  // Source/Destination: digits-only for bank-transfer channels, free VPA charset for UPI
  function restrictAccountField(el) {
    if (!el) return;
    el.addEventListener("input", () => {
      if (state.channel === "UPI") {
        const filtered = el.value.replace(/[^\w.+\-@]/g, "").slice(0, 256);
        if (filtered !== el.value) el.value = filtered;
      } else if (state.channel) {
        const filtered = el.value.replace(/\D/g, "").slice(0, 18);
        if (filtered !== el.value) el.value = filtered;
      }
    });
  }
  restrictAccountField($("#f-source"));
  restrictAccountField($("#f-destination"));

  // Amount: block more than 2 decimal places as the user types
  $("#f-amount").addEventListener("input", (e) => {
    const v = e.target.value;
    if (v.includes(".") && v.split(".")[1].length > 2) {
      e.target.value = parseFloat(v).toFixed(2);
    }
  });

  $("#f-currency").addEventListener("change", (e) => {
    $("#currency-prefix").textContent = CURRENCY_SYMBOLS[e.target.value] || e.target.value;
  });

  function resetForm() {
    $("#payment-form").reset();
    $all(".error-text").forEach((e) => (e.textContent = ""));
    state.paymentType = null;
    state.channel = null;
    $all(".type-card").forEach((c) => c.classList.remove("active"));
    $all(".channel-card").forEach((c) => c.classList.remove("active"));
    $("#channel-section").classList.add("hidden");
    $("#channel-cards-domestic").classList.add("hidden");
    $("#channel-cards-international").classList.add("hidden");
    $("#payment-form").classList.add("hidden");
    $("#currency-prefix").textContent = "₹";
  }

  function clearErrors() {
    $all(".error-text").forEach((e) => (e.textContent = ""));
  }

  function setError(id, message) {
    const el = document.getElementById(id);
    if (el) el.textContent = message;
  }

  function buildPayload() {
    const channel = state.channel;
    const payload = {
      amount: parseFloat($("#f-amount").value),
      currency: $("#f-currency").value,
      sourceAccount: $("#f-source").value.trim(),
      destinationAccount: $("#f-destination").value.trim(),
      paymentMethod: channel,
      paymentType: state.paymentType,
      reference: $("#f-reference").value.trim() || null,
      idempotencyKey: crypto.randomUUID ? crypto.randomUUID() : `key-${Date.now()}-${Math.random()}`,
    };

    if (channel === "UPI") {
      // The payee's VPA is what actually resolves the recipient in a real UPI transfer.
      payload.upiDetails = { upiId: payload.destinationAccount };
    } else if (channel === "NEFT" || channel === "RTGS" || channel === "IMPS") {
      payload.bankTransferDetails = {
        senderBank: $("#f-sender-bank").value,
        beneficiaryBank: $("#f-beneficiary-bank").value,
        ifscCode: $("#f-ifsc").value.trim().toUpperCase(),
        mobileOrAccountNumber: channel === "IMPS" ? $("#f-mobile-or-account").value.trim() : null,
      };
    } else if (channel === "SWIFT" || channel === "WIRE_TRANSFER") {
      payload.internationalTransferDetails = {
        senderBank: $("#f-sender-bank").value,
        beneficiaryBank: $("#f-beneficiary-bank").value,
        swiftBicCode: $("#f-swift-bic").value.trim().toUpperCase(),
        beneficiaryCountry: $("#f-beneficiary-country").value,
        paymentPurpose: channel === "SWIFT" ? $("#f-payment-purpose").value : null,
        routingNumber: channel === "WIRE_TRANSFER" ? ($("#f-routing-number").value.trim() || null) : null,
      };
    }
    return payload;
  }

  const UPI_VPA_PATTERN = /^[\w.+-]{2,256}@[A-Za-z]{2,64}$/;
  const ACCOUNT_NUMBER_PATTERN = /^\d{9,18}$/;
  const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  const SWIFT_BIC_PATTERN = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
  const MOBILE_OR_ACCOUNT_PATTERN = /^(\d{10}|\d{9,18})$/;
  const ROUTING_NUMBER_PATTERN = /^\d{9}$/;

  function validateClientSide(payload) {
    clearErrors();
    let ok = true;
    const channel = state.channel;
    const labels = accountLabels(channel);

    if (!payload.amount || payload.amount <= 0) { setError("err-amount", "Enter a valid amount greater than 0"); ok = false; }
    if (!payload.sourceAccount) { setError("err-source", `${labels.source} is required`); ok = false; }
    if (!payload.destinationAccount) { setError("err-destination", `${labels.destination} is required`); ok = false; }
    if (payload.sourceAccount && payload.destinationAccount &&
        payload.sourceAccount.toLowerCase() === payload.destinationAccount.toLowerCase()) {
      setError("err-destination", `Must differ from ${labels.source.toLowerCase()}`); ok = false;
    }

    // Real-world per-channel amount tier rules (RTGS minimum, UPI/IMPS caps)
    const amountRule = AMOUNT_RULES[channel];
    if (ok && amountRule && payload.amount) {
      if (amountRule.min && payload.amount < amountRule.min) { setError("err-amount", amountRule.minMsg); ok = false; }
      if (amountRule.max && payload.amount > amountRule.max) { setError("err-amount", amountRule.maxMsg); ok = false; }
    }

    if (channel === "UPI") {
      if (payload.sourceAccount && !UPI_VPA_PATTERN.test(payload.sourceAccount)) {
        setError("err-source", "Enter a valid UPI ID e.g. name@bank"); ok = false;
      }
      if (payload.destinationAccount && !UPI_VPA_PATTERN.test(payload.destinationAccount)) {
        setError("err-destination", "Enter a valid UPI ID e.g. name@bank"); ok = false;
      }
    } else if (channel === "NEFT" || channel === "RTGS" || channel === "IMPS" || channel === "SWIFT" || channel === "WIRE_TRANSFER") {
      if (payload.sourceAccount && !ACCOUNT_NUMBER_PATTERN.test(payload.sourceAccount)) {
        setError("err-source", "Account number must be 9-18 digits"); ok = false;
      }
      if (payload.destinationAccount && !ACCOUNT_NUMBER_PATTERN.test(payload.destinationAccount)) {
        setError("err-destination", "Account number must be 9-18 digits"); ok = false;
      }
    }

    if ((channel === "NEFT" || channel === "RTGS" || channel === "IMPS") &&
        (!payload.bankTransferDetails.ifscCode || !IFSC_PATTERN.test(payload.bankTransferDetails.ifscCode))) {
      setError("err-ifsc", "Enter a valid 11-character IFSC code e.g. HDFC0001234"); ok = false;
    }
    if (channel === "IMPS") {
      const val = payload.bankTransferDetails.mobileOrAccountNumber;
      if (!val || !MOBILE_OR_ACCOUNT_PATTERN.test(val)) {
        setError("err-mobile-or-account", "Enter a 10-digit mobile number or a 9-18 digit account number"); ok = false;
      }
    }
    if ((channel === "SWIFT" || channel === "WIRE_TRANSFER")) {
      const bic = payload.internationalTransferDetails.swiftBicCode;
      if (!bic || !SWIFT_BIC_PATTERN.test(bic)) {
        setError("err-swift-bic", "Enter a valid 8 or 11 character SWIFT/BIC code"); ok = false;
      }
    }
    if (channel === "WIRE_TRANSFER") {
      const routing = payload.internationalTransferDetails.routingNumber;
      if (routing && !ROUTING_NUMBER_PATTERN.test(routing)) {
        setError("err-routing-number", "Routing number must be exactly 9 digits"); ok = false;
      }
    }
    return ok;
  }

  // ---------------- Duplicate Payment Detection (Feature 2) ----------------
  let pendingDuplicatePayload = null;

  async function findPotentialDuplicate(payload) {
    try {
      const recent = await PaymentsApi.listPayments({ page: 0, size: 20, sortBy: "createdAt", direction: "DESC" });
      const cutoff = Date.now() - 2 * 60 * 1000;
      return (recent.content || []).find((p) => {
        const createdAt = new Date(p.createdAt).getTime();
        if (createdAt < cutoff) return false;
        return p.sourceAccount === payload.sourceAccount &&
          p.destinationAccount === payload.destinationAccount &&
          Number(p.amount) === Number(payload.amount) &&
          p.currency === payload.currency &&
          (p.reference || "") === (payload.reference || "");
      }) || null;
    } catch (e) {
      return null; // fail open — never block a real submission because the duplicate check itself failed
    }
  }

  function showDuplicateDialog(duplicate, payload) {
    pendingDuplicatePayload = payload;
    $("#duplicate-card").innerHTML = `
      <div class="detail-item"><div class="label">Payment ID</div><div class="value mono">${duplicate.id}</div></div>
      <div class="detail-item"><div class="label">Reference</div><div class="value">${duplicate.reference || "—"}</div></div>
      <div class="detail-item"><div class="label">Amount</div><div class="value">${formatMoney(duplicate.amount, duplicate.currency)}</div></div>
      <div class="detail-item"><div class="label">Source Account</div><div class="value mono">${duplicate.sourceAccount}</div></div>
      <div class="detail-item"><div class="label">Destination Account</div><div class="value mono">${duplicate.destinationAccount}</div></div>
      <div class="detail-item"><div class="label">Created Time</div><div class="value">${formatDate(duplicate.createdAt)}</div></div>
      <div class="detail-item"><div class="label">Status</div><div class="value"><span class="status-badge status-${duplicate.status}">${duplicate.status}</span></div></div>
    `;
    $("#duplicate-modal").classList.add("open");
  }

  function closeDuplicateDialog() {
    $("#duplicate-modal").classList.remove("open");
    pendingDuplicatePayload = null;
  }

  $("#close-duplicate").addEventListener("click", closeDuplicateDialog);
  $("#btn-cancel-duplicate").addEventListener("click", closeDuplicateDialog);
  $("#duplicate-modal").addEventListener("click", (e) => {
    if (e.target.id === "duplicate-modal") closeDuplicateDialog();
  });
  $("#btn-create-anyway").addEventListener("click", async () => {
    const payload = pendingDuplicatePayload;
    closeDuplicateDialog();
    if (payload) await submitPayment(payload);
  });

  async function submitPayment(payload) {
    state.submitting = true;
    const submitBtn = $("#btn-submit-payment");
    submitBtn.disabled = true;
    $("#submit-label").textContent = "Processing…";

    try {
      const created = await PaymentsApi.createPayment(payload);
      toast(`Payment created — status: ${created.status}`, "success");
      switchView("dashboard");
      setTimeout(() => openDetails(created.id), 400);
    } catch (err) {
      const errorCode = err.body && err.body.errorCode;
      const details = err.body && err.body.details;
      toast(`${errorCode || "Error"}: ${err.message}`, "error");
      if (details) {
        details.forEach((d) => {
          const [field] = d.split(":");
          const f = (field || "").toLowerCase();
          if (f.includes("amount")) setError("err-amount", d);
          if (f.includes("source")) setError("err-source", d);
          if (f.includes("destination")) setError("err-destination", d);
          if (f.includes("ifsc")) setError("err-ifsc", d);
          if (f.includes("mobileoraccountnumber")) setError("err-mobile-or-account", d);
          if (f.includes("swiftbiccode")) setError("err-swift-bic", d);
          if (f.includes("routingnumber")) setError("err-routing-number", d);
        });
      }
    } finally {
      state.submitting = false;
      submitBtn.disabled = false;
      $("#submit-label").textContent = "Pay Now";
    }
  }

  $("#payment-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (state.submitting || !state.channel) return;

    const payload = buildPayload();
    if (!validateClientSide(payload)) return;

    const duplicate = await findPotentialDuplicate(payload);
    if (duplicate) {
      showDuplicateDialog(duplicate, payload);
      return;
    }

    await submitPayment(payload);
  });

  // ---------------- Polling for live status updates ----------------
  setInterval(() => {
    if (state.view === "dashboard") loadPayments();
    if (state.openPaymentId) refreshDetails(state.openPaymentId);
  }, window.APP_CONFIG.POLL_INTERVAL_MS);

  // ---------------- Init ----------------
  loadPayments();
  checkConnection();
})();

