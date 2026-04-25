"""
End-of-day: business-date-scoped per-vendor lines, Cridora hold from PlatformConfig, EodVendorLedger
rows, and PDF for closed lines (or after vendor confirms bank when payable > 0).
"""
import datetime as dt
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .eod_services import (
    business_day_window,
    compute_vendor_day_totals,
    apply_holding,
    generate_and_save_ledger_pdf,
)
from .models import EndOfDayPayout, EodVendorLedger, PlatformConfig, User


def _parse_business_date(request):
    raw = (request.data.get("business_date") or request.query_params.get("business_date") or "").strip()
    if not raw:
        return None
    try:
        y, m, d = (int(x) for x in raw[:10].split("-"))
        return dt.date(y, m, d)
    except (TypeError, ValueError):
        return "invalid"


class AdminEodPayoutView(APIView):
    """
    POST: record an EOD run for a business date (default: previous calendar day in the business timezone).
    Creates EodVendorLedger per vendor. If payable to vendor (after hold) is ~0, closes immediately
    and generates the PDF. Otherwise: pending_bank until a linked Admin→Vendor bank payout and vendor
    confirmation close the line and create the PDF.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.user_type != User.ADMIN:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        cfg = PlatformConfig.get()
        tz_name = (getattr(cfg, "eod_business_timezone", None) or "Asia/Dubai").strip() or "Asia/Dubai"
        holding = Decimal(str(cfg.eod_holding_pct or 0))
        if holding < 0 or holding > 100:
            holding = Decimal("0")

        bd = _parse_business_date(request)
        if bd == "invalid":
            return Response(
                {"detail": "Invalid business_date. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if bd is None:
            z = ZoneInfo(tz_name)
            now_local = timezone.now().astimezone(z)
            bd = now_local.date() - dt.timedelta(days=1)

        if EndOfDayPayout.objects.filter(business_date=bd).exists():
            return Response(
                {"detail": f"EOD for {bd} already exists. One run per business date."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        start, end = business_day_window(bd, tz_name)
        vendor_rows = []
        with transaction.atomic():
            run = EndOfDayPayout.objects.create(
                created_by=request.user,
                vendor_rows=[],
                business_date=bd,
                holding_pct_snapshot=holding,
                eod_business_timezone=tz_name,
            )
            total_payable = Decimal("0")
            for v in User.objects.filter(user_type=User.VENDOR).order_by("id"):
                buy_d, sell_d, net = compute_vendor_day_totals(v, start, end)
                held, payable = apply_holding(net, holding)
                vname = (v.vendor_company or v.email or "").strip() or f"Vendor #{v.id}"
                leg = EodVendorLedger(
                    eod=run,
                    vendor=v,
                    buy_revenue_aed=buy_d,
                    sell_deductions_aed=sell_d,
                    net_before_hold_aed=net,
                    held_aed=held,
                    payable_to_vendor_aed=payable,
                )
                if payable > Decimal("0.005"):
                    leg.status = EodVendorLedger.PENDING_BANK
                else:
                    leg.status = EodVendorLedger.CLOSED
                leg.save()
                if leg.status == EodVendorLedger.CLOSED:
                    generate_and_save_ledger_pdf(leg)
                if payable > 0:
                    total_payable += payable
                vendor_rows.append(
                    {
                        "ledger_id": leg.id,
                        "vendor_id": v.id,
                        "vendor_name": vname,
                        "buy_revenue_aed": float(buy_d),
                        "sell_deductions_aed": float(sell_d),
                        "net_before_hold_aed": float(net),
                        "held_aed": float(held),
                        "payable_to_vendor_aed": float(payable),
                        "net_to_vendor_aed": float(net),
                        "ledger_status": leg.status,
                    }
                )
            run.vendor_rows = vendor_rows
            run.save(update_fields=["vendor_rows"])
        return Response(
            {
                "id": run.id,
                "business_date": str(bd),
                "created_at": str(run.created_at)[:19].replace("T", " "),
                "eod_business_timezone": tz_name,
                "holding_pct": float(holding),
                "vendor_rows": vendor_rows,
                "total_net_payable_aed": float(total_payable.quantize(Decimal("0.01"))),
            },
            status=status.HTTP_201_CREATED,
        )
