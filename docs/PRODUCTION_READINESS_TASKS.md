# Cridora v2 — production readiness task list

Use this document for **sequential** work: complete tasks **in order** unless a note says it can run in parallel. After backend schema changes, follow **Git → Railway** every time so production stays consistent.

**Related docs (read as needed):**

- `README.md` — baseline behavior and stack
- `DEPLOY.md` — GitHub + Railway setup, env vars, Dockerfile, CORS, health checks
- `docs/RAILWAY_MIGRATIONS.md` — linking Railway CLI, SSH migrations, S3/volumes, troubleshooting 500s
- `docs/PAYMENT_GATEWAY_INTEGRATION.md` — PSP / Stripe integration principles

---

## Conventions (for humans and agents)

- **Default repo root:** the folder that contains `backend/` and `frontend/` (e.g. `Cridora v2`).
- **Do not** edit applied migrations; **add** new migration files when the model changes.
- **One logical change = one commit** (or a small, reviewable series) with a clear message.
- After **merging to the branch Railway deploys** (usually `main`), let Railway build, then run **migrations** if the release includes new migration files (see [Railway migrations workflow](#railway-migrations-workflow) below).

---

## Phase 0 — Repo and tooling (one-time)

| # | Task | Done |
|---|--------|------|
| 0.1 | Ensure Git remotes: `git remote -v` points at the correct GitHub repo (see `DEPLOY.md`). | [ ] |
| 0.2 | Install [Railway CLI](https://docs.railway.com/guides/cli); `railway login`. | [ ] |
| 0.3 | **Link** the project: from repo root, `railway link` → pick project + environment; verify with `railway status`. | [ ] |
| 0.4 | Note the **exact Railway service name** that runs Django / `gunicorn` (used in `railway ssh -s <NAME> …`). | [ ] |
| 0.5 | Production env vars on API service match `DEPLOY.md` (at minimum: `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=false`, `DJANGO_ALLOWED_HOSTS`, `DATABASE_URL` reference, CORS, CSRF). | [ ] |
| 0.6 | Frontend: API origin set (`VITE_API_ORIGIN` and/or `CRIDORA_API_ORIGIN` per `DEPLOY.md`). | [ ] |

---

## Phase 1 — Data integrity and correctness (before real money)

| # | Task | Notes | Done |
|---|--------|--------|------|
| 1.1 | **Sell-back allocation:** In `CustomerCreateSellOrderView`, ensure total grams sold (pending + completed, excluding rejected) for a `buy_order` never exceeds `buy_order.qty_grams`. Use a transaction; consider locking the buy order row. | Fixes overselling the same lot. | [ ] |
| 1.2 | **Payment completion:** Wrap stock decrement + `order.status = paid` in `transaction.atomic()`. Re-fetch order with `select_for_update()` and re-check `status == vendor_accepted` before mutating. | Reduces double-submit / race windows. | [ ] |
| 1.3 | **Stock shortfall policy:** Decide behavior when `product.stock_qty < order.qty_units` at pay time (reject vs allow with admin flag). Implement consistently in code + tests. | Today code can zero stock and still mark paid. | [ ] |
| 1.4 | **Order model ↔ DB:** Align `Order` in `models.py` with migrations (e.g. `compliance_gates_at_payment` exists in DB per `0023` but may be missing from the model, or add a follow-up migration if the field should be removed). | Prevents ORM/DB drift; see `RAILWAY_MIGRATIONS.md` 500 / missing column section. | [ ] |

---

## Phase 2 — Security and input hardening

| # | Task | Notes | Done |
|---|--------|--------|------|
| 2.1 | **KYC document uploads:** Add max file size, allowed MIME/extension whitelist, and reject junk uploads in `DocumentUploadView` (or shared validator). | Reduces storage abuse and risk. | [ ] |
| 2.2 | **Rate limiting (optional but recommended):** Consider DRF throttling on auth-sensitive endpoints (login, password reset, uploads). | No new dependency unless you choose a package; keep scope minimal. | [ ] |
| 2.3 | **JWT lifetime review:** `ACCESS_TOKEN_LIFETIME` is long in `settings.py`; consider shorter access + refresh for production policy. | Product/security decision. | [ ] |

---

## Phase 3 — Payment service provider (PSP)

Complete **Phase 1** first. Integrate in the order given in `docs/PAYMENT_GATEWAY_INTEGRATION.md`.

| # | Task | Notes | Done |
|---|--------|--------|------|
| 3.1 | **PSP test account** and keys (test mode). | | [ ] |
| 3.2 | **Backend:** `POST` to create PaymentIntent/Checkout Session with `order_id` + amount/currency in metadata. | Server-side only. | [ ] |
| 3.3 | **Webhook** endpoint: verify signature, idempotent event handling, amount/order match, then call the **single** `paid` transition. | Do not trust client alone. | [ ] |
| 3.4 | **DB (optional but usual):** columns for `payment_provider`, `psp_payment_id`, `psp_event_id` (or event log table) for reconciliation. | New migration in same release as code. | [ ] |
| 3.5 | **Frontend:** Replace or augment `Payment.jsx` “Confirm” with PSP flow; on return, **refresh order** from API. | Set `VITE_SIMULATED_PAYMENT=false` when live. | [ ] |
| 3.6 | **Observability:** structured logs for webhook received / skipped / error. | | [ ] |
| 3.7 | **Runbook:** stuck `vendor_accepted`, refund, dispute (even if “manual for now”). | Checklist in `PAYMENT_GATEWAY_INTEGRATION.md`. | [ ] |

---

## Phase 4 — Media, storage, and operations

| # | Task | Notes | Done |
|---|--------|--------|------|
| 4.1 | **Catalog images:** If not already, configure S3/R2 per `RAILWAY_MIGRATIONS.md` (ephemeral disk breaks URLs after redeploy). | | [ ] |
| 4.2 | **KYC files:** If API scales to **multiple instances**, plan volume or off-object-store for `MEDIA_ROOT` (same doc). | | [ ] |
| 4.3 | **Backups:** Confirm Railway Postgres backup policy; document restore RTO/RPO. | | [ ] |

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

**Commit message style (examples):**

- `Fix sell order grams capped by prior sells on same buy order`
- `Add atomic payment transition with select_for_update on Order`
- `Add Stripe webhook and idempotent mark-paid`

---

## Railway migrations workflow

**When to migrate**

- Any release that **adds or changes** Django migration files under `backend/users/migrations/` (or other apps).
- If production returns **500** on API/admin with `no such column` / missing field: migrations likely not applied; see `docs/RAILWAY_MIGRATIONS.md` troubleshooting.

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
2. [ ] If new migrations: confirm `migrate` in deploy log **or** run [Method B](#railway-migrations-workflow) once.
3. [ ] `GET https://<api-host>/healthz/` returns `ok`.
4. [ ] If env vars changed on Railway: **Variables** → save → service **Restart** (or redeploy) as needed.
5. [ ] CORS/CSRF: if the **public URL** of API or frontend changed, update `CORS_ALLOWED_ORIGINS` / `CSRF_TRUSTED_ORIGINS` / `DJANGO_ALLOWED_HOSTS`.
6. [ ] For frontend-only env changes: some setups need **rebuild**; if using `CRIDORA_API_ORIGIN` at container start, a restart may be enough (see `DEPLOY.md`).

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

- Update the **date** and any **service names** in this file when the Railway project changes.
- When a task is completed permanently, you may check it off here or in your issue tracker; keep this file as the **single ordered checklist** for go-live prep.

*Created for Cridora v2 — stepwise agent/human execution with Git and Railway alignment.*
