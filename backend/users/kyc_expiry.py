"""
Document-expiry reporting and the insured-stock capacity cap.

Kept isolated from views.py/compliance.py per docs/AI_SAFE_DEVELOPMENT_RULES.md —
this is new, self-contained behavior (expiry prompts + insurance-backed stock cap),
not a change to an existing flow.
"""
from datetime import timedelta

from django.utils import timezone

from .models import CatalogProduct, KYCDocument


def _doc_owner_label(user):
    return user.vendor_company or f"{user.first_name} {user.last_name}".strip() or user.email


def expiring_documents_report(within_days=None):
    """
    Site-wide view (admin) of every verified document with an expiry_date inside the
    warning window, plus already-expired ones. Includes how much AED coverage is
    expiring for insurance certificates, since a lapsed policy directly shrinks the
    dealer's allowed stock cap.
    """
    window_days = within_days if within_days is not None else KYCDocument.EXPIRY_WARNING_DAYS
    today = timezone.localdate()
    cutoff = today + timedelta(days=window_days)

    docs = (
        KYCDocument.objects
        .filter(
            expiry_date__isnull=False,
            expiry_date__lte=cutoff,
            status=KYCDocument.DOC_VERIFIED,
        )
        .select_related('user')
        .order_by('expiry_date')
    )

    items = []
    total_insured_value_expiring_aed = 0.0
    expired_count = 0
    for doc in docs:
        days_left = (doc.expiry_date - today).days
        is_expired = days_left < 0
        if is_expired:
            expired_count += 1
        if doc.doc_type == KYCDocument.INSURANCE_CERTIFICATE and doc.declared_value_aed:
            total_insured_value_expiring_aed += float(doc.declared_value_aed)
        items.append({
            'doc_id': doc.id,
            'user_id': doc.user_id,
            'user_name': _doc_owner_label(doc.user),
            'user_email': doc.user.email,
            'user_type': doc.user.user_type,
            'doc_type': doc.doc_type,
            'label': KYCDocument.DOC_TYPE_LABELS.get(doc.doc_type, doc.doc_type),
            'expiry_date': str(doc.expiry_date),
            'days_left': days_left,
            'is_expired': is_expired,
            'declared_value_aed': float(doc.declared_value_aed) if doc.declared_value_aed is not None else None,
        })

    return {
        'window_days': window_days,
        'items': items,
        'summary': {
            'total_expiring': len(items),
            'already_expired': expired_count,
            'insured_value_expiring_aed': round(total_insured_value_expiring_aed, 2),
        },
    }


def vendor_insured_capacity(vendor):
    """Latest verified, unexpired Insurance Certificate's declared coverage (AED), or None."""
    doc = (
        KYCDocument.objects
        .filter(
            user=vendor,
            doc_type=KYCDocument.INSURANCE_CERTIFICATE,
            status=KYCDocument.DOC_VERIFIED,
        )
        .order_by('-reviewed_at')
        .first()
    )
    if not doc or doc.is_expired or doc.declared_value_aed is None:
        return None
    return float(doc.declared_value_aed)


def vendor_inventory_value_aed(vendor, exclude_product_id=None):
    """Current stocked catalog value (weight × qty × effective sell rate) for a vendor."""
    qs = CatalogProduct.objects.filter(vendor=vendor)
    if exclude_product_id:
        qs = qs.exclude(id=exclude_product_id)
    total = 0.0
    for p in qs:
        total += float(p.weight_grams) * float(p.stock_qty) * float(p.effective_rate() or 0)
    return total


def vendor_capacity_check(vendor, additional_value_aed=0.0, exclude_product_id=None):
    """
    A dealer may only hold/sell as much stock value as his verified insurance covers.
    No verified, unexpired insurance certificate on file → capacity is 0.
    """
    capacity = vendor_insured_capacity(vendor)
    current = vendor_inventory_value_aed(vendor, exclude_product_id=exclude_product_id)
    projected = current + float(additional_value_aed)

    if capacity is None:
        return {
            'insured_capacity_aed': 0.0,
            'current_inventory_value_aed': round(current, 2),
            'projected_value_aed': round(projected, 2),
            'remaining_capacity_aed': 0.0,
            'over_capacity': projected > 0.01,
            'message': (
                'No verified, unexpired Insurance Certificate on file. Upload one with its '
                'declared coverage amount and get it admin-verified before stocking inventory.'
            ),
        }

    remaining = capacity - projected
    over = remaining < -0.01
    return {
        'insured_capacity_aed': round(capacity, 2),
        'current_inventory_value_aed': round(current, 2),
        'projected_value_aed': round(projected, 2),
        'remaining_capacity_aed': round(remaining, 2),
        'over_capacity': over,
        'message': (
            f'This would bring stocked inventory to AED {projected:,.2f}, exceeding your '
            f'insured coverage of AED {capacity:,.2f}.'
        ) if over else '',
    }
