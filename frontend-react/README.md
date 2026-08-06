# PayFlow — React Frontend (Migration)

This is a React + Vite port of the original vanilla-JS `frontend/` app, with **identical
styling and API contract** — `styles.css` was carried over unchanged, and `api.js`/`config.js`
are near line-for-line ports.

## Run it

```bash
cd frontend-react
npm install
npm run dev
```

Opens on **http://localhost:5173**. Make sure the backend's
`app.cors.allowed-origins` (in `application.properties`) includes this origin
(already added).

## What's ported (feature-complete)

- Dashboard: stats, search, status/risk filters, pagination, live polling
- New Payment: type → channel → dynamic fields, full client-side validation parity,
  per-channel amount/IFSC/SWIFT-BIC/account-number hints, duplicate-payment detection modal
- Payment Details modal: Details / Risk Assessment / Audit Trail tabs
  (tab selection is now proper React state, so it **no longer resets on poll** —
  this fixes the bug present in the vanilla-JS version)
- Analytics: KPIs + Volume/Type/Channel charts (`react-chartjs-2`) + Failure Analysis + Recent Activity
- Toast notifications (React context-based)

## Known gaps vs. the vanilla-JS version (not yet ported)

- FAILED-payment **Retry** / **Edit & Resubmit** action buttons (prefill logic) in the details modal
- No client-routing (`react-router`) — view switching is still in-memory state, matching
  the original app's behavior 1:1

## Structure

```
src/
  api.js            – REST client (ported)
  config.js         – API base URL / poll interval (ported)
  utils.js          – formatMoney/formatDate/timeAgo/etc (ported)
  Toast.jsx         – toast notification context
  App.jsx           – sidebar + view switching shell
  pages/
    Dashboard.jsx
    CreatePayment.jsx
    Analytics.jsx
  components/
    PaymentDetailsModal.jsx
```

