from django.conf import settings
from django.db import models


class VendorKycAccess(models.Model):
    """Admin on/off switch: which vendors may manually verify customers."""

    vendor = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='manual_kyc_access',
        limit_choices_to={'user_type': 'vendor'},
    )
    enabled = models.BooleanField(default=False)
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='manual_kyc_grants',
    )
    granted_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default='')
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Vendor KYC access'
        verbose_name_plural = 'Vendor KYC access'

    def __str__(self):
        state = 'on' if self.enabled else 'off'
        return f'Manual KYC {state} for vendor {self.vendor_id}'


class VendorCustomerVerification(models.Model):
    """Per-vendor record that a specific customer was manually verified (or not)."""

    PENDING = 'pending'
    VERIFIED = 'verified'
    REJECTED = 'rejected'
    STATUS_CHOICES = (
        (PENDING, 'Pending'),
        (VERIFIED, 'Verified'),
        (REJECTED, 'Rejected'),
    )

    vendor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='customer_verifications',
        limit_choices_to={'user_type': 'vendor'},
    )
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='vendor_verifications',
        limit_choices_to={'user_type': 'customer'},
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=PENDING)
    requested_at = models.DateTimeField(auto_now_add=True)
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='vendor_kyc_decisions',
    )
    decided_at = models.DateTimeField(null=True, blank=True)
    reason = models.TextField(blank=True, default='')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['vendor', 'customer'],
                name='uniq_vendor_customer_verification',
            ),
        ]
        indexes = [
            models.Index(fields=['vendor', 'status']),
            models.Index(fields=['customer', 'status']),
        ]
        ordering = ['-updated_at']

    def __str__(self):
        return f'Vendor {self.vendor_id} → customer {self.customer_id}: {self.status}'


class VendorKycAuditLog(models.Model):
    """Append-only audit trail for manual vendor KYC actions."""

    ACCESS_GRANTED = 'access_granted'
    ACCESS_REVOKED = 'access_revoked'
    VERIFICATION_REQUESTED = 'verification_requested'
    VERIFIED = 'verified'
    REJECTED = 'rejected'
    REVERTED = 'reverted'
    ACTION_CHOICES = (
        (ACCESS_GRANTED, 'Access granted'),
        (ACCESS_REVOKED, 'Access revoked'),
        (VERIFICATION_REQUESTED, 'Verification requested'),
        (VERIFIED, 'Verified'),
        (REJECTED, 'Rejected'),
        (REVERTED, 'Reverted'),
    )

    vendor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='vendor_kyc_audit_as_vendor',
        limit_choices_to={'user_type': 'vendor'},
    )
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='vendor_kyc_audit_as_customer',
        limit_choices_to={'user_type': 'customer'},
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='vendor_kyc_audit_actions',
    )
    action = models.CharField(max_length=40, choices=ACTION_CHOICES)
    previous_status = models.CharField(max_length=20, blank=True, default='')
    new_status = models.CharField(max_length=20, blank=True, default='')
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['vendor', '-created_at']),
            models.Index(fields=['customer', '-created_at']),
        ]

    def __str__(self):
        return f'{self.action} vendor={self.vendor_id} at {self.created_at}'
