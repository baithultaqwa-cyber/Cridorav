"""Phase 1 payment / fee / KYC / re-quote tests."""
from decimal import Decimal
from datetime import timedelta

from django.test import TestCase, override_settings
from django.utils import timezone
from django.contrib.auth import get_user_model

from users.models import (
    Order, CatalogProduct, PlatformConfig, KYCDocument, SellOrder, DeliveryRequest,
)
from users.order_lifecycle import lock_rate_on_vendor_accept, maybe_requote_or_hard_expire
from users.compliance import order_requires_income_proof
from users.payment import apply_mark_order_paid_for_customer
from payments.fees import buy_fee_breakdown, delivery_fee_breakdown, sellback_fee_breakdown
from payments.models import PaymentTransaction
from payments import service as pay_service

User = get_user_model()


def _product(vendor, **kwargs):
    defaults = dict(
        vendor=vendor,
        name='Test Gold Bar',
        metal='gold',
        purity='999.9',
        weight_grams=Decimal('10'),
        use_live_rate=False,
        manual_rate_per_gram=Decimal('250'),
        buyback_per_gram=Decimal('240'),
        in_stock=True,
        visible=True,
        stock_qty=10,
    )
    defaults.update(kwargs)
    return CatalogProduct.objects.create(**defaults)


class FeeMathTests(TestCase):
    def setUp(self):
        cfg = PlatformConfig.get()
        cfg.buy_fee_pct = Decimal('1.50')
        cfg.packing_fee_aed = Decimal('10.00')
        cfg.delivery_fee_standard_aed = Decimal('25.00')
        cfg.delivery_fee_priority_aed = Decimal('75.00')
        cfg.sellback_convenience_fee_pct = Decimal('1.00')
        cfg.sellback_convenience_fee_flat_aed = Decimal('0')
        cfg.save()

    def test_buy_fee_breakdown_service_only_on_aani(self):
        b = buy_fee_breakdown(metal_subtotal_aed=1000, provider_key='manual_aani')
        self.assertEqual(b['cridora_service_fee_aed'], 15.0)
        self.assertEqual(b['total_due_now_aed'], 1015.0)
        self.assertEqual(b['psp_fee_aed'], 0.0)
        self.assertIn('Delivery', b['exclusions_note'])

    def test_buy_fee_psp_line_on_stripe(self):
        b = buy_fee_breakdown(metal_subtotal_aed=1000, provider_key='stripe')
        self.assertGreater(b['psp_fee_aed'], 0)
        self.assertEqual(b['total_due_now_aed'], 1015.0)

    def test_delivery_fee_tiers(self):
        s = delivery_fee_breakdown(speed_tier='standard_2day')
        p = delivery_fee_breakdown(speed_tier='priority_sameday')
        self.assertEqual(s['total_aed'], 35.0)
        self.assertEqual(p['total_aed'], 85.0)

    def test_sellback_never_percent_of_profit(self):
        sb = sellback_fee_breakdown(gross_aed=1000)
        self.assertEqual(sb['convenience_fee_aed'], 10.0)
        self.assertEqual(sb['net_payout_aed'], 990.0)


class RequoteTests(TestCase):
    def setUp(self):
        self.vendor = User.objects.create_user(
            username='v1', email='v1@test.com', password='x', user_type=User.VENDOR,
        )
        self.customer = User.objects.create_user(
            username='c1', email='c1@test.com', password='x', user_type=User.CUSTOMER,
            kyc_status=User.KYC_VERIFIED,
        )
        self.product = _product(self.vendor)
        self.order = Order.objects.create(
            customer=self.customer,
            product=self.product,
            qty_units=1,
            qty_grams=Decimal('10'),
            rate_per_gram=Decimal('250'),
            metal_rate_per_gram=Decimal('250'),
            buyback_per_gram=Decimal('240'),
            platform_fee_aed=Decimal('37.50'),
            total_aed=Decimal('2537.50'),
            status=Order.PENDING_VENDOR,
            expires_at=timezone.now() + timedelta(hours=1),
        )

    def test_lock_rate_sets_windows(self):
        lock_rate_on_vendor_accept(self.order)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.VENDOR_ACCEPTED)
        self.assertIsNotNone(self.order.payment_window_expires_at)
        self.assertIsNotNone(self.order.order_hard_expiry_at)

    def test_requote_bumps_count_not_cancel(self):
        lock_rate_on_vendor_accept(self.order)
        self.order.payment_window_expires_at = timezone.now() - timedelta(seconds=1)
        self.order.payment_expires_at = self.order.payment_window_expires_at
        self.order.order_hard_expiry_at = timezone.now() + timedelta(hours=24)
        self.order.save()
        self.product.manual_rate_per_gram = Decimal('260')
        self.product.save(update_fields=['manual_rate_per_gram'])
        maybe_requote_or_hard_expire(self.order.id)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.VENDOR_ACCEPTED)
        self.assertEqual(self.order.requoted_count, 1)
        self.assertEqual(self.order.rate_per_gram, Decimal('260'))

    def test_hard_expiry_cancels(self):
        lock_rate_on_vendor_accept(self.order)
        self.order.order_hard_expiry_at = timezone.now() - timedelta(seconds=1)
        self.order.save(update_fields=['order_hard_expiry_at'])
        maybe_requote_or_hard_expire(self.order.id)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.CANCELLED)


class KycThresholdTests(TestCase):
    def setUp(self):
        self.customer = User.objects.create_user(
            username='c2', email='c2@test.com', password='x', user_type=User.CUSTOMER,
            kyc_status=User.KYC_VERIFIED,
            cumulative_purchase_total_this_month=Decimal('49000'),
            cumulative_purchase_month_key=timezone.now().strftime('%Y-%m'),
        )
        cfg = PlatformConfig.get()
        cfg.internal_kyc_threshold_aed = Decimal('50000')
        cfg.save()

    def test_income_proof_gate(self):
        self.assertTrue(order_requires_income_proof(self.customer, Decimal('1500')))
        self.customer.income_proof_status = 'verified'
        self.customer.save(update_fields=['income_proof_status'])
        self.assertFalse(order_requires_income_proof(self.customer, Decimal('1500')))


class PaymentIdempotencyTests(TestCase):
    def setUp(self):
        self.vendor = User.objects.create_user(
            username='v2', email='v2@test.com', password='x', user_type=User.VENDOR,
        )
        self.customer = User.objects.create_user(
            username='c3', email='c3@test.com', password='x', user_type=User.CUSTOMER,
            kyc_status=User.KYC_VERIFIED,
        )
        KYCDocument.objects.create(
            user=self.customer, doc_type=KYCDocument.EMIRATES_ID, status=KYCDocument.DOC_VERIFIED,
        )
        self.product = _product(self.vendor, weight_grams=Decimal('1'), stock_qty=5)
        self.order = Order.objects.create(
            customer=self.customer,
            product=self.product,
            qty_units=1,
            qty_grams=Decimal('1'),
            rate_per_gram=Decimal('100'),
            metal_rate_per_gram=Decimal('100'),
            buyback_per_gram=Decimal('95'),
            platform_fee_aed=Decimal('1.50'),
            total_aed=Decimal('101.50'),
            status=Order.VENDOR_ACCEPTED,
            expires_at=timezone.now() + timedelta(hours=1),
            payment_window_expires_at=timezone.now() + timedelta(minutes=10),
        )

    def test_mark_paid_idempotent_held(self):
        ok, err = apply_mark_order_paid_for_customer(self.order, self.customer, trust_psp=True)
        self.assertTrue(ok, err)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.HELD)
        ok2, _ = apply_mark_order_paid_for_customer(self.order, self.customer, trust_psp=True)
        self.assertTrue(ok2)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.HELD)

    @override_settings(MANUAL_AANI_ALLOW_SINGLE_OPERATOR=True)
    def test_manual_aani_confirm_marks_held(self):
        admin = User.objects.create_user(
            username='a1', email='a1@test.com', password='x', user_type=User.ADMIN,
        )
        txn = pay_service.create_gold_principal_txn(
            order=self.order, provider_key='manual_aani', initiated_by=admin
        )
        pay_service.initiate_collection(txn, customer_proxy='971500000000', initiated_by=admin)
        order = pay_service.confirm_gold_principal_and_mark_order_paid(
            txn, evidence='ref-1', confirmed_by=admin, trust_psp=True
        )
        self.assertEqual(order.status, Order.HELD)
        order2 = pay_service.confirm_gold_principal_and_mark_order_paid(
            txn, evidence='ref-1', confirmed_by=admin, trust_psp=True
        )
        self.assertEqual(order2.status, Order.HELD)


class DeliveryFeeCollectionTests(TestCase):
    def setUp(self):
        self.vendor = User.objects.create_user(
            username='v3', email='v3@test.com', password='x', user_type=User.VENDOR,
        )
        self.customer = User.objects.create_user(
            username='c4', email='c4@test.com', password='x', user_type=User.CUSTOMER,
        )
        self.product = _product(self.vendor, weight_grams=Decimal('1'), stock_qty=1)
        self.order = Order.objects.create(
            customer=self.customer, product=self.product,
            qty_units=1, qty_grams=Decimal('1'), rate_per_gram=Decimal('100'),
            metal_rate_per_gram=Decimal('100'), buyback_per_gram=Decimal('90'),
            platform_fee_aed=Decimal('1'), total_aed=Decimal('101'),
            status=Order.HELD, expires_at=timezone.now() + timedelta(days=1),
        )

    @override_settings(MANUAL_AANI_ALLOW_SINGLE_OPERATOR=True)
    def test_delivery_fee_txn(self):
        fees = delivery_fee_breakdown(speed_tier='standard_2day')
        dr = DeliveryRequest.objects.create(
            order=self.order, customer=self.customer,
            speed_tier=DeliveryRequest.STANDARD,
            delivery_fee=fees['delivery_fee_aed'],
            packing_fee=fees['packing_fee_aed'],
            status=DeliveryRequest.PENDING_PAYMENT,
        )
        admin = User.objects.create_user(
            username='a2', email='a2@test.com', password='x', user_type=User.ADMIN,
        )
        txn = pay_service.create_delivery_fee_txn(
            delivery_request=dr, provider_key='manual_aani', initiated_by=admin
        )
        self.assertEqual(txn.fee_type, PaymentTransaction.FEE_DELIVERY)
        pay_service.confirm_collection(txn, evidence='d1', confirmed_by=admin, allow_same_operator=True)
        txn.refresh_from_db()
        self.assertEqual(txn.status, PaymentTransaction.STATUS_CONFIRMED)


class TwoLegGateTests(TestCase):
    def setUp(self):
        self.vendor = User.objects.create_user(
            username='v4', email='v4@test.com', password='x', user_type=User.VENDOR,
        )
        self.customer = User.objects.create_user(
            username='c5', email='c5@test.com', password='x', user_type=User.CUSTOMER,
        )
        self.product = _product(self.vendor, weight_grams=Decimal('1'), stock_qty=1)
        self.buy = Order.objects.create(
            customer=self.customer, product=self.product,
            qty_units=1, qty_grams=Decimal('1'), rate_per_gram=Decimal('100'),
            metal_rate_per_gram=Decimal('100'), buyback_per_gram=Decimal('90'),
            platform_fee_aed=Decimal('1'), total_aed=Decimal('101'),
            status=Order.HELD, expires_at=timezone.now() + timedelta(days=1),
        )
        self.so = SellOrder.objects.create(
            customer=self.customer, buy_order=self.buy,
            qty_grams=Decimal('1'), buyback_rate_per_gram=Decimal('90'),
            purchase_rate_per_gram=Decimal('100'),
            gross_aed=Decimal('90'), purchase_cost_aed=Decimal('100'),
            profit_aed=Decimal('-10'), cridora_share_pct=Decimal('0'),
            cridora_share_aed=Decimal('0'), convenience_fee_aed=Decimal('0.90'),
            net_payout_aed=Decimal('89.10'), two_leg_mode=True,
            status=SellOrder.FUNDS_PENDING,
        )

    def test_leg2_requires_leg1_confirmed(self):
        leg1 = pay_service.create_sellback_leg1_txn(
            sell_order=self.so, provider_key='manual_aani'
        )
        with self.assertRaises(ValueError):
            pay_service.create_sellback_leg2_txn(
                sell_order=self.so, leg1_txn=leg1, provider_key='manual_aani'
            )
        leg1.status = PaymentTransaction.STATUS_CONFIRMED
        leg1.save(update_fields=['status'])
        leg2 = pay_service.create_sellback_leg2_txn(
            sell_order=self.so, leg1_txn=leg1, provider_key='manual_aani'
        )
        self.assertEqual(leg2.fee_type, PaymentTransaction.FEE_SELLBACK_OUT)
        self.assertEqual(leg2.paired_transaction_id, leg1.id)
