# Cridora v2 — production readiness task list

Use this document for **sequential** work: complete tasks **in order** unless a note says it can run in parallel. After backend schema changes, follow **Git → Railway** every time so production stays consistent.

**Last implementation pass:** 2026-04-24 — see [Implemented in codebase](#implemented-in-codebase) below. (Stripe Checkout + webhook in same batch.)

**Related docs (read as needed):**

- `README.md` — baseline behavior and stack
- `DEPLOY.md` — GitHub + Railway setup, env vars, Dockerfile, CORS, health checks
- `docs/RAILWAY_MIGRATIONS.md` — linking Railway CLI, SSH migrations, S3 **and volumes**, troubleshooting 500s
- `docs/PAYMENT_GATEWAY_INTEGRATION.md` — PSP / Stripe integration principles
- `docs/PAYMENT_RUNBOOK.md` — ops: env vars, stuck orders, webhooks

---

## Railway: volume (MEDIA / KYC)

**Production is using a Railway volume** (persistent disk for the API service), so KYC and other `FileField` uploads under `MEDIA_ROOT` survive redeploys when the mount matches the app (see `backend/cridora/settings.py`: `DJANGO_MEDIA_ROOT`, `RAILWAY_VOLUME_MOUNT_PATH`).

- Mount path is typically alignable with `MEDIA_ROOT` (e.g. `/app/media` in the container).
- **Replicas:** one volume = **single replica** for that service (Railway limitation); scaling out would require S3 (or another shared store) for uploads—see `docs/RAILWAY_MIGRATIONS.md` Option A for catalog, same idea for KYC if you add instances later.
- **Catalog** images can still use **S3/R2** via `CATALOG_MEDIA_S3_*` even when a volume exists (recommended for multi-instance or CDN).

---

## Implemented in codebase (this repo, as of last update)

| Id | What | Where (indicative) |
|----|------|--------------------|
| **1.1** | Sell-back grams bounded by `buy_order.qty_grams` minus all **non-rejected** `SellOrder` rows; `select_for_update` on buy order. | `CustomerCreateSellOrderView` in `backend/users/views.py` |
| **1.2** | Payment: `transaction.atomic()` + `select_for_update()` on `Order`; idempotent with status re-check. | `CustomerOrderView.post` in `backend/users/views.py` |
| **1.3** | If `product.stock_qty < order.qty_units` at payment, **409 Conflict** (no more zeroing stock while marking paid). | `CustomerOrderView.post` |
| **1.4** | `Order.compliance_gates_at_payment` on model, aligned with migration `0023_...` (no new migration required). | `backend/users/models.py` |
| **2.1** | KYC upload: max **10 MB**, extensions **.pdf, .jpg, .jpeg, .png, .webp** | `_validate_kyc_file_upload` + `DocumentUploadView` in `backend/users/views.py` |
| **2.2** | **Scoped** DRF rate limits on login, register, vendor apply, forgot/reset/change password, document upload, JWT refresh | `DEFAULT_THROTTLE_RATES` in `backend/cridora/settings.py` (e.g. login `20/minute`, register `20/hour`, token refresh `30/minute`); `ScopedRateThrottle` on views in `views.py`; `ThrottledTokenRefreshView` in `users/jwt_throttle_views.py`; `users/urls.py` |
| **2.3** | **Shorter access JWT** (15 min) with **single-flight** refresh on `401` in `authFetch`; `refreshUser` uses `authFetch` for `/me/` | `SIMPLE_JWT` in `backend/cridora/settings.py`; `frontend/src/context/AuthContext.jsx` |
| **3.x** | **Stripe Checkout (AED)**, shared **mark paid** in `apply_mark_order_paid_for_customer`, **webhook** `POST /api/webhooks/stripe/`, `ProcessedStripeEvent` dedupe, `Order.payment_provider` + `stripe_checkout_session_id` | `users/payment.py`, `users/payment_stripe.py`, `cridora/urls.py`, migration `0031_...`; `Payment.jsx` when `checkout_available`; env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `FRONTEND_BASE_URL` |

**Not implemented yet (still open):** **3.1** (create Stripe test/live account in Dashboard — you must do that), S3 for catalog if needed, backups (4.3), automated tests (5.1).

---

## Conventions (for humans and agents)

- **Default repo root:** the folder that contains `backend/` and `frontend/`.
- **Do not** edit applied migrations; **add** new migration files when the model changes.
- **One logical change = one commit** (or a small, reviewable series) with a clear message.
- After **merging to the branch Railway deploys** (usually `main`), let Railway build, then run **migrations** if the release includes new migration files (see [Railway migrations workflow](#railway-migrations-workflow) below).
- This deploy uses a **volume**; still run `migrate` after schema-changing releases. No volume change is needed for a **code-only** release.

---

## Phase 0 — Repo and tooling (one-time; manual / ops)

| # | Task | Done |
|---|--------|------|
| 0.1 | Ensure Git remotes: `git remote -v` points at the correct GitHub repo (see `DEPLOY.md`). | [ ] |
| 0.2 | Install [Railway CLI](https://docs.railway.com/guides/cli); `railway login`. | [ ] |
| 0.3 | **Link** the project: from repo root, `railway link` → pick project + environment; verify with `railway status`. | [ ] |
| 0.4 | Note the **exact Railway service name** that runs Django / `gunicorn` (used in `railway ssh -s <NAME> …`). | [ ] |
| 0.5 | Production env vars on API service match `DEPLOY.md` (at minimum: `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=false`, `DJANGO_ALLOWED_HOSTS`, `DATABASE_URL` reference, CORS, CSRF). **Volume mount** present for KYC if using filesystem storage. | [ ] |
| 0.6 | Frontend: API origin set (`VITE_API_ORIGIN` and/or `CRIDORA_API_ORIGIN` per `DEPLOY.md`). | [ ] |

---

## Phase 1 — Data integrity and correctness (before real money)

| # | Task | Notes | Done |
|---|--------|--------|------|
| 1.1 | **Sell-back allocation** | Non-rejected sells + new qty ≤ lot; locked row. | [x] |
| 1.2 | **Payment completion** | Atomic + `select_for_update` on `Order`. | [x] |
| 1.3 | **Stock shortfall** | Reject with 409 if stock &lt; units (no oversell on pay). | [x] |
| 1.4 | **Order model ↔ DB** | `compliance_gates_at_payment` on `Order` model. | [x] |

---

## Phase 2 — Security and input hardening

| # | Task | Notes | Done |
|---|--------|--------|------|
| 2.1 | **KYC document uploads** | 10 MB max; PDF / JPG / PNG / WEBP. | [x] |
| 2.2 | **Rate limiting** | DRF `ScopedRateThrottle` + `DEFAULT_THROTTLE_RATES` (see implemented table). | [x] |
| 2.3 | **JWT lifetime** | Access **15 minutes**, refresh **7 days**; `authFetch` refresh + one retry. | [x] |

---

## Phase 3 — Payment service provider (PSP)

Complete **Phase 1** (done) before go-live. Integrate per `docs/PAYMENT_GATEWAY_INTEGRATION.md`.

| # | Task | Notes | Done |
|---|--------|--------|------|
| 3.1 | **PSP test account** and keys (test mode). | Human step in [Stripe Dashboard](https://dashboard.stripe.com). | [ ] |
| 3.2 | **Backend:** Checkout Session + metadata | `POST /api/auth/orders/<id>/checkout/` | [x] |
| 3.3 | **Webhook** | `POST /api/webhooks/stripe/`, `checkout.session.completed`, signature + amount + session id | [x] |
| 3.4 | **DB** | `payment_provider`, `stripe_checkout_session_id`, `ProcessedStripeEvent` | [x] |
| 3.5 | **Frontend** | `Pay with card` when `checkout_available`: else legacy confirm. | [x] |
| 3.6 | **Observability** | `logging` in `payment_stripe.py` (warnings/errors on webhook) | [x] |
| 3.7 | **Runbook** | `docs/PAYMENT_RUNBOOK.md` | [x] |

---

## Phase 4 — Media, storage, and operations

| # | Task | Notes | Done |
|---|--------|--------|------|
| 4.1 | **Catalog images:** S3/R2 if you need **multiple API replicas** or CDN; else volume + re-uploads can work for a single node. | `docs/RAILWAY_MIGRATIONS.md` | [ ] |
| 4.2 | **KYC / `MEDIA_ROOT` on Railway** | **Volume is attached** — confirm mount path and that `MEDIA_ROOT` points at the volume. If you **scale to &gt;1 replica** later, move KYC to object storage or add a shared layer. | [x] operational\* |
| 4.3 | **Backups:** Railway Postgres + volume snapshot policy; document RTO/RPO. | | [ ] |

\*Mark **unchecked** if your project has not yet attached the volume in Railway UI—only you can confirm the dashboard.

---

## Phase 5 — Quality gates

| # | Task | Done |
|---|--------|------|
| 5.1 | **Manual or automated tests** for: payment idempotency, sell-back limits, order state transitions, compliance 403. | [ ] |
| 5.2 | **Staging** environment on Railway (optional): duplicate service + DB for PSP test mode. | [ ] |
| 5.3 | **Load smoke:** health `GET /healthz/`, login, one marketplace + order path on production after each major release. | [ ] |

---

## Git workflow (after each change set)

From the **repository root** (adjust branch name if you use `develop`, etc.):

```bash
git status
git diff
git add <paths>
git commit -m "Short, imperative description of the change"
git pull --rebase origin main
git push origin main
```

**Rules of thumb**

- If `git pull` shows conflicts, resolve them, run tests, then commit merge/rebase result before `push`.
- **Never** force-push to `main` unless your team policy explicitly allows it and you know the impact.
- For **feature branches**: `git checkout -b feature/short-name` → work → `push -u origin feature/short-name` → open PR → merge to `main` (Railway usually deploys from `main`).

**This release (integrity + KYC limits):** no new migration files; `git push` is enough. Railway should redeploy; **no DB migrate required** for the column alignment (field matches existing `0023`).

---

## Railway migrations workflow

**When to migrate**

- Any release that **adds or changes** Django migration files under `backend/users/migrations/` (or other apps).
- This batch: **no new migrations**; production already has `compliance_gates_at_payment` if `0023` was applied. If you see `no such column` for `compliance_gates`, run [Method B](#method-b--manual-ssh-reliable-especially-to-verify-or-fix) once.

**Method A — automatic on deploy (typical)**

The backend Dockerfile often runs `migrate` before gunicorn. A normal **git push** → Railway build → deploy may apply migrations without manual steps. **Confirm** in deploy logs that `migrate` ran successfully.

**Method B — manual SSH (reliable, especially to verify or fix)**

From a directory where `railway link` was run for this project:

```bash
railway status
railway ssh -s <YOUR_DJANGO_SERVICE_NAME> -- python manage.py showmigrations
railway ssh -s <YOUR_DJANGO_SERVICE_NAME> -- python manage.py migrate --noinput
```

Replace `<YOUR_DJANGO_SERVICE_NAME>` with the service name from `railway status`.

**Why not only `railway run` on Windows?**

- `DATABASE_URL` may use an internal host that does not resolve on your PC; `railway ssh` runs **inside** the service network. Details: `docs/RAILWAY_MIGRATIONS.md`.

**After migrate**

- Reload admin and critical API routes; confirm no schema errors in logs.
- If frontend or media URLs are wrong, check **`DJANGO_PUBLIC_BASE_URL`** and **`VITE_API_ORIGIN`** (see `RAILWAY_MIGRATIONS.md`).

---

## Railway deploy checklist (per release)

1. [ ] `git push` to the deployed branch; wait for **Green** build on the API service.
2. [ ] If new migrations: confirm `migrate` in deploy log **or** run [Method B](#method-b--manual-ssh-reliable-especially-to-verify-or-fix) once.
3. [ ] `GET https://<api-host>/healthz/` returns `ok`.
4. [ ] If env vars changed on Railway: **Variables** → save → service **Restart** (or redeploy) as needed.
5. [ ] CORS/CSRF: if the **public URL** of API or frontend changed, update `CORS_ALLOWED_ORIGINS` / `CSRF_TRUSTED_ORIGINS` / `DJANGO_ALLOWED_HOSTS`.
6. [ ] For frontend-only env changes: some setups need **rebuild**; if using `CRIDORA_API_ORIGIN` at container start, a restart may be enough (see `DEPLOY.md`).
7. [ ] **Volume:** after deploy, quick-check KYC upload + download URL still work (file lands on volume path).

---

## Optional: local migration check before push

```bash
cd backend
python manage.py makemigrations --check
python manage.py migrate
```

(Use the project’s venv and local `.env` as documented in `DEPLOY.md`.)

---

## Document maintenance

- Update **Implemented in codebase** and checkboxes when you ship new work.
- **Service name** in SSH commands must match `railway status`.

*Cridora v2 — stepwise agent/human execution with Git, Railway, and volume-aware media.*
