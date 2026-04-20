from django.db import models


class Vendor(models.Model):
    name = models.CharField(max_length=200)
    is_verified = models.BooleanField(default=False)
    country = models.CharField(max_length=100, default='UAE')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class MetalListing(models.Model):
    METAL_CHOICES = [
        ('gold', 'Gold'),
        ('silver', 'Silver'),
        ('platinum', 'Platinum'),
    ]

    vendor = models.ForeignKey(Vendor, on_delete=models.CASCADE, related_name='listings')
    name = models.CharField(max_length=200)
    short_desc = models.TextField()
    metal = models.CharField(max_length=20, choices=METAL_CHOICES)
    image_url = models.URLField(blank=True)
    rate_per_gram = models.DecimalField(max_digits=12, decimal_places=4)
    total_grams = models.DecimalField(max_digits=10, decimal_places=2)
    vat_included = models.BooleanField(default=False)
    buyback_per_gram = models.DecimalField(max_digits=12, decimal_places=4)
    in_stock = models.BooleanField(default=True)
    badge = models.CharField(max_length=50, blank=True)
    rating = models.DecimalField(max_digits=3, decimal_places=1, default=0)
    review_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} — {self.vendor.name}"

    @property
    def total_price(self):
        return float(self.rate_per_gram) * float(self.total_grams)
