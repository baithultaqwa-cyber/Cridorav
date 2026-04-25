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
    return bool(getattr(settings, 'STRIPE_SECRET_KEY', ''))


@method_decorator(csrf_exempt, name='dispatch')
class OrderStripeCheckoutView(APIView):
    """
    Create a Stripe Checkout Session for a vendor_accepted order.
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'stripe_checkout'

    def post(self, request, order_id):
        if not _stripe_configured():
            return Response(
                {'detail': 'Card checkout is not configured (missing STRIPE_SECRET_KEY).'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        if request.user.user_type != User.CUSTOMER:
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        c = customer_compliance_verification(request.user)
        if not c['trading_allowed']:
            return Response(
                {
                    'detail': 'Complete KYC (documents and verified bank account) before paying.',
                    'pending_items': c['pending_items'],
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        stripe.api_key = settings.STRIPE_SECRET_KEY
        with transaction.atomic():
            try:
                order = Order.objects.select_for_update().select_related(
                    'product', 'product__vendor', 'customer',
                ).get(id=order_id, customer=request.user)
            except Order.DoesNotExist:
                return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)
            if order.status == Order.EXPIRED:
                return Response({'detail': 'Order has expired.'}, status=status.HTTP_400_BAD_REQUEST)
            if order.status == Order.REJECTED:
                return Response({'detail': 'Order was rejected by the vendor.'}, status=status.HTTP_400_BAD_REQUEST)
            if order.status == Order.PAID:
                return Response({'detail': 'Order is already paid.'}, status=status.HTTP_400_BAD_REQUEST)
            if order.status != Order.VENDOR_ACCEPTED:
                return Response(
                    {'detail': 'Payment is not available yet — waiting for vendor approval.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            amount = aed_to_stripe_minor_units(order.total_aed)
            if amount < 1:
                return Response({'detail': 'Invalid order amount.'}, status=status.HTTP_400_BAD_REQUEST)
            base = settings.FRONTEND_BASE_URL.rstrip('/')
            success_url = f'{base}/payment/{order.id}?session_id={{CHECKOUT_SESSION_ID}}'
            cancel_url = f'{base}/payment/{order.id}?cancelled=1'
            try:
                session = stripe.checkout.Session.create(
                    mode='payment',
                    line_items=[
                        {
                            'price_data': {
                                'currency': 'aed',
                                'unit_amount': amount,
                                'product_data': {
                                    'name': f'Cridora {order.order_ref} — {order.product.name[:80]}',
                                },
                            },
                            'quantity': 1,
                        }
                    ],
                    success_url=success_url,
                    cancel_url=cancel_url,
                    client_reference_id=str(order.id),
                    customer_email=order.customer.email,
                    metadata={
                        'order_id': str(order.id),
                        'customer_id': str(order.customer_id),
                    },
                )
            except stripe.error.StripeError as e:
                logger.warning('Stripe Session.create failed: %s', e)
                return Response(
                    {'detail': 'Payment provider error. Please try again later.'},
                    status=status.HTTP_502_BAD_GATEWAY,
                )
            order.payment_provider = 'stripe'
            order.stripe_checkout_session_id = session.id
            order.save(update_fields=['payment_provider', 'stripe_checkout_session_id'])
        return Response({'url': session.url, 'session_id': session.id})


@csrf_exempt
def stripe_webhook(request):
    if request.method != 'POST':
        return HttpResponse(status=status.HTTP_405_METHOD_NOT_ALLOWED)
    if not _stripe_configured() or not getattr(settings, 'STRIPE_WEBHOOK_SECRET', ''):
        logger.error('Stripe webhook: missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET')
        return HttpResponse(status=status.HTTP_503_SERVICE_UNAVAILABLE)
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE', '')
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        logger.warning('Stripe webhook invalid payload: %s', e)
        return HttpResponse(status=400)
    except stripe.error.SignatureVerificationError as e:
        logger.warning('Stripe webhook bad signature: %s', e)
        return HttpResponse(status=400)

    stripe.api_key = settings.STRIPE_SECRET_KEY

    if event['type'] != 'checkout.session.completed':
        return HttpResponse(status=200)

    session = event['data']['object']
    pay = session.get('payment_status', '')
    if pay not in ('paid', 'no_payment_required'):
        return HttpResponse(status=200)

    event_id = event.get('id', '')
    if not event_id:
        return HttpResponse(status=200)

    try:
        _run_checkout_paid_from_session(event_id, session)
    except Exception as e:
        logger.exception('Stripe webhook processing error: %s', e)
        return HttpResponse(status=500)
    return HttpResponse(status=200)


def _run_checkout_paid_from_session(event_id, session) -> None:
    with transaction.atomic():
        try:
            ProcessedStripeEvent.objects.create(event_id=event_id)
        except IntegrityError:
            return
        try:
            order_id = int(session['metadata']['order_id'])
        except (KeyError, ValueError, TypeError) as e:
            logger.error('Stripe webhook: bad metadata: %s', e)
            raise
        try:
            order = Order.objects.select_for_update().select_related('customer', 'product').get(
                id=order_id
            )
        except Order.DoesNotExist:
            logger.error('Stripe webhook: order %s not found', order_id)
            raise
        amount_total = session.get('amount_total')
        expect = aed_to_stripe_minor_units(order.total_aed)
        if amount_total is not None and int(amount_total) != expect:
            logger.error('Stripe amount mismatch order=%s expect=%s got=%s', order_id, expect, amount_total)
            raise ValueError('amount_mismatch')
        sid = session.get('id', '')
        if order.stripe_checkout_session_id and sid and order.stripe_checkout_session_id != sid:
            logger.error('Stripe session id mismatch order=%s', order_id)
            raise ValueError('session_mismatch')
        meta_cid = (session.get('metadata') or {}).get('customer_id')
        if meta_cid and str(order.customer_id) != str(meta_cid):
            logger.error('Stripe customer metadata mismatch order=%s', order_id)
            raise ValueError('customer_mismatch')
        ok, err = apply_mark_order_paid_for_customer(order, order.customer)
        if not ok:
            if err in ('rejected', 'expired', 'not_ready', 'compliance', 'forbidden', 'stock'):
                raise ValueError(f'mark_paid_{err}')
        order.refresh_from_db()
        pi = session.get('payment_intent')
        if isinstance(pi, dict):
            pi = (pi or {}).get('id') or ''
        elif pi is not None:
            pi = str(pi)
        else:
            pi = ''
        if pi and not (order.stripe_payment_intent_id or ''):
            order.stripe_payment_intent_id = pi[:255]
            order.save(update_fields=['stripe_payment_intent_id'])
