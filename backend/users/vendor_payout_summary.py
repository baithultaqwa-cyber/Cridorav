"""
Per-vendor payout summary for admin: pending EOD ledger lines,
hold amounts, and pending payout balances.
"""
from django.db.models import Sum

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AdminVendorPayout, EodVendorLedger, User


def _ledger_to_dict(L):
    eod_id = L.eod.id if L.eod else None
    return {
        "id": L.id,
        "eod_id": eod_id,
        "business_date": str(L.eod.business_date) if L.eod and L.eod.business_date else None,
        "net_payable_aed": float(L.payable_to_vendor_aed),
        "held_aed": float(L.held_aed),
        "status": L.status,
        "has_pdf": bool(L.pdf_file and L.pdf_file.name),
    }


def _build_vendor_payout_summary():
    result = []
    for v in User.objects.filter(user_type=User.VENDOR).order_by("id"):
        pending_qs = (
            EodVendorLedger.objects.filter(vendor=v, status=EodVendorLedger.PENDING_BANK)
            .select_related("eod")
            .order_by("-eod__business_date")
        )
        awaiting_qs = (
            EodVendorLedger.objects.filter(vendor=v, status=EodVendorLedger.AWAITING_VENDOR)
            .select_related("eod")
            .order_by("-eod__business_date")
        )

        pending_ledgers = list(pending_qs)
        awaiting_ledgers = list(awaiting_qs)

        pending_payable = sum(float(L.payable_to_vendor_aed) for L in pending_ledgers)
        awaiting_payable = sum(float(L.payable_to_vendor_aed) for L in awaiting_ledgers)

        held_agg = EodVendorLedger.objects.filter(vendor=v).aggregate(s=Sum("held_aed"))
        total_held = float(held_agg["s"] or 0)

        in_flight_agg = AdminVendorPayout.objects.filter(
            vendor=v, status=AdminVendorPayout.PENDING
        ).aggregate(s=Sum("amount_aed"))
        in_flight = float(in_flight_agg["s"] or 0)

        result.append({
            "vendor_id": v.id,
            "vendor_name": v.vendor_company or v.email,
            "vendor_email": v.email,
            "payable_now_aed": round(pending_payable, 2),
            "awaiting_confirm_count": len(awaiting_ledgers),
            "total_held_aed": round(total_held, 2),
            "inflight_aed": round(in_flight, 2),
            "pending_ledgers": [_ledger_to_dict(L) for L in pending_ledgers],
        })

    return result


class AdminVendorPayoutSummaryView(APIView):
    """
    GET: Per-vendor pending EOD payables, hold totals, in-flight payouts.
    Used to populate the admin vendor payout list view.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.ADMIN:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        return Response(_build_vendor_payout_summary())
