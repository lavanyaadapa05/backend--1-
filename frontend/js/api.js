// Thin wrapper around the Payments REST API.
const PaymentsApi = (() => {
  const BASE = window.APP_CONFIG.API_BASE_URL;

  async function request(path, options = {}) {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });

    let body = null;
    const text = await res.text();
    if (text) {
      try { body = JSON.parse(text); } catch (e) { body = text; }
    }

    if (!res.ok) {
      const error = new Error((body && body.message) || `Request failed with status ${res.status}`);
      error.status = res.status;
      error.body = body;
      throw error;
    }
    return body;
  }

  return {
    createPayment(payload) {
      return request("/payments", { method: "POST", body: JSON.stringify(payload) });
    },
    getPayment(id) {
      return request(`/payments/${id}`);
    },
    listPayments({ status, search, page = 0, size = 8, sortBy = "createdAt", direction = "DESC" } = {}) {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (search) params.set("search", search);
      params.set("page", page);
      params.set("size", size);
      params.set("sortBy", sortBy);
      params.set("direction", direction);
      return request(`/payments?${params.toString()}`);
    },
    getHistory(id) {
      return request(`/payments/${id}/history`);
    },
    updateStatus(id, status, notes) {
      return request(`/payments/${id}/status`, { method: "PATCH", body: JSON.stringify({ status, notes }) });
    },
    ping() {
      return request("/payments?page=0&size=1");
    },
  };
})();

