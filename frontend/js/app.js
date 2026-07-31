// PayFlow frontend application logic.
(() => {
  const state = {
    view: "dashboard",
    method: "UPI",
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
    return { UPI: "📱", CARD: "💳", NETBANKING: "🏦" }[method] || "💰";
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
    const errorHtml = p.status === "FAILED" ? `
      <div class="error-box">
        <strong>${p.errorCode || "PROCESSING_ERROR"}</strong>
        ${p.errorMessage || "Payment could not be processed."}
      </div>` : "";

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

      ${errorHtml}

      <div class="detail-grid">
        <div class="detail-item"><div class="label">Method</div><div class="value">${methodIcon(p.paymentMethod)} ${p.paymentMethod}</div></div>
        <div class="detail-item"><div class="label">Reference</div><div class="value">${p.reference || "—"}</div></div>
        <div class="detail-item"><div class="label">Source Account</div><div class="value mono">${p.sourceAccount}</div></div>
        <div class="detail-item"><div class="label">Destination Account</div><div class="value mono">${p.destinationAccount}</div></div>
        ${methodDetailsHtml}
        <div class="detail-item"><div class="label">Created</div><div class="value">${formatDate(p.createdAt)}</div></div>
        <div class="detail-item"><div class="label">Last Updated</div><div class="value">${formatDate(p.updatedAt)}</div></div>
      </div>

      <div class="timeline-title">Status History</div>
      <div class="timeline">${timelineHtml}</div>
    `;
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
  $all(".method-tab").forEach((tab) => tab.addEventListener("click", () => {
    $all(".method-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    state.method = tab.dataset.method;
    $all(".method-fields").forEach((f) => {
      f.classList.toggle("hidden", f.dataset.for !== state.method);
    });
  }));

  $("#f-currency").addEventListener("change", (e) => {
    const symbols = { INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "د.إ", SGD: "S$" };
    $("#currency-prefix").textContent = symbols[e.target.value] || e.target.value;
  });

  $("#f-card-number").addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/[^\d]/g, "").slice(0, 19)
      .replace(/(\d{4})(?=\d)/g, "$1 ");
  });

  function resetForm() {
    $("#payment-form").reset();
    $all(".error-text").forEach((e) => (e.textContent = ""));
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
    const payload = {
      amount: parseFloat($("#f-amount").value),
      currency: $("#f-currency").value,
      sourceAccount: $("#f-source").value.trim(),
      destinationAccount: $("#f-destination").value.trim(),
      paymentMethod: state.method,
      reference: $("#f-reference").value.trim() || null,
      idempotencyKey: crypto.randomUUID ? crypto.randomUUID() : `key-${Date.now()}-${Math.random()}`,
    };

    if (state.method === "UPI") {
      payload.upiDetails = { upiId: $("#f-upi-id").value.trim() };
    } else if (state.method === "CARD") {
      payload.cardDetails = {
        cardNumber: $("#f-card-number").value.replace(/\s/g, ""),
        cardHolderName: $("#f-card-name").value.trim(),
        cardExpiry: $("#f-card-expiry").value.trim(),
        cvv: $("#f-card-cvv").value.trim(),
      };
    } else if (state.method === "NETBANKING") {
      payload.netBankingDetails = {
        bankName: $("#f-bank-name").value,
        bankAccountType: $("#f-bank-account-type").value,
      };
    }
    return payload;
  }

  function validateClientSide(payload) {
    clearErrors();
    let ok = true;
    if (!payload.amount || payload.amount <= 0) { setError("err-amount", "Enter a valid amount greater than 0"); ok = false; }
    if (!payload.sourceAccount) { setError("err-source", "Source account is required"); ok = false; }
    if (!payload.destinationAccount) { setError("err-destination", "Destination account is required"); ok = false; }
    if (payload.sourceAccount && payload.destinationAccount &&
        payload.sourceAccount.toLowerCase() === payload.destinationAccount.toLowerCase()) {
      setError("err-destination", "Must differ from source account"); ok = false;
    }
    if (state.method === "UPI" && (!payload.upiDetails || !payload.upiDetails.upiId)) {
      setError("err-upi", "Enter a valid UPI ID"); ok = false;
    }
    if (state.method === "CARD" && (!payload.cardDetails || !payload.cardDetails.cardNumber || payload.cardDetails.cardNumber.length < 12)) {
      setError("err-card-number", "Enter a valid card number"); ok = false;
    }
    return ok;
  }

  $("#payment-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (state.submitting) return;

    const payload = buildPayload();
    if (!validateClientSide(payload)) return;

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
          if (field && field.toLowerCase().includes("amount")) setError("err-amount", d);
          if (field && field.toLowerCase().includes("source")) setError("err-source", d);
          if (field && field.toLowerCase().includes("destination")) setError("err-destination", d);
        });
      }
    } finally {
      state.submitting = false;
      submitBtn.disabled = false;
      $("#submit-label").textContent = "Pay Now";
    }
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

