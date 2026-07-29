"""
Workflow-facing payment API. Order / delivery / sell-back code calls only these helpers.
"""
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import PaymentTransaction
from .registry import get_provider, list_enabled_providers, default_buy_provider_key


def enabled_providers_payload():
    return list_enabled_providers()


def create_gold_principal_txn(*, order, provider_key: str, amount=None, initiated_by=None):
    amt = amount if amount is not None else order.total_aed
    return PaymentTransaction.objects.create(
        order=order,
        fee_type=PaymentTransaction.FEE_GOLD_PRINCIPAL,
        provider_key=provider_key,
        amount=Decimal(str(amt)),
        currency='AED',
        status=PaymentTransaction.STATUS_PENDING,
        funds_source=PaymentTransaction.FUNDS_CUSTOMER,
        initiated_by=initiated_by,
        customer_proxy=getattr(order.customer, 'aani_phone', '') or getattr(order.customer, 'phone', '') or '',
    )


def create_delivery_fee_txn(*, delivery_request, provider_key: str, initiated_by=None):
    return PaymentTransaction.objects.create(
        order=delivery_request.order,
        delivery_request=delivery_request,
        fee_type=PaymentTransaction.FEE_DELIVERY,
        provider_key=provider_key,
        amount=Decimal(str(delivery_request.total_fee)),
        currency='AED',
        status=PaymentTransaction.STATUS_PENDING,
        funds_source=PaymentTransaction.FUNDS_CUSTOMER,
        initiated_by=initiated_by,
        customer_proxy=getattr(delivery_request.customer, 'aani_phone', '')
        or getattr(delivery_request.customer, 'phone', '')
        or '',
    )


def create_sellback_leg1_txn(*, sell_order, provider_key: str, initiated_by=None):
    """Vendor → Cridora funding (gross buyback)."""
    return PaymentTransaction.objects.create(
        sell_order=sell_order,
        order=sell_order.buy_order,
        fee_type=PaymentTransaction.FEE_SELLBACK_IN,
        provider_key=provider_key,
        amount=Decimal(str(sell_order.gross_aed)),
        currency='AED',
        status=PaymentTransaction.STATUS_PENDING,
        funds_source=PaymentTransaction.FUNDS_DEALER,
        initiated_by=initiated_by,
    )


def create_sellback_leg2_txn(*, sell_order, leg1_txn, provider_key: str, initiated_by=None):
    """Cridora → customer disbursement; gated on leg1 confirmed."""
    if leg1_txn.status != PaymentTransaction.STATUS_CONFIRMED:
        raise ValueError('leg1_not_confirmed')
    if leg1_txn.fee_type != PaymentTransaction.FEE_SELLBACK_IN:
        raise ValueError('leg1_wrong_type')
    return PaymentTransaction.objects.create(
        sell_order=sell_order,
        order=sell_order.buy_order,
        fee_type=PaymentTransaction.FEE_SELLBACK_OUT,
        paired_transaction=leg1_txn,
        provider_key=provider_key,
        amount=Decimal(str(sell_order.net_payout_aed)),
        currency='AED',
        status=PaymentTransaction.STATUS_PENDING,
        funds_source=PaymentTransaction.FUNDS_DEALER,
        initiated_by=initiated_by,
        customer_proxy=getattr(sell_order.customer, 'aani_phone', '')
        or getattr(sell_order.customer, 'phone', '')
        or '',
    )


def initiate_collection(txn, *, customer_proxy='', initiated_by=None, request=None):
    provider = get_provider(txn.provider_key)
    return provider.initiate_collection(
        txn,
        customer_proxy=customer_proxy or txn.customer_proxy,
        initiated_by=initiated_by,
        request=request,
    )


def confirm_collection(txn, *, evidence='', confirmed_by=None, allow_same_operator=False):
    provider = get_provider(txn.provider_key)
    return provider.confirm_collection(
        txn,
        evidence=evidence,
        confirmed_by=confirmed_by,
        allow_same_operator=allow_same_operator,
    )


def initiate_payout(txn, *, initiated_by=None):
    provider = get_provider(txn.provider_key)
    return provider.initiate_payout(txn, initiated_by=initiated_by)


def confirm_payout(txn, *, evidence='', confirmed_by=None, allow_same_operator=False):
    provider = get_provider(txn.provider_key)
    return provider.confirm_payout(
        txn,
        evidence=evidence,
        confirmed_by=confirmed_by,
        allow_same_operator=allow_same_operator,
    )


@transaction.atomic
def confirm_gold_principal_and_mark_order_paid(txn, *, evidence='', confirmed_by=None, trust_psp=False):
    """
    Confirm PaymentTransaction then mark the buy order held/paid via the single transition.
    """
    from users.models import Order
    from users.payment import apply_mark_order_paid_for_customer

    txn = PaymentTransaction.objects.select_for_update().get(pk=txn.pk)
    if txn.fee_type != PaymentTransaction.FEE_GOLD_PRINCIPAL:
        raise ValueError('not_gold_principal')
    if not txn.order_id:
        raise ValueError('no_order')
    order = Order.objects.select_for_update().select_related('customer', 'product').get(pk=txn.order_id)
    if txn.status != PaymentTransaction.STATUS_CONFIRMED:
        confirm_collection(
            txn,
            evidence=evidence,
            confirmed_by=confirmed_by,
            allow_same_operator=trust_psp or getattr(settings, 'MANUAL_AANI_ALLOW_SINGLE_OPERATOR', False),
        )
        txn.refresh_from_db()
    ok, err = apply_mark_order_paid_for_customer(
        order, order.customer, trust_psp=trust_psp or txn.provider_key != PaymentTransaction.PROVIDER_MANUAL_AANI
    )
    if not ok:
        raise ValueError(f'mark_paid_{err}')
    return order


def sync_stripe_txn_on_paid(order):
    """After Stripe marks order paid, confirm any pending stripe gold_principal txn."""
    qs = PaymentTransaction.objects.filter(
        order=order,
        fee_type=PaymentTransaction.FEE_GOLD_PRINCIPAL,
        provider_key=PaymentTransaction.PROVIDER_STRIPE,
        status=PaymentTransaction.STATUS_PENDING,
    )
    for txn in qs:
        txn.status = PaymentTransaction.STATUS_CONFIRMED
        txn.confirmed_at = timezone.now()
        txn.provider_ref = (order.stripe_checkout_session_id or txn.provider_ref)[:255]
        txn.save(update_fields=['status', 'confirmed_at', 'provider_ref'])
