import logging

import stripe
from django.conf import settings
from django.db import IntegrityError, transaction
from django.http import HttpResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .compliance import customer_compliance_verification
from .models import Order, ProcessedStripeEvent, User
from .payment import apply_mark_order_paid_for_customer, aed_to_stripe_minor_units

logger = logging.getLogger(__name__)


def _stripe_configured() -> bool:
    return bool(getattr(settings, "STRIPE_SECRET_KEY", ""))


def _coerce_session_dict(session) -> dict:
    """Stripe webhook JSON dict or retrieve() StripeObject → plain dict."""
    if isinstance(session, dict):
        return session
    if hasattr(session, "to_dict"):
        return session.to_dict()
    return dict(session)


def _apply_checkout_session_paid(session_raw, dedupe_event_id: str) -> None:
    """
    Idempotent: mark order paid from a Checkout Session dict (webhook or retrieve).
    dedupe_event_id must be unique per successful processing path (Stripe event id or synthetic).
    """
    session = _coerce_session_dict(session_raw)
    with transaction.atomic():
        try:
            ProcessedStripeEvent.objects.create(event_id=dedupe_event_id[:255])
        except IntegrityError:
            return
        try:
            order_id = int((session.get("metadata") or {})["order_id"])
        except (KeyError, ValueError, TypeError) as e:
            logger.error("Stripe session: bad metadata: %s", e)
            raise ValueError("bad_metadata") from e
        try:
            order = (
                Order.objects.select_for_update()
                .select_related("customer", "product")
                .get(id=order_id)
            )
        except Order.DoesNotExist:
            logger.error("Stripe session: order %s not found", order_id)
            raise ValueError("order_not_found") from None
        if order.status == Order.PAID:
            return
        expect = aed_to_stripe_minor_units(order.total_aed)
        amount_total = session.get("amount_total")
        if amount_total is not None:
            try:
                at = int(amount_total)
            except (TypeError, ValueError):
                at = None
            if at is not None and abs(at - expect) > 1:
                logger.error(
                    "Stripe amount mismatch order=%s expect=%s got=%s (tolerance 1 minor unit)",
                    order_id,
                    expect,
                    amount_total,
                )
                raise ValueError("amount_mismatch")
        sid = session.get("id", "") or ""
        if order.stripe_checkout_session_id and sid and order.stripe_checkout_session_id != sid:
            logger.error("Stripe session id mismatch order=%s expected stored session", order_id)
            raise ValueError("session_mismatch")
        meta_cid = (session.get("metadata") or {}).get("customer_id")
        if meta_cid and str(order.customer_id) != str(meta_cid):
            logger.error("Stripe customer metadata mismatch order=%s", order_id)
            raise ValueError("customer_mismatch")
        ok, err = apply_mark_order_paid_for_customer(order, order.customer)
        if not ok:
            if err in ("rejected", "expired", "not_ready", "compliance", "forbidden", "stock"):
                raise ValueError(f"mark_paid_{err}")
        order.refresh_from_db()
        pi = session.get("payment_intent")
        if isinstance(pi, dict):
            pi = (pi or {}).get("id") or ""
        elif pi is not None:
            pi = str(pi)
        else:
            pi = ""
        if pi and not (order.stripe_payment_intent_id or ""):
            order.stripe_payment_intent_id = pi[:255]
            order.save(update_fields=["stripe_payment_intent_id"])


def _run_checkout_paid_from_session(event_id, session) -> None:
    _apply_checkout_session_paid(session, event_id)


@method_decorator(csrf_exempt, name="dispatch")
class OrderStripeCheckoutView(APIView):
    """
    Create a Stripe Checkout Session for a vendor_accepted order.
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "stripe_checkout"

    def post(self, request, order_id):
        if not _stripe_configured():
            return Response(
                {"detail": "Card checkout is not configured (missing STRIPE_SECRET_KEY)."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        if request.user.user_type != User.CUSTOMER:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        c = customer_compliance_verification(request.user)
        if not c["trading_allowed"]:
            return Response(
                {
                    "detail": "Complete KYC (documents and verified bank account) before paying.",
                    "pending_items": c["pending_items"],
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        stripe.api_key = settings.STRIPE_SECRET_KEY
        with transaction.atomic():
            try:
                order = (
                    Order.objects.select_for_update()
                    .select_related("product", "product__vendor", "customer")
                    .get(id=order_id, customer=request.user)
                )
            except Order.DoesNotExist:
                return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)
            if order.status == Order.EXPIRED:
                return Response({"detail": "Order has expired."}, status=status.HTTP_400_BAD_REQUEST)
            if order.status == Order.REJECTED:
                return Response({"detail": "Order was rejected by the vendor."}, status=status.HTTP_400_BAD_REQUEST)
            if order.status == Order.PAID:
                return Response({"detail": "Order is already paid."}, status=status.HTTP_400_BAD_REQUEST)
            if order.status != Order.VENDOR_ACCEPTED:
                return Response(
                    {"detail": "Payment is not available yet — waiting for vendor approval."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            amount = aed_to_stripe_minor_units(order.total_aed)
            if amount < 1:
                return Response({"detail": "Invalid order amount."}, status=status.HTTP_400_BAD_REQUEST)
            base = settings.FRONTEND_BASE_URL.rstrip("/")
            success_url = f"{base}/payment/{order.id}?session_id={{CHECKOUT_SESSION_ID}}"
            cancel_url = f"{base}/payment/{order.id}?cancelled=1"
            try:
                session = stripe.checkout.Session.create(
                    mode="payment",
                    line_items=[
                        {
                            "price_data": {
                                "currency": "aed",
                                "unit_amount": amount,
                                "product_data": {
                                    "name": f"Cridora {order.order_ref} — {order.product.name[:80]}",
                                },
                            },
                            "quantity": 1,
                        }
                    ],
                    success_url=success_url,
                    cancel_url=cancel_url,
                    client_reference_id=str(order.id),
                    customer_email=order.customer.email,
                    metadata={
                        "order_id": str(order.id),
                        "customer_id": str(order.customer_id),
                    },
                )
            except stripe.error.StripeError as e:
                logger.warning("Stripe Session.create failed: %s", e)
                return Response(
                    {"detail": "Payment provider error. Please try again later."},
                    status=status.HTTP_502_BAD_GATEWAY,
                )
            order.payment_provider = "stripe"
            order.stripe_checkout_session_id = session.id
            order.save(update_fields=["payment_provider", "stripe_checkout_session_id"])
        return Response({"url": session.url, "session_id": session.id})


class OrderStripeCheckoutVerifyView(APIView):
    """
    After Stripe redirect, the browser may land before the webhook — sync session server-side
    so the order can become paid without waiting on /api/webhooks/stripe/.
    Idempotent with webhooks (unique ProcessedStripeEvent per verify path).
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "stripe_checkout_verify"

    def post(self, request, order_id):
        if not _stripe_configured():
            return Response(
                {"detail": "Card checkout is not configured."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        if request.user.user_type != User.CUSTOMER:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        c = customer_compliance_verification(request.user)
        if not c["trading_allowed"]:
            return Response(
                {
                    "detail": "Complete KYC before completing payment.",
                    "pending_items": c["pending_items"],
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        session_id = (request.data.get("session_id") or request.query_params.get("session_id") or "").strip()
        if not session_id or not session_id.startswith("cs_"):
            return Response(
                {"detail": "Valid session_id (cs_...) is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            oid = int(order_id)
        except (TypeError, ValueError):
            return Response({"detail": "Invalid order."}, status=status.HTTP_400_BAD_REQUEST)
        if oid < 1:
            return Response({"detail": "Invalid order."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            order = Order.objects.get(id=oid, customer=request.user)
        except Order.DoesNotExist:
            return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)
        if order.stripe_checkout_session_id and order.stripe_checkout_session_id != session_id:
            return Response(
                {"detail": "This checkout session does not match the order. Open Pay again from the order page."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        stripe.api_key = settings.STRIPE_SECRET_KEY
        try:
            remote = stripe.checkout.Session.retrieve(
                session_id,
                expand=["payment_intent"],
            )
        except stripe.error.StripeError as e:
            logger.warning("Stripe Session.retrieve failed: %s", e)
            return Response(
                {"detail": "Could not reach Stripe. Try again in a moment."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        rs = _coerce_session_dict(remote)
        if rs.get("payment_status") not in ("paid", "no_payment_required"):
            return Response(
                {"detail": f"Payment not complete yet (status: {rs.get('payment_status', 'unknown')})."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        mid = (rs.get("metadata") or {}).get("order_id")
        if not mid or str(mid) != str(oid):
            return Response(
                {"detail": "Session does not match this order."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        dedupe = f"verify_{session_id}"[:255]
        try:
            _apply_checkout_session_paid(rs, dedupe)
        except ValueError as e:
            code = str(e)
            if code == "amount_mismatch":
                return Response(
                    {"detail": "Amount mismatch with order. Contact support with your order number."},
                    status=status.HTTP_409_CONFLICT,
                )
            if code in ("session_mismatch", "customer_mismatch"):
                return Response({"detail": "Session verification failed."}, status=status.HTTP_400_BAD_REQUEST)
            if code == "order_not_found":
                return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)
            if code == "bad_metadata":
                return Response({"detail": "Invalid payment session."}, status=status.HTTP_400_BAD_REQUEST)
            if code.startswith("mark_paid_"):
                return Response(
                    {"detail": "Order cannot be completed in this state. Refresh or contact support."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            raise
        order.refresh_from_db()
        from . import views as user_views

        return Response(user_views._order_to_customer_dict(order))


@csrf_exempt
def stripe_webhook(request):
    if request.method != "POST":
        return HttpResponse(status=status.HTTP_405_METHOD_NOT_ALLOWED)
    if not _stripe_configured() or not getattr(settings, "STRIPE_WEBHOOK_SECRET", ""):
        logger.error("Stripe webhook: missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET")
        return HttpResponse(status=status.HTTP_503_SERVICE_UNAVAILABLE)
    payload = request.body
    sig_header = request.META.get("HTTP_STRIPE_SIGNATURE", "")
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        logger.warning("Stripe webhook invalid payload: %s", e)
        return HttpResponse(status=400)
    except stripe.error.SignatureVerificationError as e:
        logger.warning("Stripe webhook bad signature: %s", e)
        return HttpResponse(status=400)

    stripe.api_key = settings.STRIPE_SECRET_KEY

    if event["type"] != "checkout.session.completed":
        return HttpResponse(status=200)

    session = event["data"]["object"]
    pay = session.get("payment_status", "")
    if pay not in ("paid", "no_payment_required"):
        return HttpResponse(status=200)

    event_id = event.get("id", "")
    if not event_id:
        return HttpResponse(status=200)

    try:
        _run_checkout_paid_from_session(event_id, session)
    except Exception as e:
        logger.exception("Stripe webhook processing error: %s", e)
        return HttpResponse(status=500)
    return HttpResponse(status=200)
