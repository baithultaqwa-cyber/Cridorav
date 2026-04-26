"""
Period aggregates for admin and vendor: buys, sells, bank flows, platform fee inflow.
"""
import datetime as dt
from decimal import Decimal
from typing import Optional, Tuple
from zoneinfo import ZoneInfo

from django.db.models import Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    AdminVendorPayout,
    Order,
    PlatformConfig,
    SellOrder,
    User,
    VendorToAdminRepayment,
)


def _parse_date(s) -> Optional[dt.date]:
    if not s or not str(s).strip():
        return None
    try:
        y, m, d = (int(x) for x in str(s).strip()[:10].split("-"))
        return dt.date(y, m, d)
    except (TypeError, ValueError):
        return None


def _range_from_preset(
    preset: str, tz_name: str
) -> Tuple[dt.datetime, dt.datetime, str]:
    """
    Inclusive start, exclusive end, both timezone-aware UTC.
    preset: day | week | month
    """
    z = ZoneInfo(tz_name)
    now_local = timezone.now().astimezone(z)
    today = now_local.date()
    p = (preset or "day").strip().lower()
    if p == "week":
        start_d = today - dt.timedelta(days=6)
    elif p == "month":
        start_d = today.replace(day=1)
    else:
        start_d = today
    start_l = dt.datetime.combine(start_d, dt.time.min, tzinfo=z)
    if p in ("day",) and start_d == today:
        end_l = now_local
    else:
        end_l = now_local
    if end_l < start_l:
        end_l = start_l
    start_utc = start_l.astimezone(dt.timezone.utc)
    end_utc = end_l.astimezone(dt.timezone.utc)
    if end_utc <= start_utc:
        end_utc = start_utc + dt.timedelta(seconds=1)
    return start_utc, end_utc, p


def _range_from_query(request) -> Tuple[dt.datetime, dt.datetime, str]:
    cfg = PlatformConfig.get()
    tz_name = (getattr(cfg, "eod_business_timezone", None) or "Asia/Dubai").strip() or "Asia/Dubai"
    f = _parse_date(request.query_params.get("from"))
    t = _parse_date(request.query_params.get("to"))
    preset = (request.query_params.get("preset") or "day").strip()
    if f and t:
        z = ZoneInfo(tz_name)
        start_l = dt.datetime.combine(f, dt.time.min, tzinfo=z)
        end_l = dt.datetime.combine(t + dt.timedelta(days=1), dt.time.min, tzinfo=z)
        return (
            start_l.astimezone(dt.timezone.utc),
            end_l.astimezone(dt.timezone.utc),
            "custom",
        )
    return (*_range_from_preset(preset, tz_name)[:2], preset)


def _round2(x) -> float:
    return float(Decimal(str(x or 0)).quantize(Decimal("0.01")))


def _build_summary(start, end, vendor_filter) -> dict:
    """vendor_filter: None (all) or User instance for one vendor."""
    oq = Order.objects.filter(status=Order.PAID, created_at__gte=start, created_at__lt=end)
    if vendor_filter is not None:
        oq = oq.filter(product__vendor=vendor_filter)
    buy_rows = oq.select_related("product", "product__vendor")
    buy_gross = sum(float(x.total_aed) for x in buy_rows)
    buy_fees = sum(float(x.platform_fee_aed) for x in buy_rows)
    buy_vendor = sum(
        float(x.total_aed) - float(x.platform_fee_aed) for x in buy_rows
    )
    buy_n = oq.count()

    sq = SellOrder.objects.filter(
        status=SellOrder.COMPLETED,
        updated_at__gte=start,
        updated_at__lt=end,
    )
    if vendor_filter is not None:
        sq = sq.filter(buy_order__product__vendor=vendor_filter)
    sell_list = list(sq.select_related("buy_order__product", "customer"))
    sell_gross = sum(float(s.gross_aed) for s in sell_list)
    sell_cridora = sum(float(s.cridora_share_aed) for s in sell_list)
    sell_net_cust = sum(float(s.net_payout_aed) for s in sell_list)
    sell_n = len(sell_list)

    pq = AdminVendorPayout.objects.filter(created_at__gte=start, created_at__lt=end)
    if vendor_filter is not None:
        pq = pq.filter(vendor=vendor_filter)
    pay_out = sum(float(p.amount_aed) for p in pq)
    pay_out_pending = sum(
        float(p.amount_aed) for p in pq if p.status == AdminVendorPayout.PENDING
    )
    pay_n = pq.count()

    rq = VendorToAdminRepayment.objects.filter(created_at__gte=start, created_at__lt=end)
    if vendor_filter is not None:
        rq = rq.filter(vendor=vendor_filter)
    rep_in = sum(
        float(r.amount_aed) for r in rq if r.status == VendorToAdminRepayment.CONFIRMED
    )
    rep_n = rq.filter(status=VendorToAdminRepayment.CONFIRMED).count()

    platform_fee_in = _round2(buy_fees) + _round2(sell_cridora)
    # Rough net: fees accrued minus what left to vendors in period + repayments in
    net_stripe_proxy = _round2(platform_fee_in) - _round2(pay_out) + _round2(rep_in)

    return {
        "buys": {
            "count": buy_n,
            "gross_aed": _round2(buy_gross),
            "platform_fees_aed": _round2(buy_fees),
            "vendor_share_aed": _round2(buy_vendor),
        },
        "sells": {
            "completed_count": sell_n,
            "gross_buyback_aed": _round2(sell_gross),
            "cridora_share_aed": _round2(sell_cridora),
            "net_to_customer_aed": _round2(sell_net_cust),
        },
        "bank": {
            "to_vendors_recorded_aed": _round2(pay_out),
            "to_vendors_pending_aed": _round2(pay_out_pending),
            "to_vendors_payouts_count": pay_n,
            "from_vendors_confirmed_aed": _round2(rep_in),
            "from_vendors_repayments_count": rep_n,
        },
        "platform": {
            "fee_and_sell_share_inflow_aed": platform_fee_in,
            "period_cash_net_estimate_aed": net_stripe_proxy,
        },
    }


class AdminTreasurySummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.ADMIN or not request.user.is_authenticated:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        start, end, preset = _range_from_query(request)
        cfg = PlatformConfig.get()
        tz_name = (getattr(cfg, "eod_business_timezone", None) or "Asia/Dubai").strip() or "Asia/Dubai"
        z = ZoneInfo(tz_name)
        summary = _build_summary(start, end, None)
        return Response(
            {
                "period": {
                    "from": start.astimezone(z).date().isoformat() if start else None,
                    "to": (end - dt.timedelta(microseconds=1)).astimezone(z).date().isoformat() if end else None,
                    "from_inclusive_utc": start.isoformat() if start else None,
                    "to_exclusive_utc": end.isoformat() if end else None,
                    "preset": preset,
                    "business_timezone": tz_name,
                },
                **summary,
            }
        )


class VendorTreasurySummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.VENDOR or not request.user.is_authenticated:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        start, end, preset = _range_from_query(request)
        cfg = PlatformConfig.get()
        tz_name = (getattr(cfg, "eod_business_timezone", None) or "Asia/Dubai").strip() or "Asia/Dubai"
        summary = _build_summary(start, end, request.user)
        z = ZoneInfo(tz_name)
        pending = AdminVendorPayout.objects.filter(
            vendor=request.user, status=AdminVendorPayout.PENDING
        ).aggregate(s=Sum("amount_aed"))
        raw = pending.get("s")
        pending_sum = _round2(float(raw) if raw is not None else 0.0)
        return Response(
            {
                "period": {
                    "from": start.astimezone(z).date().isoformat() if start else None,
                    "to": (end - dt.timedelta(microseconds=1)).astimezone(z).date().isoformat() if end else None,
                    "from_inclusive_utc": start.isoformat() if start else None,
                    "to_exclusive_utc": end.isoformat() if end else None,
                    "preset": preset,
                    "business_timezone": tz_name,
                },
                "pending_bank_from_cridora_aed": pending_sum,
                **summary,
            }
        )


def _build_transaction_list(start, end, vendor_filter=None):
    """
    Returns chronological (newest first) list of all transaction types in the period:
    BUY orders, SELL (buyback) orders, Cridora→vendor payouts, vendor→Cridora repayments.
    vendor_filter: None for admin (all), or User instance for one vendor.
    """
    rows = []

    oq = Order.objects.filter(status=Order.PAID, created_at__gte=start, created_at__lt=end)
    if vendor_filter is not None:
        oq = oq.filter(product__vendor=vendor_filter)
    for o in oq.select_related("customer", "product", "product__vendor").order_by("-created_at")[:200]:
        vendor_obj = o.product.vendor if o.product else None
        rows.append({
            "id": getattr(o, "order_ref", f"#{o.id}"),
            "type": "BUY",
            "date": str(o.created_at)[:19].replace("T", " "),
            "customer": o.customer.email if o.customer else "",
            "vendor": (vendor_obj.vendor_company or vendor_obj.email) if vendor_obj else "",
            "product": o.product.name if o.product else "",
            "amount_aed": float(o.total_aed),
            "platform_fee_aed": float(o.platform_fee_aed),
            "vendor_share_aed": float(o.total_aed) - float(o.platform_fee_aed),
            "net_aed": float(o.total_aed) - float(o.platform_fee_aed),
            "stripe_payment_id": o.stripe_payment_intent_id or o.stripe_checkout_session_id or "",
            "status": "Completed",
        })

    sq = SellOrder.objects.filter(
        status=SellOrder.COMPLETED, updated_at__gte=start, updated_at__lt=end
    )
    if vendor_filter is not None:
        sq = sq.filter(buy_order__product__vendor=vendor_filter)
    for s in sq.select_related(
        "customer", "buy_order__product", "buy_order__product__vendor"
    ).order_by("-updated_at")[:200]:
        vendor_obj = (
            s.buy_order.product.vendor
            if s.buy_order and s.buy_order.product
            else None
        )
        rows.append({
            "id": getattr(s, "order_ref", f"SB-{s.id}"),
            "type": "SELL",
            "date": str(s.updated_at)[:19].replace("T", " "),
            "customer": s.customer.email if s.customer else "",
            "vendor": (vendor_obj.vendor_company or vendor_obj.email) if vendor_obj else "",
            "product": s.buy_order.product.name if s.buy_order and s.buy_order.product else "",
            "amount_aed": float(s.gross_aed),
            "net_payout_aed": float(s.net_payout_aed),
            "cridora_share_aed": float(s.cridora_share_aed),
            "net_aed": -float(s.net_payout_aed),
            "status": "Completed",
        })

    pq = AdminVendorPayout.objects.filter(created_at__gte=start, created_at__lt=end)
    if vendor_filter is not None:
        pq = pq.filter(vendor=vendor_filter)
    for p in pq.select_related("vendor").order_by("-created_at")[:100]:
        rows.append({
            "id": f"PAY-{p.id:04d}",
            "type": "PAYOUT",
            "date": str(p.created_at)[:19].replace("T", " "),
            "vendor": p.vendor.vendor_company or p.vendor.email,
            "amount_aed": float(p.amount_aed),
            "net_aed": -float(p.amount_aed),
            "status": p.get_status_display(),
        })

    rq = VendorToAdminRepayment.objects.filter(created_at__gte=start, created_at__lt=end)
    if vendor_filter is not None:
        rq = rq.filter(vendor=vendor_filter)
    for r in rq.select_related("vendor").order_by("-created_at")[:100]:
        rows.append({
            "id": f"REP-{r.id:04d}",
            "type": "REPAYMENT",
            "date": str(r.created_at)[:19].replace("T", " "),
            "vendor": r.vendor.vendor_company or r.vendor.email,
            "amount_aed": float(r.amount_aed),
            "net_aed": float(r.amount_aed),
            "status": r.get_status_display(),
        })

    rows.sort(key=lambda x: x["date"], reverse=True)
    return rows


class AdminTransactionListView(APIView):
    """
    GET: All transactions in a period (BUY, SELL, PAYOUT, REPAYMENT) + period summary.
    Supports ?preset=day|week|month and ?from=YYYY-MM-DD&to=YYYY-MM-DD.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.ADMIN:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        start, end, preset = _range_from_query(request)
        cfg = PlatformConfig.get()
        tz_name = (getattr(cfg, "eod_business_timezone", None) or "Asia/Dubai").strip() or "Asia/Dubai"
        z = ZoneInfo(tz_name)
        summary = _build_summary(start, end, None)
        transactions = _build_transaction_list(start, end)
        return Response({
            "period": {
                "from": start.astimezone(z).date().isoformat(),
                "to": (end - dt.timedelta(microseconds=1)).astimezone(z).date().isoformat(),
                "from_inclusive_utc": start.isoformat(),
                "to_exclusive_utc": end.isoformat(),
                "preset": preset,
                "business_timezone": tz_name,
            },
            **summary,
            "transactions": transactions,
        })


class VendorTransactionListView(APIView):
    """
    GET: Vendor's transactions in a period (BUY, SELL, PAYOUT, REPAYMENT) + period summary.
    Supports ?preset=day|week|month and ?from=YYYY-MM-DD&to=YYYY-MM-DD.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.VENDOR:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        start, end, preset = _range_from_query(request)
        cfg = PlatformConfig.get()
        tz_name = (getattr(cfg, "eod_business_timezone", None) or "Asia/Dubai").strip() or "Asia/Dubai"
        z = ZoneInfo(tz_name)
        summary = _build_summary(start, end, request.user)
        transactions = _build_transaction_list(start, end, vendor_filter=request.user)
        pending = AdminVendorPayout.objects.filter(
            vendor=request.user, status=AdminVendorPayout.PENDING
        ).aggregate(s=Sum("amount_aed"))
        raw = pending.get("s")
        pending_sum = _round2(float(raw) if raw is not None else 0.0)
        return Response({
            "period": {
                "from": start.astimezone(z).date().isoformat(),
                "to": (end - dt.timedelta(microseconds=1)).astimezone(z).date().isoformat(),
                "from_inclusive_utc": start.isoformat(),
                "to_exclusive_utc": end.isoformat(),
                "preset": preset,
                "business_timezone": tz_name,
            },
            "pending_bank_from_cridora_aed": pending_sum,
            **summary,
            "transactions": transactions,
        })
