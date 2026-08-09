"""Golden-value tests: Decimal money math must stay exact (no float drift)."""
from decimal import Decimal

from django.test import SimpleTestCase

from cridora.money import grams, money_aed, mul_money, pct_of, rate_4dp, to_decimal
from payments.fees import buy_fee_breakdown, sellback_fee_breakdown


class MoneyHelpersTests(SimpleTestCase):
    def test_to_decimal_avoids_float_binary_artifacts(self):
        # Classic float trap: 0.1 + 0.2 != 0.3 in IEEE-754
        self.assertEqual(to_decimal('0.1') + to_decimal('0.2'), Decimal('0.3'))
        self.assertEqual(money_aed('0.1') + money_aed('0.2'), Decimal('0.30'))

    def test_quantize_policies(self):
        self.assertEqual(money_aed('1.005'), Decimal('1.01'))  # ROUND_HALF_UP
        self.assertEqual(rate_4dp('1.23456'), Decimal('1.2346'))
        self.assertEqual(grams('10.12345'), Decimal('10.1235'))

    def test_mul_money_exact(self):
        # 487.1234 AED/g × 31.1035 g — must not drift via float
        rate = rate_4dp('487.1234')
        qty = grams('31.1035')
        self.assertEqual(mul_money(rate, qty), Decimal('15151.24'))

    def test_pct_of(self):
        self.assertEqual(pct_of(Decimal('1000.00'), Decimal('1.5')), Decimal('15.00'))


class FeeBreakdownTests(SimpleTestCase):
    def test_buy_fee_returns_decimals_not_floats(self):
        class _Cfg:
            buy_fee_pct = Decimal('1.50')
            psp_fee_pct = Decimal('2.60')
            psp_fee_flat_aed = Decimal('0.50')

        b = buy_fee_breakdown(metal_subtotal_aed='1000.00', provider_key='manual_aani', cfg=_Cfg())
        self.assertIsInstance(b['metal_subtotal_aed'], Decimal)
        self.assertIsInstance(b['cridora_service_fee_aed'], Decimal)
        self.assertIsInstance(b['total_due_now_aed'], Decimal)
        self.assertEqual(b['metal_subtotal_aed'], Decimal('1000.00'))
        self.assertEqual(b['cridora_service_fee_aed'], Decimal('15.00'))
        self.assertEqual(b['total_due_now_aed'], Decimal('1015.00'))

    def test_sellback_fee_on_gross_not_gain(self):
        class _Cfg:
            sellback_convenience_fee_pct = Decimal('1.00')
            sellback_convenience_fee_flat_aed = Decimal('5.00')

        sb = sellback_fee_breakdown(gross_aed='1000.00', cfg=_Cfg())
        self.assertEqual(sb['convenience_fee_aed'], Decimal('15.00'))
        self.assertEqual(sb['net_payout_aed'], Decimal('985.00'))
