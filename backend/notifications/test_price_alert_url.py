from django.test import SimpleTestCase

from notifications.services import PRICE_COMPARE_PATH, price_alert_compare_url


class PriceAlertCompareUrlTests(SimpleTestCase):
    def test_gold_up_includes_direction_and_rates(self):
        url = price_alert_compare_url(
            metal='gold',
            old_price=400.0,
            new_price=412.5,
            pct=3.125,
        )
        self.assertTrue(url.startswith(PRICE_COMPARE_PATH + '?'))
        self.assertIn('source=price-alert', url)
        self.assertIn('metal=gold', url)
        self.assertIn('purity=24K', url)
        self.assertIn('direction=up', url)
        self.assertIn('previous=400', url)
        self.assertIn('current=412.5', url)
        self.assertIn('pct=3.125', url)

    def test_silver_down(self):
        url = price_alert_compare_url(
            metal='silver',
            old_price=5.2,
            new_price=5.0,
            pct=-3.846,
        )
        self.assertIn('metal=silver', url)
        self.assertIn('purity=999', url)
        self.assertIn('direction=down', url)
        self.assertIn('current=5', url)

    def test_manual_prefers_gold_when_both_present(self):
        url = price_alert_compare_url(
            manual=True,
            prices={'gold': 410.0, 'silver': 5.1},
        )
        self.assertIn('source=price-alert', url)
        self.assertIn('manual=1', url)
        self.assertIn('metal=gold', url)
        self.assertIn('current=410', url)
        self.assertLessEqual(len(url), 500)
