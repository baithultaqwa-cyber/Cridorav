from django.db import models
from django.contrib.auth.models import AbstractUser

from cridora.catalog_storage import get_catalog_media_storage


class User(AbstractUser):
    ADMIN = 'admin'
    VENDOR = 'vendor'
    CUSTOMER = 'customer'

    USER_TYPE_CHOICES = [
        (ADMIN, 'Cridora Admin'),
        (VENDOR, 'Bullion Vendor'),
        (CUSTOMER, 'Customer'),
    ]

    KYC_PENDING = 'pending'
    KYC_VERIFIED = 'verified'
    KYC_REJECTED = 'rejected'

    KYC_STATUS_CHOICES = [
        (KYC_PENDING, 'Pending'),
        (KYC_VERIFIED, 'Verified'),
        (KYC_REJECTED, 'Rejected'),
    ]

    user_type = models.CharField(max_length=20, choices=USER_TYPE_CHOICES, default=CUSTOMER)
    phone = models.CharField(max_length=20, blank=True)
    country = models.CharField(max_length=100, blank=True)
    vendor_company = models.CharField(max_length=200, blank=True)
    kyc_status = models.CharField(max_length=20, choices=KYC_STATUS_CHOICES, default=KYC_PENDING)
    kyc_submitted_at = models.DateTimeField(null=True, blank=True)
    kyc_verified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def __str__(self):
        return self.email or self.username

    @property
    def is_kyc_verified(self):
        return self.kyc_status == self.KYC_VERIFIED

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.username


class VendorPricingConfig(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='pricing_config',
        limit_choices_to={'user_type': 'vendor'},
    )
    gold_rate = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    silver_rate = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    platinum_rate = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    palladium_rate = models.DecimalField(max_digits=10, decimal_places=4, default=0)

    # How many AED per gram the vendor deducts from the sell rate when buying back
    gold_buyback_deduction = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    silver_buyback_deduction = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    platinum_buyback_deduction = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    palladium_buyback_deduction = models.DecimalField(max_digits=10, decimal_places=4, default=0)

    feed_url = models.URLField(blank=True)
    feed_enabled = models.BooleanField(default=False)
    feed_auth_header = models.CharField(max_length=100, blank=True)
    feed_auth_value = models.CharField(max_length=500, blank=True)
    feed_gold_field = models.CharField(max_length=100, blank=True)
    feed_silver_field = models.CharField(max_length=100, blank=True)
    feed_platinum_field = models.CharField(max_length=100, blank=True)
    feed_palladium_field = models.CharField(max_length=100, blank=True)
    feed_last_fetched = models.DateTimeField(null=True, blank=True)
    feed_last_error = models.TextField(blank=True)

    # Gold / silver live rate from the same global spot feed as the home page ticker (no display margin).
    use_home_spot_gold = models.BooleanField(default=False)
    use_home_spot_silver = models.BooleanField(default=False)

    # Allowed purity / karat labels for catalog (gold and silver); used for dropdowns and spot tier matching.
    gold_purity_options = models.JSONField(default=list, blank=True)
    silver_purity_options = models.JSONField(default=list, blank=True)

    # Per-purity AED/gram (sell) and buyback; keys match catalog purity strings. Falls back to spot/legacy if unset.
    gold_gram_rates_by_purity = models.JSONField(default=dict, blank=True)
    silver_gram_rates_by_purity = models.JSONField(default=dict, blank=True)
    platinum_gram_rates_by_purity = models.JSONField(default=dict, blank=True)
    palladium_gram_rates_by_purity = models.JSONField(default=dict, blank=True)
    gold_gram_buybacks_by_purity = models.JSONField(default=dict, blank=True)
    silver_gram_buybacks_by_purity = models.JSONField(default=dict, blank=True)
    platinum_gram_buybacks_by_purity = models.JSONField(default=dict, blank=True)
    palladium_gram_buybacks_by_purity = models.JSONField(default=dict, blank=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Vendor Pricing Config'

    def __str__(self):
        return f"Pricing for {self.user.email}"


class CatalogProduct(models.Model):
    METAL_CHOICES = [
        ('gold', 'Gold'),
        ('silver', 'Silver'),
        ('platinum', 'Platinum'),
        ('palladium', 'Palladium'),
    ]

    vendor = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='catalog_products',
        limit_choices_to={'user_type': 'vendor'},
    )
    name = models.CharField(max_length=200)
    metal = models.CharField(max_length=20, choices=METAL_CHOICES, default='gold')
    weight_grams = models.DecimalField(max_digits=10, decimal_places=4)
    purity = models.CharField(max_length=20, default='999.9')

    use_live_rate = models.BooleanField(default=True)
    manual_rate_per_gram = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    buyback_per_gram = models.DecimalField(max_digits=10, decimal_places=4, default=0)

    packaging_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    storage_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    insurance_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    vat_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    vat_inclusive = models.BooleanField(default=False)

    image = models.ImageField(
        upload_to='catalog_images/%Y/%m/',
        storage=get_catalog_media_storage,
        null=True,
        blank=True,
    )

    in_stock = models.BooleanField(default=True)
    visible = models.BooleanField(default=True)
    stock_qty = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['metal', 'weight_grams']

    def __str__(self):
        return f"{self.vendor.vendor_company} — {self.name}"

    def effective_rate(self):
        if self.use_live_rate:
            try:
                cfg = self.vendor.pricing_config
            except VendorPricingConfig.DoesNotExist:
                return 0
            from cridora.purity_pricing import get_metal_gram_map, resolve_gram_sell_per_gram
            m = get_metal_gram_map(cfg, self.metal)
            per = resolve_gram_sell_per_gram(m, self.purity)
            if per is not None and per > 0:
                return float(per)
            from cridora.spot_prices import live_effective_rate_from_home_spot
            spot = live_effective_rate_from_home_spot(self, cfg)
            if spot is not None and spot > 0:
                return float(spot)
            rate_map = {
                'gold': cfg.gold_rate,
                'silver': cfg.silver_rate,
                'platinum': cfg.platinum_rate,
                'palladium': cfg.palladium_rate,
            }
            return float(rate_map.get(self.metal, 0))
        return float(self.manual_rate_per_gram)

    def effective_buyback_per_gram(self):
        if self.use_live_rate:
            try:
                cfg = self.vendor.pricing_config
            except VendorPricingConfig.DoesNotExist:
                return 0
            from cridora.purity_pricing import get_metal_buyback_map, resolve_gram_buyback_per_gram
            sell = self.effective_rate()
            bmap = get_metal_buyback_map(cfg, self.metal)
            deduction_map = {
                'gold': cfg.gold_buyback_deduction,
                'silver': cfg.silver_buyback_deduction,
                'platinum': cfg.platinum_buyback_deduction,
                'palladium': cfg.palladium_buyback_deduction,
            }
            ded = float(deduction_map.get(self.metal, 0))
            return float(resolve_gram_buyback_per_gram(bmap, self.purity, sell, ded))
        return float(self.buyback_per_gram)

    def final_price(self):
        rate = self.effective_rate()
        weight = float(self.weight_grams)
        metal_cost = rate * weight
        fees = float(self.packaging_fee) + float(self.storage_fee) + float(self.insurance_fee)
        subtotal = metal_cost + fees
        vat_pct = float(self.vat_pct)
        if self.vat_inclusive:
            return round(subtotal, 2)
        return round(subtotal * (1 + vat_pct / 100), 2)

    def final_rate_per_gram(self):
        weight = float(self.weight_grams)
        if weight == 0:
            return 0
        return round(self.final_price() / weight, 4)


class CatalogStagingImage(models.Model):
    """Holds a catalog image on disk after upload so the vendor can confirm it loads before product submit."""
    vendor = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='catalog_staging_images',
        limit_choices_to={'user_type': 'vendor'},
    )
    image = models.ImageField(upload_to='catalog_staging/%Y/%m/', storage=get_catalog_media_storage)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class PlatformConfig(models.Model):
    """Singleton table — always access via PlatformConfig.get()."""
    buy_fee_pct              = models.DecimalField(max_digits=5, decimal_places=2, default=0.50)
    sell_fee_pct             = models.DecimalField(max_digits=5, decimal_places=2, default=0.50)
    sell_share_pct           = models.DecimalField(max_digits=5, decimal_places=2, default=5.00)
    quote_ttl_seconds        = models.PositiveIntegerField(default=60)
    vendor_accept_ttl_seconds = models.PositiveIntegerField(default=60)
    # Extra % applied to rates in the public home page spot ticker only (not to vendor home-spot alignment).
    home_spot_display_margin_pct = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    updated_at               = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Platform Configuration'

    def __str__(self):
        return f'PlatformConfig (buy={self.buy_fee_pct}%, sell={self.sell_fee_pct}%)'

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(id=1)
        return obj


class CustomerBankDetails(models.Model):
    NOT_ADDED = 'not_added'
    PENDING   = 'pending'
    VERIFIED  = 'verified'
    REJECTED  = 'rejected'

    STATUS_CHOICES = [
        (NOT_ADDED, 'Not Added'),
        (PENDING,   'Pending Review'),
        (VERIFIED,  'Verified'),
        (REJECTED,  'Rejected'),
    ]

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='bank_details',
        limit_choices_to={'user_type': 'customer'},
    )
    account_name = models.CharField(max_length=200, blank=True)
    bank_name = models.CharField(max_length=200, blank=True)
    account_number = models.CharField(max_length=100, blank=True)
    ifsc = models.CharField(max_length=50, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=NOT_ADDED)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Customer Bank Details'

    def __str__(self):
        return f"Bank for {self.user.email}"


class VendorSchedule(models.Model):
    vendor = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='schedule',
        limit_choices_to={'user_type': 'vendor'},
    )
    opening_time  = models.TimeField(null=True, blank=True)
    closing_time  = models.TimeField(null=True, blank=True)
    timezone      = models.CharField(max_length=50, default='Asia/Dubai')
    holiday_dates = models.JSONField(default=list, blank=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Vendor Schedule'

    def __str__(self):
        return f"Schedule for {self.vendor.email}"

    def is_open_now(self):
        from datetime import datetime
        try:
            from zoneinfo import ZoneInfo
            now_local = datetime.now(ZoneInfo(self.timezone or 'Asia/Dubai'))
        except Exception:
            from django.utils import timezone
            now_local = timezone.now()

        today_str = now_local.strftime('%Y-%m-%d')
        if today_str in (self.holiday_dates or []):
            return False

        if self.opening_time and self.closing_time:
            current_t = now_local.time().replace(second=0, microsecond=0)
            return self.opening_time <= current_t <= self.closing_time

        return True


class Order(models.Model):
    PENDING_VENDOR  = 'pending_vendor'
    VENDOR_ACCEPTED = 'vendor_accepted'
    PAID            = 'paid'
    REJECTED        = 'rejected'
    EXPIRED         = 'expired'

    STATUS_CHOICES = [
        (PENDING_VENDOR,  'Awaiting Vendor'),
        (VENDOR_ACCEPTED, 'Accepted – Pending Payment'),
        (PAID,            'Completed'),
        (REJECTED,        'Rejected'),
        (EXPIRED,         'Expired'),
    ]

    customer         = models.ForeignKey(User, on_delete=models.CASCADE, related_name='customer_orders',
                                          limit_choices_to={'user_type': 'customer'})
    product          = models.ForeignKey(CatalogProduct, on_delete=models.PROTECT, related_name='orders')
    qty_units        = models.PositiveIntegerField(default=1)
    qty_grams        = models.DecimalField(max_digits=10, decimal_places=4)
    rate_per_gram       = models.DecimalField(max_digits=10, decimal_places=4)
    metal_rate_per_gram = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    buyback_per_gram    = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    platform_fee_aed = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_aed        = models.DecimalField(max_digits=12, decimal_places=2)
    status           = models.CharField(max_length=20, choices=STATUS_CHOICES, default=PENDING_VENDOR)
    created_at       = models.DateTimeField(auto_now_add=True)
    expires_at       = models.DateTimeField()

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"ORD-{self.id:05d} [{self.status}]"

    @property
    def order_ref(self):
        return f"ORD-{self.id:05d}"


class KYCDocument(models.Model):
    DOC_PENDING = 'pending'
    DOC_VERIFIED = 'verified'
    DOC_REJECTED = 'rejected'

    STATUS_CHOICES = [
        (DOC_PENDING, 'Pending Review'),
        (DOC_VERIFIED, 'Verified'),
        (DOC_REJECTED, 'Rejected'),
    ]

    # Customer KYC documents
    PASSPORT = 'passport'
    PROOF_OF_ADDRESS = 'proof_of_address'
    SELFIE = 'selfie'

    # Vendor KYB documents
    TRADE_LICENSE = 'trade_license'
    COMPANY_REGISTRATION = 'company_registration'
    OWNER_ID = 'owner_id'
    BANK_PROOF = 'bank_proof'

    DOC_TYPE_LABELS = {
        PASSPORT: 'Passport / National ID',
        PROOF_OF_ADDRESS: 'Proof of Address',
        SELFIE: 'Selfie with ID',
        TRADE_LICENSE: 'Trade License',
        COMPANY_REGISTRATION: 'Company Registration Certificate',
        OWNER_ID: 'Owner / Director ID',
        BANK_PROOF: 'Bank Account Proof',
    }

    CUSTOMER_DOCS = [PASSPORT, PROOF_OF_ADDRESS, SELFIE]
    VENDOR_DOCS = [TRADE_LICENSE, COMPANY_REGISTRATION, OWNER_ID, BANK_PROOF]

    DOC_TYPE_CHOICES = [(k, v) for k, v in DOC_TYPE_LABELS.items()]

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='kyc_documents',
    )
    doc_type = models.CharField(max_length=50, choices=DOC_TYPE_CHOICES)
    file = models.FileField(upload_to='kyc_docs/%Y/%m/')
    original_filename = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=DOC_PENDING)
    rejection_reason = models.TextField(blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        User,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='reviewed_documents',
    )

    class Meta:
        unique_together = ('user', 'doc_type')
        ordering = ['doc_type']

    def __str__(self):
        return f"{self.user.email} — {self.doc_type} [{self.status}]"


class KYCDocumentSupersededSnapshot(models.Model):
    """
    When a user re-uploads after admin verified the previous file, the old file and
    review metadata are kept here so admins can compare against the new upload.
    """
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='superseded_kyc_snapshots',
    )
    doc_type = models.CharField(max_length=50, choices=KYCDocument.DOC_TYPE_CHOICES)
    file = models.FileField(upload_to='kyc_docs/superseded/%Y/%m/')
    original_filename = models.CharField(max_length=255, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='superseded_snapshots_reviewed',
    )
    superseded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-superseded_at']

    def __str__(self):
        return f"{self.user.email} — {self.doc_type} (superseded {self.superseded_at})"


class PasswordResetRequest(models.Model):
    PENDING  = 'pending'
    RESOLVED = 'resolved'

    STATUS_CHOICES = [
        (PENDING,  'Pending'),
        (RESOLVED, 'Resolved'),
    ]

    user         = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_reset_requests')
    status       = models.CharField(max_length=20, choices=STATUS_CHOICES, default=PENDING)
    created_at   = models.DateTimeField(auto_now_add=True)
    resolved_at  = models.DateTimeField(null=True, blank=True)
    resolved_by  = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='resolved_resets'
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"PwdReset for {self.user.email} [{self.status}]"


class SellOrder(models.Model):
    PENDING_VENDOR  = 'pending_vendor'
    VENDOR_ACCEPTED = 'vendor_accepted'
    ADMIN_APPROVED  = 'admin_approved'
    COMPLETED       = 'completed'
    REJECTED        = 'rejected'

    STATUS_CHOICES = [
        (PENDING_VENDOR,  'Awaiting Vendor'),
        (VENDOR_ACCEPTED, 'Payment Initiated'),
        (ADMIN_APPROVED,  'Admin Approved'),
        (COMPLETED,       'Completed'),
        (REJECTED,        'Rejected'),
    ]

    customer                = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sell_orders',
                                                 limit_choices_to={'user_type': 'customer'})
    buy_order               = models.ForeignKey(Order, on_delete=models.PROTECT, related_name='sell_orders')
    qty_grams               = models.DecimalField(max_digits=10, decimal_places=4)
    buyback_rate_per_gram   = models.DecimalField(max_digits=10, decimal_places=4)
    purchase_rate_per_gram  = models.DecimalField(max_digits=10, decimal_places=4)
    gross_aed               = models.DecimalField(max_digits=12, decimal_places=2)
    purchase_cost_aed       = models.DecimalField(max_digits=12, decimal_places=2)
    profit_aed              = models.DecimalField(max_digits=12, decimal_places=2)
    cridora_share_pct       = models.DecimalField(max_digits=5, decimal_places=2)
    cridora_share_aed       = models.DecimalField(max_digits=12, decimal_places=2)
    net_payout_aed               = models.DecimalField(max_digits=12, decimal_places=2)
    vendor_balance_used          = models.BooleanField(default=False)
    vendor_pool_balance_at_accept = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status                       = models.CharField(max_length=20, choices=STATUS_CHOICES, default=PENDING_VENDOR)
    created_at                   = models.DateTimeField(auto_now_add=True)
    updated_at                   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"SELL-{self.id:05d} [{self.status}]"

    @property
    def order_ref(self):
        return f"SELL-{self.id:05d}"
