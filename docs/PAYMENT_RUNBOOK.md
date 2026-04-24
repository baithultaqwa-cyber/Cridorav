# Payment operations (Stripe) — runbook

## Endpoints (production)

- **Create Checkout Session (customer, JWT):** `POST /api/auth/orders/<order_id>/checkout/`
- **Manual mark paid (dev / emergency only):** `POST /api/auth/orders/<order_id>/` — disabled when `STRIPE_SECRET_KEY` is set unless `STRIPE_ALLOW_MANUAL_MARK_PAID=true`
- **Stripe webhook (no auth):** `POST /api/webhooks/stripe/` — raw body, Stripe signature

## Environment (API service)

| Variable | Purpose |
|----------|--------|
| `STRIPE_SECRET_KEY` | Secret API key; when set, order JSON includes `checkout_available: true` and manual POST is blocked |
| `STRIPE_WEBHOOK_SECRET` | Signing secret from Stripe Dashboard for the endpoint above |
| `STRIPE_ALLOW_MANUAL_MARK_PAID` | `true` to allow the old one-click “confirm” POST while Stripe is configured (e.g. support) |
| `FRONTEND_BASE_URL` | Used for Checkout success/cancel URLs (must be the public app URL) |

## Stuck in `vendor_accepted` (unpaid)

1. Confirm the customer completed Checkout (Stripe Dashboard → Payments / Sessions).
2. If paid in Stripe but order not `paid` in the app: check API logs for webhook 4xx/5xx; verify webhook URL and `STRIPE_WEBHOOK_SECRET`; use Stripe “Resend” for the `checkout.session.completed` event.
3. If stock was insufficient, webhook may fail with amount/session checks — fix inventory, then resend the event or use manual mark if enabled.

## Refunds and disputes

Not automated in the app; handle in the Stripe Dashboard and adjust order/ledger in admin/support processes as your policy requires.

---

*This is operational guidance, not legal or PCI advice.*
