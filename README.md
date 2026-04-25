# Cridora v2

Bullion marketplace platform: **customers** buy listed metal and can **sell back**; **vendors** manage catalog, pricing, and a live desk; **admins** run KYC/KYB, documents, bank review, fees, and sell-order funding steps.

This README describes **what is implemented and working today** so later work can **add features without unintentionally changing** this baseline. For deploy steps see `DEPLOY.md`; for DB migrations on Railway see `docs/RAILWAY_MIGRATIONS.md`; for future PSP work see `docs/PAYMENT_GATEWAY_INTEGRATION.md`.

## Stack

- **Backend:** Django, Django REST Framework, **JWT** (simplejwt), PostgreSQL (production).
- **Frontend:** React (Vite), React Router, Tailwind-style UI.
- **API prefix:** `/api/auth/` for auth, dashboards, orders, KYC, marketplace payload used by the app (`backend/cridora/urls.py`).
- **Other APIs:** `/api/spot-prices/`, `/api/dubai-retail-rates/`.

## Repository layout

- `backend/` — Django project (`manage.py`, apps under `users/`, etc.).
- `frontend/` — Vite React app (`src/pages`, `src/context`, …).
- `docs/` — Operational and integration notes (migrations, payment guidelines).
- `DEPLOY.md` — GitHub + Railway deployment.

## Roles and authentication

- **Single login**; role is `customer`, `vendor`, or `admin` on `User.user_type`.
- **JWT** access + refresh; frontend stores tokens and user snapshot in `localStorage` (`frontend/src/context/AuthContext.jsx`).
- **KYC/KYB pending does not block login**; **`is_active == false`** (admin freeze) blocks login.

## KYC (customers) and KYB (vendors)

- Both use **`User.kyc_status`:** `pending` | `verified` | `rejected`.
- **Compliance** is computed in `backend/users/compliance.py` and exposed on `GET /api/auth/me/` as `compliance` (`trading_allowed`, `pending_items`, …).

**Customer — required for `trading_allowed`**

- Admin **KYC approved** (`kyc_status == verified`).
- All **customer documents** verified: passport / national ID, proof of address, selfie (`KYCDocument.CUSTOMER_DOCS`).
- **Bank details** verified (`CustomerBankDetails` — treated as part of KYC).

**Vendor — required for `trading_allowed`**

- Admin **KYB approved** (`kyc_status == verified`).
- All **vendor documents** verified: trade license, company registration, owner ID, bank proof (`KYCDocument.VENDOR_DOCS`).

**Admin verification (manual)**

- Per-document verify/reject, bulk verify pending docs, customer bank verify/reject, **KYC approve/reject**, **KYB approve/reject**, user freeze/unfreeze (see `backend/users/urls.py`).
- Rejections and resubmissions interact with **`_suspend_account_verification_for_rereview`** where applicable (`backend/users/views.py`).

## What is restricted by compliance

**Customers** (when `trading_allowed` is false)

- Cannot **place orders**, **complete payment** on an order, or **create sell-back** orders (enforced in `backend/users/views.py`).

**Vendors**

- **Live trading desk** (list/act on pending buy orders and pending sell-backs): requires `trading_allowed` (`_vendor_desk_trading_gate`).
- **Catalog** create/update/delete and **GET own catalog** do **not** require full KYB (vendors can prepare listings while pending).

**Public marketplace**

- Lists only products from vendors with **`kyc_status == verified`** (`PublicMarketplaceView`).

Unauthenticated users can still **browse** the marketplace; trading requires login and passing compliance.

## Core business flows (working)

1. **Buy:** Customer (cleared) places order → **`pending_vendor`** → vendor accepts → **`vendor_accepted`** → customer confirms payment → **`paid`** (stock/ledger updated per backend logic).
2. **Sell-back:** Customer (cleared) creates sell order → vendor accept/reject → admin steps for funding/payout as implemented in admin sell-order views.
3. **Vendor:** Pricing (including optional feed fetch), schedule, catalog, inventory views, portfolio/analytics-style dashboard data, team/KYB docs per UI.
4. **Customer:** Dashboard with portfolio, holdings, ledger, orders, account/KYC, bank form.
5. **Admin:** Overview, users, KYC/KYB queues, documents, bank review, transactions, settlement snapshot, fees/config (including static feature-flag display), risk/audit UI (data may be empty depending on backend), password reset requests, sell-order queue.

## Payments (current baseline)

- **Stripe (optional):** if **`STRIPE_SECRET_KEY`** is set on the API, the Payment page offers **Pay with card** (Checkout Session in AED) and the order JSON includes `checkout_available` and (if set) `stripe_publishable_key` from **`STRIPE_PUBLISHABLE_KEY`**. The **webhook** `POST /api/webhooks/stripe/` marks the order `paid` after signed `checkout.session.completed` events. Set **`STRIPE_WEBHOOK_SECRET`** and **`FRONTEND_BASE_URL`** in production. See **`docs/PAYMENT_RUNBOOK.md`**, **`backend/.env.example`**, and **`docs/PAYMENT_GATEWAY_INTEGRATION.md`**.
- **Without Stripe:** same as before: confirm via **`POST /api/auth/orders/<id>/`** from the Payment page (simulated / manual for dev). When `STRIPE_SECRET_KEY` is set, that POST is **disabled** unless **`STRIPE_ALLOW_MANUAL_MARK_PAID=true`**.
- Frontend may show **simulated** copy when `VITE_SIMULATED_PAYMENT` is unset/true (`frontend/src/config.js`); the primary button is still Stripe when `checkout_available` from the API.

## Frontend routes (summary)

- Public: `/`, `/marketplace`, `/how-it-works`, `/vendors`, `/signin`, `/signup`, `/reset-password`.
- Protected: `/dashboard/customer`, `/dashboard/vendor`, `/dashboard/admin`, `/payment/:orderId`, `/sell-status/:sellOrderId` (`frontend/src/App.jsx`).

## “Finished baseline” — preserve unless intentionally changing

Treat the following as **stable contracts** for future features; change only with deliberate migrations and QA:

- **Compliance rules** in `backend/users/compliance.py` and admin approve preconditions (`customer_ready_for_kyc_approval`, `vendor_ready_for_kyb_approval`).
- **Order / sell-order status semantics** and when stock and balances update.
- **Marketplace visibility rule** (only KYB-verified vendors’ products).
- **Split between vendor catalog (always editable)** vs **live desk (KYB-gated)**.
- **JWT + role-based access** patterns and main dashboard API shapes consumed by the React app.

## Local development (high level)

- Backend: Python venv, install requirements, `migrate`, `runserver` from `backend/` (see `DEPLOY.md` for env vars).
- Frontend: `npm install` / `npm run dev` in `frontend/` with `VITE_API_ORIGIN` pointing at the API.

## Disclaimer

This software implements operational KYC/KYB and trading gates; it does **not** replace legal, licensing, AML, or PCI advice for your jurisdiction.
