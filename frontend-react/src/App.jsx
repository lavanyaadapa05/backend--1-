import { useEffect, useState } from "react";
import { PaymentsApi } from "./api.js";
import Dashboard from "./pages/Dashboard.jsx";
import CreatePayment from "./pages/CreatePayment.jsx";
import Analytics from "./pages/Analytics.jsx";
import History from "./pages/History.jsx";
import PaymentDetailsModal from "./components/PaymentDetailsModal.jsx";
import ThemeToggle, { useTheme } from "./ThemeToggle.jsx";

const NAV_ITEMS = [
  { view: "dashboard", label: "Dashboard", emoji: "🏠" },
  { view: "create", label: "New Payment", emoji: "💸" },
  { view: "analytics", label: "Analytics", emoji: "📈" },
  { view: "history", label: "History", emoji: "🕘" },
];

export default function App() {
  const [view, setView] = useState("dashboard");
  const [connected, setConnected] = useState(false);
  const [theme, setTheme] = useTheme();
  const [navOpen, setNavOpen] = useState(false);
  // Lifted up to App level so the details popup (Details / Risk Assessment /
  // Audit Trail tabs) can be opened automatically right after a payment is
  // created from the "New Payment" screen — same as clicking a row on the
  // Dashboard — and stays open across a view switch.
  const [openPaymentId, setOpenPaymentId] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function checkConnection() {
      try {
        await PaymentsApi.ping();
        if (!cancelled) setConnected(true);
      } catch (e) {
        if (!cancelled) setConnected(false);
      }
    }
    checkConnection();
    const id = setInterval(checkConnection, 8000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  function go(v) {
    setView(v);
    setNavOpen(false);
  }

  return (
    <div className="app-shell top-layout">
      <header className="topbar">
        <div className="topbar-brand">
          <div className="brand-mark"><span>💎</span></div>
          <span>PayFlow</span>
        </div>

        <nav className="topnav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.view}
              className={`nav-item ${view === item.view ? "active" : ""}`}
              onClick={() => go(item.view)}
            >
              <span className="nav-emoji" aria-hidden="true">{item.emoji}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="topbar-actions">
          <div className="conn-status">
            <div className={`pulse-dot ${connected ? "online" : ""}`} />
            <span>{connected ? "Connected" : "Offline"}</span>
          </div>
          <ThemeToggle theme={theme} onToggle={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} />
          <button
            type="button"
            className={`nav-burger ${navOpen ? "open" : ""}`}
            aria-label="Toggle navigation"
            onClick={() => setNavOpen((o) => !o)}
          >
            <span /><span /><span />
          </button>
        </div>
      </header>

      {navOpen && (
        <div className="mobile-nav-panel">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.view}
              className={`nav-item ${view === item.view ? "active" : ""}`}
              onClick={() => go(item.view)}
            >
              <span className="nav-emoji" aria-hidden="true">{item.emoji}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </div>
      )}
      {navOpen && <div className="sidebar-scrim" onClick={() => setNavOpen(false)} />}

      <main className="main">
        <section className={`view ${view === "dashboard" ? "active" : ""}`}>
          {view === "dashboard" && (
            <Dashboard
              onNewPayment={() => setView("create")}
              onOpenPayment={setOpenPaymentId}
              refreshToken={refreshToken}
            />
          )}
        </section>
        <section className={`view ${view === "create" ? "active" : ""}`}>
          {view === "create" && (
            <CreatePayment
              onDone={() => setView("dashboard")}
              onCreated={(id) => {
                setView("dashboard");
                setOpenPaymentId(id);
                setRefreshToken((n) => n + 1);
              }}
            />
          )}
        </section>
        <section className={`view ${view === "analytics" ? "active" : ""}`}>
          {view === "analytics" && <Analytics />}
        </section>
        <section className={`view ${view === "history" ? "active" : ""}`}>
          {view === "history" && <History onOpenPayment={setOpenPaymentId} />}
        </section>
      </main>

      {openPaymentId && (
        <PaymentDetailsModal
          paymentId={openPaymentId}
          onClose={() => setOpenPaymentId(null)}
          onChanged={() => setRefreshToken((n) => n + 1)}
        />
      )}
    </div>
  );
}



