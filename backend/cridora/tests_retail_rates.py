from django.test import SimpleTestCase

from cridora.retail_rates import (
    parse_dubai_city_of_gold_html,
    parse_malabar_html,
    parse_mint_jewels_html,
)


class RetailRateParseTests(SimpleTestCase):
    def test_parse_mint_jewels_board(self):
        html = """
        <li><p>Gold 24K</p><p>AED 530.75</p></li>
        <li><p>Gold 22K</p><p>AED 491.50</p></li>
        <li><p>Gold 21K</p><p>AED 471.25</p></li>
        <li><p>Gold 18K</p><p>AED 404.00</p></li>
        <li><p>Silver 999</p><p>AED 7.81</p></li>
        <li><p>Silver 925</p><p>AED 7.2243</p></li>
        """
        gold, silver = parse_mint_jewels_html(html)
        self.assertEqual(gold["24K"], 530.75)
        self.assertEqual(gold["22K"], 491.50)
        self.assertEqual(silver["999"], 7.81)

    def test_parse_dubai_city_of_gold_widgets(self):
        html = """
        <span class="sortd-gold-type">24K Gold</span>
        <span class="sortd-gold-value">AED 530.75</span>
        <span class="sortd-gold-type">22K Gold</span>
        <span class="sortd-gold-value">AED 491.50</span>
        """
        gold, silver = parse_dubai_city_of_gold_html(html)
        self.assertEqual(gold["24K"], 530.75)
        self.assertEqual(gold["22K"], 491.50)
        self.assertEqual(silver, {})

    def test_parse_malabar_table(self):
        html = """
        <td>24 KT(999) - </td><td>AED  530.7554/g</td>
        <td>22 KT(916) - </td><td>AED  491.4864/g</td>
        <td>18 KT(750) - </td><td>AED  403.9936/g</td>
        """
        gold, _ = parse_malabar_html(html)
        self.assertEqual(gold["24K"], 530.76)  # round(..., 2)
        self.assertEqual(gold["22K"], 491.49)
        self.assertEqual(gold["18K"], 403.99)
