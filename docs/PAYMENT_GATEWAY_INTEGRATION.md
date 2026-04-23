# Payment gateway integration — guidelines

This document describes how to integrate a real payment service provider (PSP) into **Cridora v2** without breaking buy flow, compliance, or reconciliation. It complements building **onboarding, KYC/KYB, buy/sell, dashboards, and portfolio** first; **payments can be added last** once those flows are stable.

## Current shape in the codebase

- **Buy flow (high level):** customer places an order → vendor accepts → customer completes payment → order becomes **`paid`**, stock and ledger follow backend logic.
- **Customer APIs (Django):** `POST .../orders/place/`, `GET/POST .../orders/<id>/` (POST used today to confirm payment after vendor acceptance). Compliance is enforced on place-order, payment completion, and sell-back creation (`customer_compliance_verification` in `backend/users/views.py`).
- **Frontend:** `frontend/src/pages/Payment.jsx` and `VITE_SIMULATED_PAYMENT` / `USE_SIMULATED_PAYMENT` in `frontend/src/config.js` control whether copy reflects a simulated gateway.
- **Order model:** `Order` statuses include `pending_vendor` → `vendor_accepted` → `paid` (see `backend/users/models.py`).

Treat **“order became paid”** as a **single server-side transition** that must eventually be driven by **PSP confirmation**, not only by the browser.

---

## Principles (do these when you integrate)

### 1. One authoritative “paid” transition

- Keep **one** code path that: validates the order is in **`vendor_accepted`**, applies **compliance** checks, updates **inventory**, and sets status to **`paid`**.
- The PSP integration should **call into** (or duplicate the logic of) that path after verification—avoid a second, divergent “mark paid” implementation.

### 2. Webhooks over redirect-only UX

- Users can close the tab after paying. **Treat PSP webhooks (or server-to-server confirmation)** as the source of truth for payment success.
- The payment page can poll or redirect for UX, but **reconciliation and ledger updates** should not depend on the client alone.

### 3. Idempotency

- Webhooks and retries can deliver the same event more than once. Use **idempotent** handling (e.g. store PSP event IDs, or safely no-op if order is already `paid`).

### 4. Simulated vs production

- Keep **one** business rule for “what paid means”; isolate **how** confirmation arrives:
  - **Development / staging:** optional simulated confirm (current POST-to-order pattern or a dev-only endpoint) with clear env flags.
  - **Production:** only mark paid after **signed webhook** or **server-side payment intent retrieval** from the PSP—never trust the client payload alone.

### 5. Amounts and metadata

- Create PSP sessions with **immutable references**: internal `order_id`, `order_ref`, and **exact amount + currency** already stored on `Order`. Reject webhook events where amount/currency/order binding does not match the database row.

### 6. Compliance before money

- Existing gates require **full customer KYC** (including verified bank where applicable) before place-order, payment completion, and sell-back. Do not bypass these when adding Stripe (or any PSP).

### 7. Secrets and PCI scope

- **Never** send raw card data through your API if the PSP offers **hosted fields / Checkout / Elements**—keep card data on the PSP’s domain/SDK.
- Store **API keys and webhook secrets** in environment variables (e.g. Railway), not in the repo. Rotate on compromise.

### 8. Refunds, disputes, and partial failures

- Plan early for **failed payments**, **refunds**, and **chargebacks** (even if phase 2): which **order states** are allowed, how vendor pool / ledger adjust, and how support operates.

---

## Suggested integration sequence

1. **PSP account** — test mode keys, webhook endpoint URL (staging first).
2. **Backend** — endpoint to **create** a payment (PaymentIntent / Checkout Session) tied to `order_id` with metadata; **webhook** handler to verify signature and mark order paid via the single transition.
3. **Frontend** — replace or augment “Confirm payment” with PSP redirect or embedded flow; after success, **refresh order** from API (webhook may arrive first).
4. **Observability** — structured logs for webhook receipt, idempotent skips, and mismatches (wrong amount, wrong order).
5. **Production** — live keys, webhook signing secret, monitoring, runbook for stuck `vendor_accepted` orders.

---

## Stripe (example mapping)

| Concern | Typical Stripe piece |
|--------|----------------------|
| Customer pays | Checkout Session or PaymentIntent |
| Server truth | Webhook `payment_intent.succeeded` / `checkout.session.completed` (confirm which event matches your flow) |
| Idempotency | Event ID deduplication; retrieve PI/Session server-side before mutating DB |
| Metadata | `order_id`, `order_ref`, `customer_id` on Session/Intent |

Other PSPs (regional acquirers, etc.) follow the same pattern: **create payment server-side → confirm via webhook → single paid transition**.

---

## Deploy notes (Railway)

- Add PSP env vars to the **backend** service (secret key, webhook secret, optional publishable key if the backend creates sessions).
- Frontend may need **publishable key** or session URL only—follow PSP docs for what must stay server-side.
- After changing **only** env vars, you usually **do not** need migrations; if you add DB columns for `payment_provider`, `psp_payment_id`, etc., ship **migrations** in the same release as the code (see `docs/RAILWAY_MIGRATIONS.md`).

---

## Checklist before going live

- [ ] Webhook signature verification enabled  
- [ ] Idempotent processing of duplicate events  
- [ ] Amount/currency/order cross-check against `Order` row  
- [ ] Compliance still enforced on payment completion  
- [ ] No production reliance on simulated payment flag  
- [ ] Runbook for support: stuck payment, refund request, dispute  

---

*This is engineering guidance, not legal or PCI advice. For UAE licensing, AML, and card-network rules, use qualified advisors.*
