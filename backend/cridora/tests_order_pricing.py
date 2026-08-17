"""Order pricing lock + card tier + floor guard."""
from decimal import Decimal
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase

from cridora.money import rate_4dp
from cridora.order_pricing import (
    TIER_CARD,
    TIER_WALLET,
    build_locked_quote,
    card_rate_from_wallet,
    tier_for_provider,
)


class OrderPricingUnitTests(SimpleTestCase):
    def test_tier_for_provider(self):
        self.assertEqual(tier_for_provider('manual_aani'), TIER_WALLET)
        self.assertEqual(tier_for_provider('stripe'), TIER_CARD)
        self.assertEqual(tier_for_provider('telr'), TIER_CARD)

    @patch('cridora.order_pricing._landed_for_product')
    @patch('cridora.order_pricing._wallet_rate_for_product')
    def test_card_tier_charges_derived_rate(self, mock_wallet, mock_landed):
        mock_wallet.return_value = Decimal('520.0138')
        mock_landed.return_value = (Decimal('514.5000'), 7)

        product = MagicMock()
        product.metal = 'gold'
        product.purity = '24K'
        product.final_rate_per_gram.return_value = Decimal('520.0138')
        product.effective_rate.return_value = Decimal('520.0138')
        product.effective_buyback_per_gram.return_value = Decimal('510.0000')

        cfg = MagicMock()
        cfg.card_cost_pct = Decimal('2.50')
        cfg.buy_fee_pct = Decimal('0')
        cfg.psp_fee_pct = Decimal('2.60')
        cfg.psp_fee_flat_aed = Decimal('0.50')
        cfg.min_profit_floor_aed_per_g_gold = Decimal('3.00')

        with patch('users.models.PlatformConfig.get', return_value=cfg):
            q_wallet = build_locked_quote(
                product=product, qty_grams=Decimal('5'), provider_key='manual_aani', cfg=cfg,
            )
            q_card = build_locked_quote(
                product=product, qty_grams=Decimal('5'), provider_key='stripe', cfg=cfg,
            )

        self.assertEqual(q_wallet.payment_tier, TIER_WALLET)
        self.assertEqual(q_card.payment_tier, TIER_CARD)
        self.assertEqual(q_wallet.charged_rate, Decimal('520.0138'))
        self.assertEqual(q_card.charged_rate, card_rate_from_wallet(Decimal('520.0138'), Decimal('2.5')))
        self.assertEqual(q_wallet.metal_rate, q_card.metal_rate)  # basis always wallet
        self.assertTrue(q_wallet.floor_ok)
        self.assertEqual(q_wallet.best_vendor_id, 7)
        self.assertEqual(q_wallet.profit_per_gram, rate_4dp(Decimal('520.0138') - Decimal('514.5000')))

    @patch('cridora.order_pricing._landed_for_product')
    @patch('cridora.order_pricing._wallet_rate_for_product')
    def test_floor_blocks_thin_spread(self, mock_wallet, mock_landed):
        mock_wallet.return_value = Decimal('515.0000')
        mock_landed.return_value = (Decimal('514.5000'), 1)  # spread 0.5 < floor 3.0

        product = MagicMock()
        product.metal = 'gold'
        product.purity = '24K'
        product.final_rate_per_gram.return_value = Decimal('515.0000')
        product.effective_rate.return_value = Decimal('515.0000')
        product.effective_buyback_per_gram.return_value = Decimal('510.0000')

        cfg = MagicMock()
        cfg.card_cost_pct = Decimal('2.50')
        cfg.buy_fee_pct = Decimal('0')
        cfg.psp_fee_pct = Decimal('2.60')
        cfg.psp_fee_flat_aed = Decimal('0')
        cfg.min_profit_floor_aed_per_g_gold = Decimal('3.00')

        with patch('users.models.PlatformConfig.get', return_value=cfg):
            q = build_locked_quote(
                product=product, qty_grams=Decimal('1'), provider_key='manual_aani', cfg=cfg,
            )
        self.assertFalse(q.floor_ok)
        self.assertIsNotNone(q.floor_block_reason)
