"""
Regression tests for the financial-correctness and gating bugs found and fixed during the
2026-07-18 production-readiness review. Each test class documents the bug it guards against
in its docstring so a future change that reintroduces the bug fails loudly here instead of
being discovered in production.
"""
import datetime as dt
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from .compliance import customer_compliance_verification
from .eod_services import compute_vendor_day_totals, vendor_eod_utc_window
from .models import (
    CatalogProduct,
    CustomerBankDetails,
    KYCDocument,
    Order,
    PlatformConfig,
    SellOrder,
    User,
    VendorPricingConfig,
)
from .payment import apply_mark_order_paid_for_customer


def make_vendor(email='vendor@test.local'):
    return User.objects.create_user(
        username=email, email=email, password='x', user_type=User.VENDOR,
        vendor_company='Test Vendor', kyc_status=User.KYC_VERIFIED,
    )


def make_customer(email='customer@test.local', verified=True):
    c = User.objects.create_user(
        username=email, email=email, password='x', user_type=User.CUSTOMER,
        kyc_status=User.KYC_VERIFIED if verified else User.KYC_PENDING,
    )
    if verified:
        for dt_ in KYCDocument.CUSTOMER_DOCS:
            KYCDocument.objects.create(user=c, doc_type=dt_, status=KYCDocument.DOC_VERIFIED)
        CustomerBankDetails.objects.create(
            user=c, account_name='Test', bank_name='Test Bank', account_number='123',
            ifsc='TEST0001', status=CustomerBankDetails.VERIFIED,
        )
    return c


def make_product(vendor, weight_grams='10', manual_rate='250', buyback='245', stock_qty=5):
    return CatalogProduct.objects.create(
        vendor=vendor, name='Test Gold Bar', metal='gold', weight_grams=Decimal(weight_grams),
        purity='999.9', use_live_rate=False, manual_rate_per_gram=Decimal(manual_rate),
        buyback_per_gram=Decimal(buyback), in_stock=True, visible=True, stock_qty=stock_qty,
    )


def make_paid_order(customer, product, qty_units=1, paid_at=None):
    weight = product.weight_grams * qty_units
    total = product.manual_rate_per_gram * weight
    order = Order.objects.create(
        customer=customer, product=product, qty_units=qty_units, qty_grams=weight,
        rate_per_gram=product.manual_rate_per_gram, metal_rate_per_gram=product.manual_rate_per_gram,
        buyback_per_gram=product.buyback_per_gram, platform_fee_aed=Decimal('0'), total_aed=total,
        status=Order.PAID, expires_at=timezone.now() + dt.timedelta(hours=1),
        paid_at=paid_at or timezone.now(),
    )
    return order


class PaymentCompletionTests(TestCase):
    """Guards backend/users/payment.py: apply_mark_order_paid_for_customer."""

    def setUp(self):
        self.vendor = make_vendor()
        self.customer = make_customer()
        self.product = make_product(self.vendor, stock_qty=5)

    def _accepted_order(self, qty_units=1):
        weight = self.product.weight_grams * qty_units
        return Order.objects.create(
            customer=self.customer, product=self.product, qty_units=qty_units, qty_grams=weight,
            rate_per_gram=self.product.manual_rate_per_gram,
            metal_rate_per_gram=self.product.manual_rate_per_gram,
            buyback_per_gram=self.product.buyback_per_gram, platform_fee_aed=Decimal('0'),
            total_aed=self.product.manual_rate_per_gram * weight, status=Order.VENDOR_ACCEPTED,
            expires_at=timezone.now() + dt.timedelta(hours=1),
        )

    def test_marking_paid_decrements_stock_and_stamps_paid_at(self):
        order = self._accepted_order(qty_units=2)
        self.assertIsNone(order.paid_at)
        ok, err = apply_mark_order_paid_for_customer(order, self.customer, trust_psp=True)
        self.assertTrue(ok, err)
        order.refresh_from_db()
        self.product.refresh_from_db()
        self.assertEqual(order.status, Order.HELD)
        self.assertIsNotNone(order.paid_at)
        self.assertEqual(self.product.stock_qty, 3)  # 5 - 2

    def test_insufficient_stock_blocks_untrusted_manual_path(self):
        """Manual (non-Stripe) completion must not oversell when stock is short."""
        self.product.stock_qty = 0
        self.product.save(update_fields=['stock_qty'])
        order = self._accepted_order(qty_units=1)
        ok, err = apply_mark_order_paid_for_customer(order, self.customer, trust_psp=False)
        self.assertFalse(ok)
        self.assertEqual(err, 'stock')
        order.refresh_from_db()
        self.assertEqual(order.status, Order.VENDOR_ACCEPTED)

    def test_paying_someone_elses_order_is_rejected(self):
        other = make_customer(email='other@test.local')
        order = self._accepted_order()
        ok, err = apply_mark_order_paid_for_customer(order, other, trust_psp=True)
        self.assertFalse(ok)
        self.assertEqual(err, 'forbidden')


class EodPaidAtBucketingTests(TestCase):
    """Guards backend/users/eod_services.py against reverting to created_at-based bucketing —
    an order created on business day D but paid on D+1 was previously excluded from EVERY
    EOD ledger window forever."""

    def setUp(self):
        self.vendor = make_vendor()
        self.customer = make_customer()
        self.product = make_product(self.vendor)

    def test_order_paid_a_day_after_creation_lands_in_the_paid_days_window(self):
        z = dt.timezone.utc
        created_day = dt.datetime(2026, 1, 10, 23, 50, tzinfo=z)
        paid_day = dt.datetime(2026, 1, 11, 10, 0, tzinfo=z)

        order = Order.objects.create(
            customer=self.customer, product=self.product, qty_units=1,
            qty_grams=self.product.weight_grams, rate_per_gram=self.product.manual_rate_per_gram,
            metal_rate_per_gram=self.product.manual_rate_per_gram,
            buyback_per_gram=self.product.buyback_per_gram, platform_fee_aed=Decimal('0'),
            total_aed=self.product.manual_rate_per_gram * self.product.weight_grams,
            status=Order.PAID, expires_at=paid_day + dt.timedelta(hours=1),
        )
        Order.objects.filter(pk=order.pk).update(created_at=created_day, paid_at=paid_day)

        start_d, end_d = vendor_eod_utc_window(self.vendor, dt.date(2026, 1, 10))
        buy_d, _, _ = compute_vendor_day_totals(self.vendor, start_d, end_d)
        self.assertEqual(buy_d, Decimal('0.00'), 'order paid on D+1 must not count in D')

        start_p, end_p = vendor_eod_utc_window(self.vendor, dt.date(2026, 1, 11))
        buy_p, _, _ = compute_vendor_day_totals(self.vendor, start_p, end_p)
        self.assertEqual(buy_p, order.total_aed.quantize(Decimal('0.01')), 'order must count on the day it was actually paid')

    def test_unpaid_paid_at_is_never_double_counted_or_lost(self):
        from zoneinfo import ZoneInfo
        now = timezone.now()
        order = make_paid_order(self.customer, self.product, paid_at=now)
        # Business date must be computed in the vendor's EOD timezone (Asia/Dubai by default),
        # same as vendor_eod_utc_window itself — not the test runner's local/UTC date, which
        # can differ from the Dubai calendar date depending on time of day.
        business_date = now.astimezone(ZoneInfo('Asia/Dubai')).date()
        start, end = vendor_eod_utc_window(self.vendor, business_date)
        buy_d, _, _ = compute_vendor_day_totals(self.vendor, start, end)
        self.assertEqual(buy_d, order.total_aed.quantize(Decimal('0.01')))


class SellBackProfitShareTests(TestCase):
    """Guards the sell-back charge: Cridora's cut must be a share of PROFIT only, matching
    the customer-facing 'Cridora share (X% of profit)' disclosure — never a flat % of the
    sale value, and never charged at all on a loss."""

    def setUp(self):
        self.client = APIClient()
        self.vendor = make_vendor()
        self.customer = make_customer()
        cfg = PlatformConfig.get()
        cfg.sell_share_pct = Decimal('5.00')
        cfg.save()
        self.client.force_authenticate(self.customer)

    def _sell(self, order):
        return self.client.post(
            '/api/auth/sell-orders/', {'buy_order_id': order.id, 'qty_grams': str(order.qty_grams)},
            format='json',
        )

    def test_no_cridora_share_on_a_loss(self):
        product = make_product(self.vendor, manual_rate='250', buyback='245')  # buyback < purchase = loss
        order = make_paid_order(self.customer, product)
        r = self._sell(order)
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        self.assertEqual(Decimal(str(r.data['cridora_share_aed'])), Decimal('0.00'))
        self.assertEqual(Decimal(str(r.data['net_payout_aed'])), Decimal(str(r.data['gross_aed'])))

    def test_cridora_share_is_a_percentage_of_profit_only(self):
        product = make_product(self.vendor, manual_rate='245', buyback='250')  # buyback > purchase = profit
        order = make_paid_order(self.customer, product)
        r = self._sell(order)
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        profit = Decimal(str(r.data['gross_aed'])) - Decimal(str(r.data['purchase_cost_aed']))
        expected_share = (profit * Decimal('5.00') / Decimal('100')).quantize(Decimal('0.01'))
        self.assertEqual(Decimal(str(r.data['cridora_share_aed'])), expected_share)
        self.assertGreater(expected_share, Decimal('0.00'))

    def test_cost_basis_excludes_vendor_fees_vat_and_platform_commission(self):
        """Business rule (as described by the operator): 'actual price of gold' for profit
        purposes is the pure metal cost — vendor packaging/storage/insurance fees, VAT, and
        Cridora's own buy-side commission are all expenses, not part of the cost basis whose
        recovery counts against profit. Confirms Order.metal_rate_per_gram (pure metal, no
        fees/VAT) is what's actually used at sell-back, not Order.rate_per_gram (the all-in
        price the customer paid, which includes fees/VAT and is what total_aed is based on
        before Cridora's platform_fee_aed is even added)."""
        product = make_product(self.vendor, weight_grams='10', manual_rate='240', buyback='260', stock_qty=5)
        product.packaging_fee = Decimal('50')
        product.storage_fee = Decimal('20')
        product.insurance_fee = Decimal('10')
        product.vat_pct = Decimal('5')
        product.vat_inclusive = False
        product.save()

        self.client.force_authenticate(self.customer)
        r = self.client.post('/api/auth/orders/place/', {'product_id': product.id, 'qty': 1}, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        order = Order.objects.get(id=r.data['id'])

        # Pure metal cost (240 * 10g = 2400) must differ from the all-in price the customer
        # actually paid (metal + fees + VAT), proving the two rates genuinely diverge here.
        self.assertEqual(order.metal_rate_per_gram, Decimal('240.0000'))
        all_in_subtotal = Decimal('2400') + Decimal('50') + Decimal('20') + Decimal('10')  # 2480
        expected_rate_per_gram = (all_in_subtotal * Decimal('1.05') / Decimal('10')).quantize(Decimal('0.0001'))
        self.assertEqual(order.rate_per_gram, expected_rate_per_gram)
        self.assertGreater(order.rate_per_gram, order.metal_rate_per_gram, 'all-in rate must include fees/VAT on top of the pure metal rate')

        order.status = Order.VENDOR_ACCEPTED
        order.save(update_fields=['status'])
        ok, err = apply_mark_order_paid_for_customer(order, self.customer, trust_psp=True)
        self.assertTrue(ok, err)

        r2 = self._sell(order)
        self.assertEqual(r2.status_code, status.HTTP_201_CREATED, r2.data)
        # purchase_cost_aed must be qty * pure metal rate (2400), not qty * all-in rate paid.
        self.assertEqual(Decimal(str(r2.data['purchase_cost_aed'])), Decimal('2400.00'))
        self.assertEqual(Decimal(str(r2.data['gross_aed'])), Decimal('2600.00'))  # 260/g buyback * 10g
        self.assertEqual(Decimal(str(r2.data['profit_aed'])), Decimal('200.00'))  # 2600 - 2400, not 2600 - all-in


class ComplianceGatingTests(TestCase):
    """Guards buy/sell endpoints against a customer without completed KYC placing or
    settling trades — this is the gate the Sell button and Buy Now flow both depend on."""

    def setUp(self):
        self.client = APIClient()
        self.vendor = make_vendor()
        self.product = make_product(self.vendor)

    def test_unverified_customer_cannot_place_order(self):
        customer = make_customer(verified=False)
        self.client.force_authenticate(customer)
        r = self.client.post('/api/auth/orders/place/', {'product_id': self.product.id, 'qty': 1}, format='json')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_verified_customer_can_place_order(self):
        customer = make_customer(verified=True)
        self.client.force_authenticate(customer)
        r = self.client.post('/api/auth/orders/place/', {'product_id': self.product.id, 'qty': 1}, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)

    def test_rejected_kyc_customer_is_blocked_with_reason_surfaced(self):
        customer = make_customer(verified=False)
        customer.kyc_status = User.KYC_REJECTED
        customer.kyc_rejection_reason = 'Passport photo unreadable'
        customer.save()
        result = customer_compliance_verification(customer)
        self.assertFalse(result['trading_allowed'])
        self.assertIn('Passport photo unreadable', result['pending_items'][0]['detail'])


class OrderQuantityValidationTests(TestCase):
    """Guards CustomerPlaceOrderView against a qty large enough to overflow the qty_grams
    DecimalField(max_digits=10, decimal_places=4), which previously 500'd instead of 400'ing."""

    def setUp(self):
        self.client = APIClient()
        self.vendor = make_vendor()
        self.customer = make_customer()
        self.client.force_authenticate(self.customer)

    def test_oversized_quantity_is_a_clean_400_not_a_500(self):
        product = make_product(self.vendor, weight_grams='100')
        r = self.client.post('/api/auth/orders/place/', {'product_id': product.id, 'qty': 99999}, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_non_numeric_quantity_is_a_clean_400_not_a_500(self):
        product = make_product(self.vendor)
        r = self.client.post('/api/auth/orders/place/', {'product_id': product.id, 'qty': 'abc'}, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)


class VendorStockValidationTests(TestCase):
    """Guards VendorCatalogView/VendorCatalogDetailView against negative stock_qty."""

    def setUp(self):
        self.client = APIClient()
        self.vendor = make_vendor()
        self.client.force_authenticate(self.vendor)

    def test_negative_stock_qty_is_floored_at_zero_on_create(self):
        r = self.client.post('/api/auth/vendor/catalog/', {
            'name': 'Test', 'metal': 'gold', 'weight': '10', 'purity': '999.9',
            'use_live_rate': False, 'manual_rate_per_gram': '250', 'buyback_per_gram': '245',
            'stock_qty': -5,
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        product = CatalogProduct.objects.get(pk=r.data['id'])
        self.assertEqual(product.stock_qty, 0)
        self.assertFalse(product.in_stock)

    def test_stock_dropped_to_zero_clears_in_stock(self):
        product = make_product(self.vendor, stock_qty=5)
        r = self.client.put(f'/api/auth/vendor/catalog/{product.id}/', {'stock_qty': 0}, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        product.refresh_from_db()
        self.assertEqual(product.stock_qty, 0)
        self.assertFalse(product.in_stock)


class VendorSellOrderPoolBalanceRaceTests(TestCase):
    """Guards VendorSellOrderActionView: two sell-back accepts for the same vendor must not
    both read the same (stale) pool_balance and both mark vendor_balance_used=True when the
    pool can really only cover one of them."""

    def setUp(self):
        self.client = APIClient()
        self.vendor = make_vendor()
        self.customer = make_customer()

    def test_second_accept_recomputes_pool_balance_after_first_commits(self):
        # Vendor pool = 2400 (one paid order). Two pending sell-backs of 2000 each — only the
        # first can legitimately be covered by vendor balance.
        product = make_product(self.vendor, weight_grams='10', manual_rate='240', buyback='200', stock_qty=10)
        make_paid_order(self.customer, product, qty_units=1)  # total_aed = 240 * 10g = 2400 -> pool = 2400

        so1 = SellOrder.objects.create(
            customer=self.customer, buy_order=Order.objects.filter(status=Order.PAID).first(),
            qty_grams=Decimal('10'), purchase_rate_per_gram=Decimal('240'),
            buyback_rate_per_gram=Decimal('200'), gross_aed=Decimal('2000'),
            purchase_cost_aed=Decimal('2400'), profit_aed=Decimal('-400'),
            cridora_share_pct=Decimal('5'), cridora_share_aed=Decimal('0'),
            net_payout_aed=Decimal('2000'), status=SellOrder.PENDING_VENDOR,
        )
        so2 = SellOrder.objects.create(
            customer=self.customer, buy_order=so1.buy_order,
            qty_grams=Decimal('10'), purchase_rate_per_gram=Decimal('240'),
            buyback_rate_per_gram=Decimal('200'), gross_aed=Decimal('2000'),
            purchase_cost_aed=Decimal('2400'), profit_aed=Decimal('-400'),
            cridora_share_pct=Decimal('5'), cridora_share_aed=Decimal('0'),
            net_payout_aed=Decimal('2000'), status=SellOrder.PENDING_VENDOR,
        )

        self.client.force_authenticate(self.vendor)
        r1 = self.client.post(f'/api/auth/vendor/sell-orders/{so1.id}/accept/')
        r2 = self.client.post(f'/api/auth/vendor/sell-orders/{so2.id}/accept/')
        self.assertEqual(r1.status_code, status.HTTP_200_OK, r1.data)
        self.assertEqual(r2.status_code, status.HTTP_200_OK, r2.data)

        so1.refresh_from_db()
        so2.refresh_from_db()
        # Both cannot legitimately be vendor_balance_used=True against a 2400 pool with two
        # 2000 payouts — the second must see the first's consumption.
        self.assertFalse(
            so1.vendor_balance_used and so2.vendor_balance_used,
            'both sell-backs were marked vendor-balance-covered against a pool that can only cover one',
        )


class DemoModeGatingTests(TestCase):
    """Guards against a real user with a demo-reserved email seeing fake dashboard data
    instead of their own orders (CRIDORA_DEMO_MODE must default off)."""

    def test_demo_mode_defaults_off(self):
        from django.conf import settings
        self.assertFalse(settings.CRIDORA_DEMO_MODE)

    def test_customer_with_demo_email_sees_real_data_when_demo_mode_off(self):
        vendor = make_vendor()
        customer = make_customer(email='customer@example.com')  # DEMO_CUSTOMER_EMAIL
        product = make_product(vendor)
        order = make_paid_order(customer, product)

        client = APIClient()
        client.force_authenticate(customer)
        r = client.get('/api/auth/dashboard/customer/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        # 'id' holds the human-readable order_ref (e.g. 'ORD-00001'); 'order_id' holds the raw pk.
        order_ids = [o.get('order_id') for o in r.data.get('orders', [])]
        self.assertIn(order.id, order_ids)
