// Shared formatting/display helpers (ported 1:1 from the vanilla-JS frontend).

export function formatMoney(amount, currency) {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: currency || "INR" }).format(amount);
  } catch (e) {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

export function formatDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function timeAgo(iso) {
  if (!iso) return "";
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function methodIcon(method) {
  return {
    UPI: "📱", CARD: "💳", NETBANKING: "🏦",
    NEFT: "🏦", RTGS: "🏛️", IMPS: "⚡", SWIFT: "🌐", WIRE_TRANSFER: "💸",
  }[method] || "💰";
}

const RISK_DOT = { LOW: "🟢", MEDIUM: "🟡", HIGH: "🔴" };
export function riskBadgeLabel(level) {
  if (!level) return { text: "—", cls: "" };
  return { text: `${RISK_DOT[level] || ""} ${level}`, cls: `risk-${level}` };
}

export function isTerminal(status) {
  return status === "COMPLETED" || status === "FAILED";
}

