"""Payment ops + provider APIs (collections, delivery fees, Telr webhook)."""
import json
import logging

from django.conf import settings
from django.http import HttpResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from payments import service as pay_service
from payments.fees import buy_fee_breakdown, delivery_fee_breakdown, sellback_fee_breakdown
from payments.models import PaymentTransaction
from payments.registry import default_buy_provider_key
from users.models import Order, User, DeliveryRequest, PlatformConfig, SellOrder

logger = logging.getLogger(__name__)


def _admin(user):
    return user.is_authenticated and user.user_type == User.ADMIN


class PaymentProvidersListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            'providers': pay_service.enabled_providers_payload(),
            'default': default_buy_provider_key(),
        })


class CheckoutQuoteView(APIView):
    """Server-authoritative buy fee breakdown before place-order / pay."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        metal = request.data.get('metal_subtotal_aed')
        provider = (request.data.get('provider_key') or default_buy_provider_key()).strip()
        try:
            metal_f = float(metal)
        except (TypeError, ValueError):
            return Response({'detail': 'metal_subtotal_aed required'}, status=400)
        return Response(buy_fee_breakdown(metal_subtotal_aed=metal_f, provider_key=provider))


class AdminPaymentQueueView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _admin(request.user):
            return Response({'detail': 'Forbidden'}, status=403)
        pending = PaymentTransaction.objects.filter(
            status=PaymentTransaction.STATUS_PENDING,
            provider_key=PaymentTransaction.PROVIDER_MANUAL_AANI,
        ).select_related('order', 'order__customer', 'sell_order', 'delivery_request')[:100]
        rows = []
        for t in pending:
            rows.append({
                'id': t.id,
                'fee_type': t.fee_type,
                'amount': float(t.amount),
                'currency': t.currency,
                'customer_proxy': t.customer_proxy,
                'order_id': t.order_id,
                'order_ref': t.order.order_ref if t.order_id else None,
                'sell_order_id': t.sell_order_id,
                'delivery_request_id': t.delivery_request_id,
                'initiated_by_id': t.initiated_by_id,
                'created_at': t.created_at.isoformat() if t.created_at else None,
            })
        return Response({'pending': rows})


class AdminPaymentInitiateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, txn_id):
        if not _admin(request.user):
            return Response({'detail': 'Forbidden'}, status=403)
        try:
            txn = PaymentTransaction.objects.get(pk=txn_id)
        except PaymentTransaction.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        proxy = (request.data.get('customer_proxy') or txn.customer_proxy or '').strip()
        result = pay_service.initiate_collection(
            txn, customer_proxy=proxy, initiated_by=request.user, request=request
        )
        return Response(result)


class AdminPaymentConfirmView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, txn_id):
        if not _admin(request.user):
            return Response({'detail': 'Forbidden'}, status=403)
        try:
            txn = PaymentTransaction.objects.select_related('order').get(pk=txn_id)
        except PaymentTransaction.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        evidence = (request.data.get('evidence') or '').strip()
        allow = bool(request.data.get('allow_same_operator'))
        try:
            if txn.fee_type == PaymentTransaction.FEE_GOLD_PRINCIPAL:
                order = pay_service.confirm_gold_principal_and_mark_order_paid(
                    txn,
                    evidence=evidence,
                    confirmed_by=request.user,
                    trust_psp=False,
                )
                return Response({'ok': True, 'order_id': order.id, 'status': order.status})
            if txn.fee_type == PaymentTransaction.FEE_DELIVERY:
                pay_service.confirm_collection(
                    txn, evidence=evidence, confirmed_by=request.user, allow_same_operator=allow
                )
                if txn.delivery_request_id:
                    dr = DeliveryRequest.objects.get(pk=txn.delivery_request_id)
                    dr.status = DeliveryRequest.PAID
                    dr.save(update_fields=['status'])
                    o = dr.order
                    if o.status in Order.COMPLETED_HOLDING_STATUSES:
                        o.status = Order.REDEMPTION_REQUESTED
                        o.save(update_fields=['status'])
                return Response({'ok': True, 'delivery_request_id': txn.delivery_request_id})
            if txn.fee_type == PaymentTransaction.FEE_SELLBACK_IN:
                pay_service.confirm_collection(
                    txn, evidence=evidence, confirmed_by=request.user, allow_same_operator=allow
                )
                so = txn.sell_order
                if so:
                    from django.utils import timezone
                    from django.conf import settings as dj_settings
                    so.leg1_confirmed_at = timezone.now()
                    so.status = SellOrder.ADMIN_APPROVED
                    so.save(update_fields=['leg1_confirmed_at', 'status', 'updated_at'])
                    # Gate: create Leg2 only after Leg1 confirmed
                    provider_key = txn.provider_key or getattr(
                        dj_settings, 'PAYMENT_DEFAULT_PROVIDER', 'manual_aani'
                    )
                    try:
                        pay_service.create_sellback_leg2_txn(
                            sell_order=so, leg1_txn=txn, provider_key=provider_key, initiated_by=request.user
                        )
                    except ValueError as e:
                        return Response({'detail': str(e)}, status=400)
                return Response({'ok': True, 'leg': 1, 'sell_order_id': txn.sell_order_id})
            if txn.fee_type == PaymentTransaction.FEE_SELLBACK_OUT:
                if not txn.paired_transaction_id or txn.paired_transaction.status != PaymentTransaction.STATUS_CONFIRMED:
                    return Response({'detail': 'Leg 1 must be confirmed first'}, status=400)
                from django.db import transaction as db_transaction
                from django.utils import timezone
                from users.inventory import units_from_grams
                from users.models import CatalogProduct
                with db_transaction.atomic():
                    pay_service.confirm_payout(
                        txn, evidence=evidence, confirmed_by=request.user, allow_same_operator=allow
                    )
                    so = txn.sell_order
                    if so:
                        so.leg2_confirmed_at = timezone.now()
                        so.status = SellOrder.COMPLETED
                        so.save(update_fields=['leg2_confirmed_at', 'status', 'updated_at'])
                        buy = so.buy_order
                        buy.status = Order.SOLD_BACK
                        buy.save(update_fields=['status'])
                        product = CatalogProduct.objects.select_for_update().get(pk=buy.product_id)
                        units_returned = units_from_grams(
                            qty_grams=so.qty_grams, weight_grams=product.weight_grams
                        )
                        if units_returned > 0:
                            product.stock_qty += units_returned
                            product.in_stock = True
                            product.save(update_fields=['stock_qty', 'in_stock'])
                return Response({'ok': True, 'leg': 2, 'sell_order_id': txn.sell_order_id})
            pay_service.confirm_collection(
                txn, evidence=evidence, confirmed_by=request.user, allow_same_operator=allow
            )
            return Response({'ok': True})
        except ValueError as e:
            return Response({'detail': str(e)}, status=400)


class CustomerStartPaymentView(APIView):
    """Customer picks provider and starts collection for a vendor_accepted order."""
    permission_classes = [IsAuthenticated]

    def post(self, request, order_id):
        if request.user.user_type != User.CUSTOMER:
            return Response({'detail': 'Forbidden'}, status=403)
        provider_key = (request.data.get('provider_key') or default_buy_provider_key()).strip()
        try:
            order = Order.objects.select_related('customer', 'product').get(
                pk=order_id, customer=request.user
            )
        except Order.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        from users.order_lifecycle import maybe_requote_or_hard_expire
        maybe_requote_or_hard_expire(order.id)
        order.refresh_from_db()
        if order.status == Order.CANCELLED:
            return Response({'detail': 'Order cancelled (hard expiry).'}, status=400)
        if order.status != Order.VENDOR_ACCEPTED:
            return Response({'detail': f'Order not ready for payment ({order.status}).'}, status=400)
        if order.income_proof_hold and (request.user.income_proof_status or '') != 'verified':
            return Response({'detail': 'Income proof required before payment.', 'code': 'income_proof'}, status=403)
        # Idempotent: reuse an in-flight gold_principal txn for this order+provider
        # instead of creating duplicates on double-click / retry.
        from django.db import transaction as db_transaction
        with db_transaction.atomic():
            order = Order.objects.select_for_update().get(pk=order.pk)
            if order.status != Order.VENDOR_ACCEPTED:
                return Response({'detail': f'Order not ready for payment ({order.status}).'}, status=400)
            existing = (
                PaymentTransaction.objects.select_for_update()
                .filter(
                    order=order,
                    fee_type=PaymentTransaction.FEE_GOLD_PRINCIPAL,
                    status=PaymentTransaction.STATUS_PENDING,
                    provider_key=provider_key,
                )
                .order_by('-id')
                .first()
            )
            if existing:
                txn = existing
            else:
                txn = pay_service.create_gold_principal_txn(
                    order=order, provider_key=provider_key, initiated_by=request.user
                )
            order.payment_provider = provider_key
            order.save(update_fields=['payment_provider'])
        try:
            result = pay_service.initiate_collection(
                txn,
                customer_proxy=request.user.aani_phone or request.user.phone,
                initiated_by=request.user,
                request=request,
            )
        except Exception as e:
            logger.exception('initiate_collection failed')
            return Response({'detail': str(e)}, status=400)
        return Response({'transaction_id': txn.id, **result})


class DeliveryFeeQuoteView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tier = request.query_params.get('speed_tier', 'standard_2day')
        return Response(delivery_fee_breakdown(speed_tier=tier))


class DeliveryRequestCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, order_id):
        if request.user.user_type != User.CUSTOMER:
            return Response({'detail': 'Forbidden'}, status=403)
        try:
            order = Order.objects.get(pk=order_id, customer=request.user)
        except Order.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        if order.status not in Order.COMPLETED_HOLDING_STATUSES:
            return Response({'detail': 'Order must be held/paid to request delivery'}, status=400)
        tier = request.data.get('speed_tier') or DeliveryRequest.STANDARD
        fees = delivery_fee_breakdown(speed_tier=tier)
        dr = DeliveryRequest.objects.create(
            order=order,
            customer=request.user,
            speed_tier=tier,
            delivery_date=request.data.get('delivery_date') or None,
            delivery_fee=fees['delivery_fee_aed'],
            packing_fee=fees['packing_fee_aed'],
            status=DeliveryRequest.PENDING_PAYMENT,
        )
        provider_key = (request.data.get('provider_key') or default_buy_provider_key()).strip()
        txn = pay_service.create_delivery_fee_txn(
            delivery_request=dr, provider_key=provider_key, initiated_by=request.user
        )
        result = pay_service.initiate_collection(
            txn,
            customer_proxy=request.user.aani_phone or request.user.phone,
            initiated_by=request.user,
            request=request,
        )
        order.status = Order.REDEMPTION_REQUESTED
        order.save(update_fields=['status'])
        return Response({
            'delivery_request_id': dr.id,
            'fees': fees,
            'transaction_id': txn.id,
            **result,
        })


class SellbackQuoteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        gross = request.data.get('gross_aed')
        try:
            g = float(gross)
        except (TypeError, ValueError):
            return Response({'detail': 'gross_aed required'}, status=400)
        return Response(sellback_fee_breakdown(gross_aed=g))


class TrackedAssetListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from users.models import TrackedAsset
        if request.user.user_type != User.CUSTOMER:
            return Response({'detail': 'Forbidden'}, status=403)
        rows = [
            {
                'id': a.id,
                'metal_type': a.metal_type,
                'weight_grams': float(a.weight_grams),
                'purity_estimate': float(a.purity_estimate),
                'note': a.note,
                'disclaimer': 'Self-reported — not held or insured by Cridora.',
            }
            for a in TrackedAsset.objects.filter(user=request.user)
        ]
        return Response({'assets': rows})

    def post(self, request):
        from users.models import TrackedAsset
        if request.user.user_type != User.CUSTOMER:
            return Response({'detail': 'Forbidden'}, status=403)
        a = TrackedAsset.objects.create(
            user=request.user,
            metal_type=request.data.get('metal_type') or 'gold',
            weight_grams=request.data.get('weight_grams') or 0,
            purity_estimate=request.data.get('purity_estimate') or 1,
            note=(request.data.get('note') or '')[:255],
        )
        return Response({'id': a.id}, status=201)


class TrackedAssetDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        from users.models import TrackedAsset
        deleted, _ = TrackedAsset.objects.filter(pk=pk, user=request.user).delete()
        if not deleted:
            return Response({'detail': 'Not found'}, status=404)
        return Response(status=204)


class HandoverEventCreateView(APIView):
    """Ops records handover certificate (Phase 3 light version)."""
    permission_classes = [IsAuthenticated]

    def post(self, request, order_id):
        if not _admin(request.user) and request.user.user_type != User.VENDOR:
            return Response({'detail': 'Forbidden'}, status=403)
        from users.models import HandoverEvent
        try:
            order = Order.objects.get(pk=order_id)
        except Order.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        ev = HandoverEvent.objects.create(
            order=order,
            handled_by=request.user,
            verified_weight=request.data.get('verified_weight') or None,
            verified_purity=(request.data.get('verified_purity') or '')[:32],
            verified_hallmark_ref=(request.data.get('verified_hallmark_ref') or '')[:128],
            otp_ref=(request.data.get('otp_ref') or '')[:64],
            signature_ref=(request.data.get('signature_ref') or '')[:255],
            duress_flag=bool(request.data.get('duress_flag')),
            mismatch_flag=bool(request.data.get('mismatch_flag')),
            notes=(request.data.get('notes') or '')[:2000],
        )
        if ev.mismatch_flag:
            # Defect path — do not mark redeemed
            return Response({'id': ev.id, 'status': 'disputed_mismatch'})
        order.status = Order.REDEEMED
        order.save(update_fields=['status'])
        return Response({'id': ev.id, 'status': 'recorded'})


@method_decorator(csrf_exempt, name='dispatch')
class TelrWebhookView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        from payments.adapters.telr import verify_telr_webhook_signature
        if not getattr(settings, 'TELR_ENABLED', False):
            return HttpResponse(status=503)
        # Signature verification is mandatory. If the secret is not configured we refuse the
        # request (503) rather than accepting an unsigned/forgeable payment notification — an
        # unsigned webhook could otherwise be spoofed to mark orders paid. Mirrors the Stripe path.
        if not getattr(settings, 'TELR_WEBHOOK_SECRET', '').strip():
            logger.error('Telr webhook rejected: TELR_WEBHOOK_SECRET is not configured.')
            return HttpResponse(status=503)
        sig = request.META.get('HTTP_X_TELR_SIGNATURE', '')
        if not verify_telr_webhook_signature(request.body, sig):
            return HttpResponse(status=400)
        try:
            payload = json.loads(request.body.decode('utf-8') or '{}')
        except json.JSONDecodeError:
            return HttpResponse(status=400)
        cart = str(payload.get('cart_id') or payload.get('tran', {}).get('cartid') or '')
        if not cart.startswith('CRIDORA-'):
            return HttpResponse(status=200)
        try:
            txn_id = int(cart.split('-')[1])
        except (IndexError, ValueError):
            return HttpResponse(status=200)
        try:
            txn = PaymentTransaction.objects.select_related('order').get(pk=txn_id)
        except PaymentTransaction.DoesNotExist:
            return HttpResponse(status=200)
        paid = str(payload.get('status') or payload.get('tran', {}).get('status') or '').lower() in (
            'paid', 'authorised', 'authorized', 'a', 'success'
        )
        if paid and txn.fee_type == PaymentTransaction.FEE_GOLD_PRINCIPAL:
            try:
                pay_service.confirm_gold_principal_and_mark_order_paid(
                    txn, evidence=f'telr:{cart}', confirmed_by=None, trust_psp=True
                )
            except Exception:
                logger.exception('Telr webhook mark paid failed')
                return HttpResponse(status=500)
        return HttpResponse(status=200)
