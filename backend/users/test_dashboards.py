"""
Regression tests for cross-dashboard numeric correctness (2026-07-30 audit).

These guard the aggregate math surfaced on the Customer, Vendor, and Admin
dashboards, the catalog pricing (VAT + fees), and the treasury / vendor-payout
summary endpoints used by Admin > Settlement. Each test independently
recomputes the expected number from raw model fields so a future change that
silently breaks one of these aggregates (wrong field, missing fee, double
count, stale price used, etc.) fails loudly here instead of only being
noticed as "the numbers don't match" in production.
"""
import datetime as dt
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from .models import (
    AdminVendorPayout,
    CatalogProduct,
    CustomerBankDetails,
    EndOfDayPayout,
    EodVendorLedger,
    KYCDocument,
    Order,
    PlatformConfig,
    SellOrder,
    User,
    VendorToAdminRepayment,
)


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


def make_product(vendor, weight_grams='10', manual_rate='250', buyback='245', stock_qty=5, **kwargs):
    # Default metal is platinum so manual_rate_per_gram is the customer sell rate
    # (gold/silver sell via Cridora ticker under principal trading).
    defaults = dict(
        vendor=vendor, name='Test Metal Bar', metal='platinum', weight_grams=Decimal(weight_grams),
        purity='999.5', use_live_rate=False, manual_rate_per_gram=Decimal(manual_rate),
        buyback_per_gram=Decimal(buyback), in_stock=True, visible=True, stock_qty=stock_qty,
    )
    defaults.update(kwargs)
    return CatalogProduct.objects.create(**defaults)


def make_paid_order(customer, product, qty_units=1, platform_fee='0', paid_at=None):
    weight = product.weight_grams * qty_units
    total = product.manual_rate_per_gram * weight + Decimal(platform_fee)
    return Order.objects.create(
        customer=customer, product=product, qty_units=qty_units, qty_grams=weight,
        rate_per_gram=product.manual_rate_per_gram, metal_rate_per_gram=product.manual_rate_per_gram,
        buyback_per_gram=product.buyback_per_gram, platform_fee_aed=Decimal(platform_fee), total_aed=total,
        status=Order.PAID, expires_at=timezone.now() + dt.timedelta(hours=1),
        paid_at=paid_at or timezone.now(),
    )


class AdminKycKybQueueTests(TestCase):
    """Regression test for the 2026-07-29 production bug: customer_ready_for_kyc_approval
    and vendor_ready_for_kyb_approval returned a bare bool, which the admin dashboard view
    unpacked as a tuple -> TypeError -> 500 -> the frontend silently showed empty KYC/KYB
    queues. Confirms the admin dashboard API call succeeds and actually lists pending
    customers/vendors."""

    def setUp(self):
        self.admin = User.objects.create_user(
            username='admin@test.local', email='admin@test.local', password='x', user_type=User.ADMIN,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_pending_customer_and_vendor_appear_in_queues(self):
        customer = make_customer(email='pending-cust@test.local', verified=False)
        vendor = make_vendor(email='pending-vend@test.local')
        vendor.kyc_status = User.KYC_PENDING
        vendor.save(update_fields=['kyc_status'])

        r = self.client.get('/api/auth/dashboard/admin/')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)

        kyc_ids = [e['id'] for e in r.data['kyc_queue']]
        kyb_ids = [e['id'] for e in r.data['kyb_queue']]
        self.assertIn(customer.id, kyc_ids, 'pending customer missing from admin KYC queue')
        self.assertIn(vendor.id, kyb_ids, 'pending vendor missing from admin KYB queue')

    def test_fully_verified_users_do_not_clutter_the_queues(self):
        make_customer(email='verified-cust@test.local', verified=True)
        r = self.client.get('/api/auth/dashboard/admin/')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data['kyc_queue'], [])
        self.assertEqual(r.data['kyb_queue'], [])


class AdminDashboardRevenueAggregateTests(TestCase):
    """Guards _admin_dashboard_data's revenue math: total_buy_volume_aed must be the sum of
    ALL paid orders' total_aed (fees included), platform_buy_fees_aed only the fee slice,
    and platform_revenue_aed must equal buy fees + completed sell-back Cridora shares —
    never double-counted and never missing a component."""

    def setUp(self):
        self.admin = User.objects.create_user(
            username='admin2@test.local', email='admin2@test.local', password='x', user_type=User.ADMIN,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.vendor = make_vendor()
        self.customer = make_customer()

    def test_buy_and_sell_totals_match_hand_computed_sums(self):
        p1 = make_product(self.vendor, weight_grams='10', manual_rate='250', buyback='245', stock_qty=5)
        p2 = make_product(self.vendor, weight_grams='5', manual_rate='300', buyback='280', stock_qty=5)
        o1 = make_paid_order(self.customer, p1, qty_units=1, platform_fee='37.50')  # total 2537.50
        o2 = make_paid_order(self.customer, p2, qty_units=2, platform_fee='45.00')  # total 3045.00

        so = SellOrder.objects.create(
            customer=self.customer, buy_order=o1,
            qty_grams=Decimal('10'), purchase_rate_per_gram=Decimal('250'),
            buyback_rate_per_gram=Decimal('245'), gross_aed=Decimal('2450'),
            purchase_cost_aed=Decimal('2500'), profit_aed=Decimal('-50'),
            cridora_share_pct=Decimal('5'), cridora_share_aed=Decimal('0'),
            net_payout_aed=Decimal('2450'), status=SellOrder.COMPLETED,
        )

        expected_buy_volume = o1.total_aed + o2.total_aed  # 5582.50
        expected_buy_fees = o1.platform_fee_aed + o2.platform_fee_aed  # 82.50
        expected_sell_gross = so.gross_aed  # 2450.00
        expected_cridora_from_sells = so.cridora_share_aed  # 0.00
        expected_platform_revenue = expected_buy_fees + expected_cridora_from_sells

        r = self.client.get('/api/auth/dashboard/admin/')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        stats = r.data['stats']
        self.assertEqual(Decimal(str(stats['total_buy_volume_aed'])), expected_buy_volume)
        self.assertEqual(Decimal(str(stats['platform_buy_fees_aed'])), expected_buy_fees)
        self.assertEqual(Decimal(str(stats['total_sellback_volume_aed'])), expected_sell_gross)
        self.assertEqual(Decimal(str(stats['platform_sell_cridora_aed'])), expected_cridora_from_sells)
        self.assertEqual(Decimal(str(stats['platform_revenue_aed'])), expected_platform_revenue)

    def test_non_paid_orders_and_non_completed_sells_are_excluded(self):
        p1 = make_product(self.vendor)
        Order.objects.create(
            customer=self.customer, product=p1, qty_units=1, qty_grams=p1.weight_grams,
            rate_per_gram=p1.manual_rate_per_gram, metal_rate_per_gram=p1.manual_rate_per_gram,
            buyback_per_gram=p1.buyback_per_gram, platform_fee_aed=Decimal('10'),
            total_aed=Decimal('2510'), status=Order.PENDING_VENDOR,
            expires_at=timezone.now() + dt.timedelta(hours=1),
        )
        r = self.client.get('/api/auth/dashboard/admin/')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data['stats']['total_buy_volume_aed'], 0.0)


class VendorDashboardAggregateTests(TestCase):
    """Guards _vendor_dashboard_data: pool_balance_aed = vendor's net buy revenue (total_aed
    minus platform_fee_aed, i.e. what the vendor is owed) minus completed sell-back payouts.
    available_balance_aed further subtracts amounts reserved by pending (unpaid) orders. This
    is the same pool math VendorSellOrderPoolBalanceRaceTests depends on for the accept flow —
    the dashboard number must never diverge from what the accept endpoint actually enforces."""

    def setUp(self):
        self.vendor = make_vendor()
        self.customer = make_customer()
        self.client = APIClient()
        self.client.force_authenticate(self.vendor)

    def test_pool_balance_and_available_balance_match_hand_computed_values(self):
        product = make_product(self.vendor, weight_grams='10', manual_rate='240', buyback='200', stock_qty=10)
        paid = make_paid_order(self.customer, product, qty_units=1, platform_fee='0')  # vendor net 2400

        pending = Order.objects.create(
            customer=self.customer, product=product, qty_units=1, qty_grams=product.weight_grams,
            rate_per_gram=product.manual_rate_per_gram, metal_rate_per_gram=product.manual_rate_per_gram,
            buyback_per_gram=product.buyback_per_gram, platform_fee_aed=Decimal('0'),
            total_aed=Decimal('2400'), status=Order.VENDOR_ACCEPTED,
            expires_at=timezone.now() + dt.timedelta(hours=1),
        )

        so = SellOrder.objects.create(
            customer=self.customer, buy_order=paid,
            qty_grams=Decimal('5'), purchase_rate_per_gram=Decimal('240'),
            buyback_rate_per_gram=Decimal('200'), gross_aed=Decimal('1000'),
            purchase_cost_aed=Decimal('1200'), profit_aed=Decimal('-200'),
            cridora_share_pct=Decimal('5'), cridora_share_aed=Decimal('0'),
            net_payout_aed=Decimal('1000'), status=SellOrder.COMPLETED,
        )

        expected_revenue_total = paid.total_aed - paid.platform_fee_aed  # 2400
        expected_pool_balance = expected_revenue_total - so.net_payout_aed  # 2400 - 1000 = 1400
        expected_available = expected_pool_balance - pending.total_aed  # 1400 - 2400 = -1000

        r = self.client.get('/api/auth/dashboard/vendor/')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        fin = r.data['financials']
        self.assertEqual(Decimal(str(fin['pool_balance_aed'])), expected_pool_balance)
        self.assertEqual(Decimal(str(fin['total_sellbacks_aed'])), so.net_payout_aed)
        self.assertEqual(Decimal(str(fin['pending_debits_aed'])), pending.total_aed)
        self.assertEqual(Decimal(str(fin['available_balance_aed'])), expected_available)

    def test_stats_do_not_leak_other_vendors_orders(self):
        other_vendor = make_vendor(email='other-vendor@test.local')
        other_product = make_product(other_vendor, manual_rate='999')
        make_paid_order(self.customer, other_product, qty_units=1)

        r = self.client.get('/api/auth/dashboard/vendor/')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data['financials']['pool_balance_aed'], 0.0)


class CustomerPortfolioAggregateTests(TestCase):
    """Guards _customer_dashboard_data's portfolio math: total_invested must stay pinned to
    the ORIGINAL purchase rate (Order.metal_rate_per_gram) forever, while total_value must
    track the CURRENT live/manual product rate — these must diverge once the vendor changes
    their price after the sale, and unrealized P&L must be computed from that divergence."""

    def setUp(self):
        self.vendor = make_vendor()
        self.customer = make_customer()
        self.client = APIClient()
        self.client.force_authenticate(self.customer)

    def test_unrealized_pnl_reflects_price_change_after_purchase(self):
        """total_value_aed is marked at the current live/ask rate (effective_rate), but
        unrealized_pnl_aed is deliberately marked at the current BUYBACK rate (what the
        customer could actually realize by selling back today) — these are two different,
        both-correct numbers by design, not the same rate. See total_buyback_value_aed."""
        product = make_product(self.vendor, weight_grams='10', manual_rate='240', buyback='245', stock_qty=5)
        order = make_paid_order(self.customer, product, qty_units=2)  # 20g @ 240 = 4800 invested

        # Vendor raises the live price after the sale — must NOT retroactively change what
        # this customer is shown as having invested.
        product.manual_rate_per_gram = Decimal('260')
        product.buyback_per_gram = Decimal('255')
        product.save(update_fields=['manual_rate_per_gram', 'buyback_per_gram'])

        expected_invested = Decimal('20') * Decimal('240')  # 4800
        expected_value = Decimal('20') * Decimal('260')  # 5200 (live/ask mark)
        expected_buyback_value = Decimal('20') * Decimal('255')  # 5100 (sell-back mark)
        expected_pnl = expected_buyback_value - expected_invested  # 300 — buyback-based, not live-based
        expected_pct = round(float(expected_pnl) / float(expected_invested) * 100, 2)

        r = self.client.get('/api/auth/dashboard/customer/')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        pf = r.data['portfolio']
        self.assertEqual(Decimal(str(pf['total_invested_aed'])), expected_invested)
        self.assertEqual(Decimal(str(pf['total_value_aed'])), expected_value)
        self.assertEqual(Decimal(str(pf['total_buyback_value_aed'])), expected_buyback_value)
        self.assertEqual(Decimal(str(pf['unrealized_pnl_aed'])), expected_pnl)
        self.assertEqual(pf['unrealized_pnl_pct'], expected_pct)
        self.assertEqual(pf['other_grams'], 20.0)

        self.assertEqual(len(r.data['holdings']), 1)
        h = r.data['holdings'][0]
        self.assertEqual(Decimal(str(h['purchase_value'])), expected_invested)
        self.assertEqual(Decimal(str(h['current_value'])), expected_value)
        self.assertEqual(Decimal(str(h['current_sell_value_aed'])), expected_buyback_value)
        # The row's own pnl_aed must reconcile with (current_sell_value - purchase_value), the
        # same buyback-based basis as the portfolio-level unrealized_pnl_aed — NOT with
        # (current_value - purchase_value), which would silently disagree by design.
        self.assertEqual(Decimal(str(h['pnl_aed'])), expected_buyback_value - expected_invested)

    def test_realized_pnl_only_counts_completed_sellbacks(self):
        product = make_product(self.vendor, weight_grams='10', manual_rate='240', buyback='260', stock_qty=5)
        order = make_paid_order(self.customer, product, qty_units=1)

        completed = SellOrder.objects.create(
            customer=self.customer, buy_order=order,
            qty_grams=Decimal('5'), purchase_rate_per_gram=Decimal('240'),
            buyback_rate_per_gram=Decimal('260'), gross_aed=Decimal('1300'),
            purchase_cost_aed=Decimal('1200'), profit_aed=Decimal('100'),
            cridora_share_pct=Decimal('5'), cridora_share_aed=Decimal('5'),
            net_payout_aed=Decimal('1295'), status=SellOrder.COMPLETED,
        )
        # A pending sell-back must NOT contribute to realized P&L yet.
        SellOrder.objects.create(
            customer=self.customer, buy_order=order,
            qty_grams=Decimal('2'), purchase_rate_per_gram=Decimal('240'),
            buyback_rate_per_gram=Decimal('260'), gross_aed=Decimal('520'),
            purchase_cost_aed=Decimal('480'), profit_aed=Decimal('40'),
            cridora_share_pct=Decimal('5'), cridora_share_aed=Decimal('2'),
            net_payout_aed=Decimal('518'), status=SellOrder.PENDING_VENDOR,
        )

        expected_realized = completed.net_payout_aed - completed.purchase_cost_aed  # 1295 - 1200 = 95

        r = self.client.get('/api/auth/dashboard/customer/')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(Decimal(str(r.data['portfolio']['realized_pnl_aed'])), expected_realized)


class CatalogFinalPriceTests(TestCase):
    """Guards CatalogProduct.final_price()/final_rate_per_gram(): the same formula the
    checkout order-placement view relies on (metal cost + packaging/storage/insurance fees,
    then VAT on top unless vat_inclusive) — catalog listing price must always match what the
    customer is actually charged at checkout."""

    def setUp(self):
        self.vendor = make_vendor()

    def test_vat_exclusive_adds_vat_on_top_of_metal_and_fees(self):
        product = make_product(
            self.vendor, weight_grams='10', manual_rate='240', stock_qty=5,
            packaging_fee=Decimal('50'), storage_fee=Decimal('20'), insurance_fee=Decimal('10'),
            vat_pct=Decimal('5'), vat_inclusive=False,
        )
        subtotal = Decimal('2400') + Decimal('50') + Decimal('20') + Decimal('10')  # 2480
        expected_price = (subtotal * Decimal('1.05')).quantize(Decimal('0.01'))
        expected_rate_per_gram = (expected_price / Decimal('10')).quantize(Decimal('0.0001'))

        self.assertEqual(product.final_price(), expected_price)
        self.assertEqual(product.final_rate_per_gram(), expected_rate_per_gram)

    def test_vat_inclusive_does_not_add_vat_again(self):
        product = make_product(
            self.vendor, weight_grams='10', manual_rate='240', stock_qty=5,
            packaging_fee=Decimal('50'), storage_fee=Decimal('20'), insurance_fee=Decimal('10'),
            vat_pct=Decimal('5'), vat_inclusive=True,
        )
        subtotal = Decimal('2400') + Decimal('50') + Decimal('20') + Decimal('10')  # 2480
        self.assertEqual(product.final_price(), subtotal.quantize(Decimal('0.01')))

    def test_zero_fees_and_zero_vat_equals_pure_metal_cost(self):
        product = make_product(self.vendor, weight_grams='10', manual_rate='240', stock_qty=5)
        self.assertEqual(product.final_price(), Decimal('2400.00'))
        self.assertEqual(product.final_rate_per_gram(), Decimal('240.0000'))


class TreasurySummaryAggregateTests(TestCase):
    """Guards users/treasury_summary.py:_build_summary — the admin Settlement/Treasury view's
    period aggregates must equal a plain hand-sum over the same orders/sell-orders, and the
    vendor-scoped summary must only include that vendor's own rows."""

    def setUp(self):
        self.vendor_a = make_vendor(email='va@test.local')
        self.vendor_b = make_vendor(email='vb@test.local')
        self.customer = make_customer()

    def test_admin_summary_aggregates_all_vendors(self):
        from .treasury_summary import _build_summary

        now = timezone.now()
        start = now - dt.timedelta(hours=1)
        end = now + dt.timedelta(hours=1)

        pa = make_product(self.vendor_a, weight_grams='10', manual_rate='240', stock_qty=5)
        pb = make_product(self.vendor_b, weight_grams='5', manual_rate='300', stock_qty=5)
        oa = make_paid_order(self.customer, pa, qty_units=1, platform_fee='20', paid_at=now)  # 2420
        ob = make_paid_order(self.customer, pb, qty_units=1, platform_fee='15', paid_at=now)  # 1515

        so = SellOrder.objects.create(
            customer=self.customer, buy_order=oa,
            qty_grams=Decimal('5'), purchase_rate_per_gram=Decimal('240'),
            buyback_rate_per_gram=Decimal('250'), gross_aed=Decimal('1250'),
            purchase_cost_aed=Decimal('1200'), profit_aed=Decimal('50'),
            cridora_share_pct=Decimal('5'), cridora_share_aed=Decimal('2.50'),
            net_payout_aed=Decimal('1247.50'), status=SellOrder.COMPLETED,
        )
        SellOrder.objects.filter(pk=so.pk).update(updated_at=now)

        summary = _build_summary(start, end, None)
        self.assertEqual(summary['buys']['count'], 2)
        self.assertEqual(Decimal(str(summary['buys']['gross_aed'])), oa.total_aed + ob.total_aed)
        self.assertEqual(
            Decimal(str(summary['buys']['platform_fees_aed'])), oa.platform_fee_aed + ob.platform_fee_aed
        )
        self.assertEqual(
            Decimal(str(summary['buys']['vendor_share_aed'])),
            (oa.total_aed - oa.platform_fee_aed) + (ob.total_aed - ob.platform_fee_aed),
        )
        self.assertEqual(summary['sells']['completed_count'], 1)
        self.assertEqual(Decimal(str(summary['sells']['gross_buyback_aed'])), so.gross_aed)
        self.assertEqual(Decimal(str(summary['sells']['cridora_share_aed'])), so.cridora_share_aed)
        expected_platform_in = oa.platform_fee_aed + ob.platform_fee_aed + so.cridora_share_aed
        self.assertEqual(
            Decimal(str(summary['platform']['fee_and_sell_share_inflow_aed'])), expected_platform_in
        )

    def test_vendor_scoped_summary_excludes_other_vendors(self):
        from .treasury_summary import _build_summary, _vendor_treasury_public_summary

        now = timezone.now()
        start = now - dt.timedelta(hours=1)
        end = now + dt.timedelta(hours=1)
        pa = make_product(self.vendor_a, weight_grams='10', manual_rate='240', stock_qty=5)
        pb = make_product(self.vendor_b, weight_grams='5', manual_rate='300', stock_qty=5)
        make_paid_order(self.customer, pa, qty_units=1, platform_fee='20', paid_at=now)
        make_paid_order(self.customer, pb, qty_units=1, platform_fee='15', paid_at=now)

        full = _build_summary(start, end, self.vendor_a)
        vendor_view = _vendor_treasury_public_summary(full)
        self.assertEqual(full['buys']['count'], 1)
        self.assertEqual(vendor_view['buys']['count'], 1)
        # Vendor-facing summary must never leak Cridora's own fee figures.
        self.assertNotIn('platform_fees_aed', vendor_view['buys'])
        self.assertNotIn('cridora_share_aed', vendor_view.get('sells', {}))


class TwoLegSellbackRevenueTests(TestCase):
    """Regression test for the 2026-07-30 audit finding: a completed SellOrder created under
    SELLBACK_TWO_LEG_ENABLED has cridora_share_aed == 0 and the real Cridora revenue sitting in
    convenience_fee_aed instead — several admin/treasury aggregates only summed
    cridora_share_aed, silently dropping two-leg revenue from platform totals. These aggregates
    must always equal cridora_share_aed + convenience_fee_aed per completed sell, regardless of
    which fee model produced the order."""

    def setUp(self):
        self.admin = User.objects.create_user(
            username='admin-twoleg@test.local', email='admin-twoleg@test.local', password='x',
            user_type=User.ADMIN,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.vendor = make_vendor()
        self.customer = make_customer()

    def _make_two_leg_sell(self, buy_order, gross='1000', fee='15'):
        return SellOrder.objects.create(
            customer=self.customer, buy_order=buy_order,
            qty_grams=Decimal('5'), purchase_rate_per_gram=Decimal('240'),
            buyback_rate_per_gram=Decimal('200'), gross_aed=Decimal(gross),
            purchase_cost_aed=Decimal('1200'), profit_aed=Decimal('-200'),
            cridora_share_pct=Decimal('0'), cridora_share_aed=Decimal('0'),
            convenience_fee_aed=Decimal(fee),
            net_payout_aed=Decimal(gross) - Decimal(fee), status=SellOrder.COMPLETED,
        )

    def test_admin_dashboard_includes_convenience_fee_in_revenue(self):
        product = make_product(self.vendor, weight_grams='10', manual_rate='240', buyback='200', stock_qty=5)
        order = make_paid_order(self.customer, product, qty_units=1, platform_fee='20')  # buy fee 20
        so = self._make_two_leg_sell(order, gross='1000', fee='15')

        r = self.client.get('/api/auth/dashboard/admin/')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        stats = r.data['stats']
        expected_cridora_from_sells = so.cridora_share_aed + so.convenience_fee_aed  # 0 + 15 = 15
        self.assertEqual(Decimal(str(stats['platform_sell_cridora_aed'])), expected_cridora_from_sells)
        expected_platform_revenue = order.platform_fee_aed + expected_cridora_from_sells  # 35
        self.assertEqual(Decimal(str(stats['platform_revenue_aed'])), expected_platform_revenue)

        sell_tx = next(t for t in r.data['recent_transactions'] if t['type'] == 'SELL')
        self.assertEqual(Decimal(str(sell_tx['platform_fee_aed'])), expected_cridora_from_sells)

        ledger_row = next(row for row in r.data['platform_revenue_ledger'] if row['type'] == 'SELL')
        self.assertEqual(Decimal(str(ledger_row['admin_revenue_aed'])), expected_cridora_from_sells)

    def test_treasury_summary_includes_convenience_fee_in_revenue(self):
        from .treasury_summary import _build_summary, _build_transaction_list

        now = timezone.now()
        start = now - dt.timedelta(hours=1)
        end = now + dt.timedelta(hours=1)
        product = make_product(self.vendor, weight_grams='10', manual_rate='240', buyback='200', stock_qty=5)
        order = make_paid_order(self.customer, product, qty_units=1, platform_fee='20', paid_at=now)
        so = self._make_two_leg_sell(order, gross='1000', fee='15')
        SellOrder.objects.filter(pk=so.pk).update(updated_at=now)

        summary = _build_summary(start, end, None)
        expected_cridora_from_sells = so.cridora_share_aed + so.convenience_fee_aed  # 15
        self.assertEqual(Decimal(str(summary['sells']['cridora_share_aed'])), expected_cridora_from_sells)
        expected_platform_in = order.platform_fee_aed + expected_cridora_from_sells  # 35
        self.assertEqual(
            Decimal(str(summary['platform']['fee_and_sell_share_inflow_aed'])), expected_platform_in
        )

        transactions = _build_transaction_list(start, end)
        sell_row = next(t for t in transactions if t['type'] == 'SELL')
        self.assertEqual(Decimal(str(sell_row['cridora_share_aed'])), expected_cridora_from_sells)


class CustomerSellbackPricingConfigTests(TestCase):
    """The customer dashboard's `platform` block must expose the live sell-back fee model
    (profit-share vs. two-leg convenience fee) so the SellModal preview can mirror
    payments/fees.sellback_fee_breakdown exactly instead of guessing profit-share always."""

    def setUp(self):
        self.customer = make_customer()
        self.client = APIClient()
        self.client.force_authenticate(self.customer)

    def test_platform_block_exposes_sellback_fee_config(self):
        cfg = PlatformConfig.get()
        cfg.sellback_convenience_fee_pct = Decimal('1.25')
        cfg.sellback_convenience_fee_flat_aed = Decimal('2.00')
        cfg.save(update_fields=['sellback_convenience_fee_pct', 'sellback_convenience_fee_flat_aed'])

        r = self.client.get('/api/auth/dashboard/customer/')
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        platform = r.data['platform']
        self.assertIn('sellback_two_leg_enabled', platform)
        self.assertEqual(Decimal(str(platform['sellback_convenience_fee_pct'])), Decimal('1.25'))
        self.assertEqual(Decimal(str(platform['sellback_convenience_fee_flat_aed'])), Decimal('2.00'))


class VendorPayoutSummaryTests(TestCase):
    """Guards users/vendor_payout_summary.py:_build_vendor_payout_summary — per-vendor
    payable/held/repayment totals shown to admin in Settlement must equal a plain sum over
    that vendor's EodVendorLedger rows, split correctly by status."""

    def setUp(self):
        self.vendor = make_vendor()
        # One EodVendorLedger row per (eod, vendor) pair — each ledger line needs its own
        # EOD run to avoid the unique_together(eod, vendor) constraint.
        self.eod1 = EndOfDayPayout.objects.create(business_date=dt.date(2026, 1, 10))
        self.eod2 = EndOfDayPayout.objects.create(business_date=dt.date(2026, 1, 11))
        self.eod3 = EndOfDayPayout.objects.create(business_date=dt.date(2026, 1, 12))

    def test_pending_and_repayment_totals_are_summed_by_status(self):
        EodVendorLedger.objects.create(
            eod=self.eod1, vendor=self.vendor, buy_revenue_aed=Decimal('1000'),
            sell_deductions_aed=Decimal('0'), net_before_hold_aed=Decimal('1000'),
            held_aed=Decimal('100'), payable_to_vendor_aed=Decimal('900'),
            status=EodVendorLedger.PENDING_BANK,
        )
        EodVendorLedger.objects.create(
            eod=self.eod2, vendor=self.vendor, buy_revenue_aed=Decimal('500'),
            sell_deductions_aed=Decimal('0'), net_before_hold_aed=Decimal('500'),
            held_aed=Decimal('50'), payable_to_vendor_aed=Decimal('450'),
            status=EodVendorLedger.PENDING_BANK,
        )
        EodVendorLedger.objects.create(
            eod=self.eod3, vendor=self.vendor, buy_revenue_aed=Decimal('0'),
            sell_deductions_aed=Decimal('800'), net_before_hold_aed=Decimal('-800'),
            held_aed=Decimal('0'), payable_to_vendor_aed=Decimal('-800'),
            status=EodVendorLedger.PENDING_REPAYMENT,
        )

        from .vendor_payout_summary import _build_vendor_payout_summary

        rows = _build_vendor_payout_summary()
        row = next(r for r in rows if r['vendor_id'] == self.vendor.id)
        self.assertEqual(row['payable_now_aed'], 900 + 450)
        self.assertEqual(row['vendor_owed_eod_aed'], 800)
        self.assertEqual(row['total_held_aed'], 100 + 50 + 0)

    def test_vendor_with_no_pending_activity_is_omitted(self):
        from .vendor_payout_summary import _build_vendor_payout_summary

        rows = _build_vendor_payout_summary()
        self.assertFalse(any(r['vendor_id'] == self.vendor.id for r in rows))
