"""Stock reservation / unit restore helpers."""
from decimal import Decimal

from django.test import SimpleTestCase

from users.inventory import units_from_grams


class UnitsFromGramsTests(SimpleTestCase):
    def test_exact_units(self):
        self.assertEqual(units_from_grams(qty_grams='100.0000', weight_grams='10'), 10)

    def test_partial_does_not_invent_unit(self):
        # Old bug: max(1, round(qty/weight)) returned 1 for tiny leftovers
        self.assertEqual(units_from_grams(qty_grams='0.5000', weight_grams='10'), 0)

    def test_no_float_rounding_up(self):
        self.assertEqual(units_from_grams(qty_grams='29.9999', weight_grams='10'), 2)
