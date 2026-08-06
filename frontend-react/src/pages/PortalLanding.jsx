export default function PortalLanding({ onSelect }) {
  return <main className="portal-landing">
    <div className="portal-brand"><span>✦</span> PayFlow</div>
    <section className="portal-intro"><span className="page-kicker">PAYMENT OPERATIONS PLATFORM</span><h1>Choose your workspace</h1><p>Continue to the portal designed for your responsibilities. This prototype does not require sign-in.</p></section>
    <div className="portal-options">
      <article className="portal-card"><div className="portal-icon">◉</div><span className="portal-label">CUSTOMER PORTAL</span><h2>Manage your payments</h2><p>Create payments and follow their status, audit history, and risk assessment.</p><button className="btn btn-primary" onClick={() => onSelect("customer")}>Enter Customer Portal →</button></article>
      <article className="portal-card bank"><div className="portal-icon">▦</div><span className="portal-label">BANK OPERATIONS PORTAL</span><h2>Operate with clarity</h2><p>Monitor system-wide payment operations, analytics, risks, and processing revenue.</p><button className="btn btn-primary" onClick={() => onSelect("bank")}>Enter Bank Portal →</button></article>
    </div>
  </main>;
}
