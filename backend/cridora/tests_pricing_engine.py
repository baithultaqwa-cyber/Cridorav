"""Acceptance tests for principal-trading pricing engine (spec §10–§11)."""
from decimal import Decimal
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, TestCase

from cridora.money import rate_4dp
from cridora.pricing_engine import (
    STATUS_BLOCKED,
    STATUS_EMPTY_BAND,
    STATUS_PUBLISH,
    STATUS_WARN,
    candidate_wallet_rate,
    card_rate_from_wallet,
    profit_per_gram,
    validate_and_resolve_wallet,
)


class PricingEngineMathTests(SimpleTestCase):
    """Pure Decimal math — no DB."""

    def test_worked_example_candidate_and_card(self):
        # Spec §10 illustrative: Rate A 514, markup 1.17%.
        # Exact Decimal: 514 × 1.0117 = 520.0138 (spec rounded to 520.02).
        rate_a = Decimal('514.00')
        candidate = candidate_wallet_rate(rate_a, Decimal('1.17'))
        self.assertEqual(candidate, Decimal('520.0138'))

        card = card_rate_from_wallet(candidate, Decimal('2.5'))
        self.assertEqual(card, rate_4dp(candidate / Decimal('0.975')))

        profit = profit_per_gram(candidate, Decimal('514.50'))
        self.assertEqual(profit, Decimal('5.5138'))
        self.assertGreaterEqual(profit, Decimal('3.00'))  # ≥ gold floor

    def test_band_publish_in_range(self):
        d = validate_and_resolve_wallet(
            Decimal('520.02'),
            Decimal('517.50'),
            Decimal('523.00'),
            metal='gold',
            purity='24K',
        )
        self.assertEqual(d.status, STATUS_PUBLISH)
        self.assertEqual(d.wallet_rate, Decimal('520.0200'))
        self.assertFalse(d.flagged)

    def test_band_blocks_below_floor(self):
        d = validate_and_resolve_wallet(
            Decimal('516.00'),
            Decimal('517.50'),
            Decimal('523.00'),
            metal='gold',
            purity='24K',
        )
        self.assertEqual(d.status, STATUS_BLOCKED)
        self.assertIsNone(d.wallet_rate)
        self.assertTrue(d.flagged)

    def test_band_warns_above_ceiling_warn_only(self):
        d = validate_and_resolve_wallet(
            Decimal('524.00'),
            Decimal('517.50'),
            Decimal('523.00'),
            ceiling_cross_policy='warn_only',
            metal='gold',
            purity='24K',
        )
        self.assertEqual(d.status, STATUS_WARN)
        self.assertEqual(d.wallet_rate, Decimal('524.0000'))
        self.assertTrue(d.flagged)

    def test_band_clamps_above_ceiling(self):
        d = validate_and_resolve_wallet(
            Decimal('524.00'),
            Decimal('517.50'),
            Decimal('523.00'),
            ceiling_cross_policy='clamp_to_ceiling',
            metal='gold',
            purity='24K',
        )
        self.assertEqual(d.status, STATUS_WARN)
        self.assertEqual(d.wallet_rate, Decimal('523.0000'))

    def test_empty_band_when_ceiling_below_floor(self):
        # Spec: retail crash → ceiling 515.50 < floor 517.50
        d = validate_and_resolve_wallet(
            Decimal('520.02'),
            Decimal('517.50'),
            Decimal('515.50'),
            metal='gold',
            purity='24K',
        )
        self.assertEqual(d.status, STATUS_EMPTY_BAND)
        self.assertIsNone(d.wallet_rate)

    def test_card_rate_identity(self):
        w = Decimal('100.0000')
        self.assertEqual(card_rate_from_wallet(w, Decimal('2.5')), Decimal('102.5641'))


class PricingEngineBandIntegrationTests(TestCase):
    """Band resolution with PlatformConfig + mocked Rate B / vendors."""

    def setUp(self):
        from users.models import PlatformConfig

        self.cfg = PlatformConfig.get()
        self.cfg.wallet_markup_pct_gold = Decimal('1.17')
        self.cfg.wallet_markup_pct_silver = Decimal('5.00')
        self.cfg.min_profit_floor_aed_per_g_gold = Decimal('3.00')
        self.cfg.min_profit_floor_aed_per_g_silver = Decimal('0.10')
        self.cfg.ceiling_epsilon_aed_per_g = Decimal('0.50')
        self.cfg.rate_b_manual_override_gold_24k_aed_per_g = Decimal('523.50')
        self.cfg.rate_b_manual_override_silver_999_aed_per_g = Decimal('8.00')
        self.cfg.ceiling_cross_policy = 'warn_only'
        self.cfg.card_cost_pct = Decimal('2.50')
        self.cfg.buy_fee_pct = Decimal('0')
        self.cfg.save()

        self.raw = {
            'currency': 'AED',
            'unit': 'per_gram',
            'source': 'spot',
            'gold': {'24K': 514.0, '22K': 471.18, '21K': 449.75, '18K': 385.5},
            'silver': {'999': 6.5, '925': 6.01},
        }

    @patch('cridora.pricing_engine._fetch_rate_b_live', return_value=None)
    @patch('cridora.pricing_engine.best_vendor_landed_cost')
    def test_build_wallet_publishes_worked_example(self, mock_best, _mock_b):
        from cridora.pricing_engine import (
            CACHE_KEY_LAST_VALID_WALLET,
            CACHE_KEY_WALLET_TICKER,
            build_wallet_ticker_payload,
        )
        from django.core.cache import cache

        cache.delete(CACHE_KEY_LAST_VALID_WALLET)
        cache.delete(CACHE_KEY_WALLET_TICKER)

        def _landed(metal, purity, rate_a):
            # Wholesale = Rate A + fixed markup (matches worked example for 24K).
            add = Decimal('0.50') if metal == 'gold' else Decimal('0.05')
            return (rate_4dp(to_decimal(rate_a) + add), 1)

        from cridora.money import to_decimal
        mock_best.side_effect = _landed
        payload = build_wallet_ticker_payload(self.raw, cfg=self.cfg)
        self.assertNotEqual(payload.get('source'), 'last_valid_wallet')
        self.assertEqual(payload['pricing_model'], 'principal_trading_v1')
        self.assertEqual(payload['ticker_label'], 'Cridora wallet (Aani) rate')
        self.assertAlmostEqual(payload['gold']['24K'], 520.0138, places=4)
        # card = wallet ÷ (1 − 0.025)
        self.assertAlmostEqual(
            payload['card']['gold']['24K'],
            float(rate_4dp(Decimal(str(payload['gold']['24K'])) / Decimal('0.975'))),
            places=4,
        )
        self.assertIn(payload.get('band_status'), ('ok', 'warn', 'partial'))

    @patch('cridora.pricing_engine._fetch_rate_b_live', return_value=None)
    @patch('cridora.pricing_engine.best_vendor_landed_cost')
    def test_below_cost_holds_last_valid(self, mock_best, _mock_b):
        from cridora.pricing_engine import (
            CACHE_KEY_LAST_VALID_WALLET,
            CACHE_KEY_WALLET_TICKER,
            build_wallet_ticker_payload,
        )
        from django.core.cache import cache

        cache.delete(CACHE_KEY_WALLET_TICKER)

        def _landed(metal, purity, rate_a):
            add = Decimal('0.50') if metal == 'gold' else Decimal('0.05')
            return (rate_4dp(to_decimal(rate_a) + add), 1)

        from cridora.money import to_decimal
        mock_best.side_effect = _landed
        # Seed a last-valid ticker
        last = {
            'currency': 'AED',
            'unit': 'per_gram',
            'source': 'spot',
            'gold': {'24K': 519.0, '22K': 475.0, '21K': 454.0, '18K': 389.0},
            'silver': {'999': 6.6, '925': 6.1},
            'ticker_label': 'Cridora wallet (Aani) rate',
            'pricing_model': 'principal_trading_v1',
        }
        cache.set(CACHE_KEY_LAST_VALID_WALLET, last, timeout=3600)

        # Crash retail so floor > ceiling → empty band → hold
        self.cfg.rate_b_manual_override_gold_24k_aed_per_g = Decimal('516.00')
        self.cfg.save()
        payload = build_wallet_ticker_payload(self.raw, cfg=self.cfg)
        self.assertEqual(payload['source'], 'last_valid_wallet')
        self.assertEqual(payload['gold']['24K'], 519.0)

    def test_buy_fee_default_zero_on_new_config_shape(self):
        from users.models import PlatformConfig
        # After migration seed, singleton should have buy_fee 0 from our setUp or defaults
        self.assertEqual(Decimal(self.cfg.buy_fee_pct), Decimal('0'))
        # Model default for fresh instances
        self.assertEqual(PlatformConfig._meta.get_field('buy_fee_pct').default, 0)
