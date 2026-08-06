// Thin wrapper around the Payments REST API. (Ported 1:1 from the vanilla-JS frontend.)
import { APP_CONFIG } from "./config.js";

const BASE = APP_CONFIG.API_BASE_URL;
const CUSTOMER_KEY = "payflow-customer-id";

function customerId() {
  let id = localStorage.getItem(CUSTOMER_KEY);
  if (!id) { id = `customer-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`; localStorage.setItem(CUSTOMER_KEY, id); }
  return id;
}

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

export const PaymentsApi = {
  createPayment(payload) {
    return request("/payments", { method: "POST", body: JSON.stringify(payload) });
  },
  getPayment(id) {
    return request(`/payments/${id}`);
  },
  listPayments({ status, riskLevel, search, customerId: scopeCustomerId, page = 0, size = 8, sortBy = "createdAt", direction = "DESC" } = {}) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (riskLevel) params.set("riskLevel", riskLevel);
    if (search) params.set("search", search);
    if (scopeCustomerId) params.set("customerId", scopeCustomerId);
    params.set("page", page);
    params.set("size", size);
    params.set("sortBy", sortBy);
    params.set("direction", direction);
    return request(`/payments?${params.toString()}`);
  },
  getHistory(id) {
    return request(`/payments/${id}/history`);
  },
  getRisk(id) {
    return request(`/payments/${id}/risk`);
  },
  decideRisk(id, decision, notes) {
    return request(`/payments/${id}/risk-decision`, { method: "PATCH", body: JSON.stringify({ decision, notes }) });
  },
  getAnalytics() {
    return request("/analytics");
  },
  getRevenue() { return request("/revenue"); },
  customerId,
  updateStatus(id, status, notes) {
    return request(`/payments/${id}/status`, { method: "PATCH", body: JSON.stringify({ status, notes }) });
  },
  ping() {
    return request("/payments?page=0&size=1");
  },
};

