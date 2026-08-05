// PayFlow frontend application logic.
(() => {
  const state = {
    view: "dashboard",
    paymentType: null,
    channel: null,
    status: "",
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
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No payments found. Create your first payment!</td></tr>`;
      return;
    }
    tbody.innerHTML = payments.map((p) => `
      <tr data-id="${p.id}">
        <td class="mono">${p.id.substring(0, 8)}…</td>
        <td><span class="method-chip">${methodIcon(p.paymentMethod)} ${p.paymentMethod}</span></td>
        <td><strong>${formatMoney(p.amount, p.currency)}</strong></td>
        <td class="mono">${p.destinationAccount}</td>
        <td><span class="status-badge status-${p.status}">${p.status}</span></td>
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

  $("#btn-refresh").addEventListener("click", loadPayments);

  function debounce(fn, delay) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
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
      const [payment, history] = await Promise.all([
        PaymentsApi.getPayment(id),
        PaymentsApi.getHistory(id),
      ]);
      renderDetails(payment, history);
    } catch (err) {
      $("#details-content").innerHTML = `<div class="error-box"><strong>Failed to load payment</strong>${err.message}</div>`;
    }
  }

  function renderDetails(p, history) {
    const failureHtml = renderFailureSection(p, history);
    const methodDetailsHtml = renderMethodDetails(p);

    const timelineHtml = history.map((h) => `
      <div class="timeline-item">
        <div class="t-status">${h.fromStatus ? `${h.fromStatus} → ${h.toStatus}` : `${h.toStatus}`}</div>
        <div class="t-meta">${formatDate(h.changedAt)} · triggered by ${h.triggeredBy}</div>
        ${h.notes ? `<div class="t-notes">${h.notes}</div>` : ""}
      </div>
    `).join("") || `<div class="t-meta">No history yet.</div>`;

    $("#details-content").innerHTML = `
      <div class="detail-header">
        <div>
          <div class="detail-amount">${formatMoney(p.amount, p.currency)}</div>
          <div class="detail-id">ID: ${p.id}</div>
        </div>
        <span class="status-badge status-${p.status}">${p.status}</span>
      </div>

      ${failureHtml}

      <div class="detail-grid">
        <div class="detail-item"><div class="label">Method</div><div class="value">${methodIcon(p.paymentMethod)} ${p.paymentMethod}</div></div>
        <div class="detail-item"><div class="label">Reference</div><div class="value">${p.reference || "—"}</div></div>
        <div class="detail-item"><div class="label">${accountLabels(p.paymentMethod).source}</div><div class="value mono">${p.sourceAccount}</div></div>
        <div class="detail-item"><div class="label">${accountLabels(p.paymentMethod).destination}</div><div class="value mono">${p.destinationAccount}</div></div>
        ${methodDetailsHtml}
        <div class="detail-item"><div class="label">Created</div><div class="value">${formatDate(p.createdAt)}</div></div>
        <div class="detail-item"><div class="label">Last Updated</div><div class="value">${formatDate(p.updatedAt)}</div></div>
      </div>

      <div class="timeline-title">Status History</div>
      <div class="timeline">${timelineHtml}</div>
    `;

    if (p.status === "FAILED") {
      const retryBtn = document.getElementById("btn-retry-payment");
      if (retryBtn) retryBtn.addEventListener("click", () => retryPayment(p));
      const editBtn = document.getElementById("btn-edit-payment");
      if (editBtn) editBtn.addEventListener("click", () => editPayment(p));
    }
  }

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
      reference: $("#f-reference").value.trim() || null,
      idempotencyKey: crypto.randomUUID ? crypto.randomUUID() : `key-${Date.now()}-${Math.random()}`,
    };

    if (channel === "UPI") {
      payload.upiDetails = { upiId: payload.sourceAccount };
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
    if (channel === "UPI" && !/^[\w.+-]{2,256}@[A-Za-z]{2,64}$/.test(payload.sourceAccount || "")) {
      setError("err-source", "Enter a valid UPI ID e.g. name@bank"); ok = false;
    }
    if ((channel === "NEFT" || channel === "RTGS" || channel === "IMPS") &&
        (!payload.bankTransferDetails.ifscCode || !/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(payload.bankTransferDetails.ifscCode))) {
      setError("err-ifsc", "Enter a valid IFSC code e.g. HDFC0001234"); ok = false;
    }
    if (channel === "IMPS" && !payload.bankTransferDetails.mobileOrAccountNumber) {
      setError("err-mobile-or-account", "Enter a mobile number or account number"); ok = false;
    }
    if ((channel === "SWIFT" || channel === "WIRE_TRANSFER") && !payload.internationalTransferDetails.swiftBicCode) {
      setError("err-swift-bic", "Enter a valid SWIFT/BIC code"); ok = false;
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

