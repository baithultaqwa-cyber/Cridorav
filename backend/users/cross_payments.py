"""
Cross-payments: custody metal at current sell reference vs sell-back payout exposure,
admin-set holding % (of custody sell value), vendor pool, daily rollups, bank movements.
Platform calendar day from PlatformConfig.
"""
import datetime as dt
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional, Tuple

from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from zoneinfo import ZoneInfo

from cridora.purity_pricing import get_from_purity_map, get_metal_buyback_map

from .models import (
    AdminVendorPayout,
    Order,
    PlatformConfig,
    SellOrder,
    User,
    VendorPricingConfig,
    VendorToAdminRepayment,
)

Q2 = Decimal("0.01")
Q4 = Decimal("0.0001")


def _dec(x) -> Decimal:
    if x is None:
        return Decimal("0")
    return Decimal(str(x))


def _round2(x: Decimal) -> Decimal:
    return _dec(x).quantize(Q2, rounding=ROUND_HALF_UP)


def platform_timezone_name() -> str:
    cfg = PlatformConfig.get()
    return (getattr(cfg, "eod_business_timezone", None) or "Asia/Dubai").strip() or "Asia/Dubai"


def platform_tz() -> ZoneInfo:
    return ZoneInfo(platform_timezone_name())


def platform_today_utc_bounds() -> Tuple[dt.datetime, dt.datetime, dt.date, str]:
    z = platform_tz()
    now_local = timezone.now().astimezone(z)
    today = now_local.date()
    start_l = dt.datetime.combine(today, dt.time.min, tzinfo=z)
    end_l = start_l + dt.timedelta(days=1)
    return (
        start_l.astimezone(dt.timezone.utc),
        end_l.astimezone(dt.timezone.utc),
        today,
        platform_timezone_name(),
    )


def _sold_grams_by_buy_vendor(vendor: User) -> Dict[int, Decimal]:
    rows = (
        SellOrder.objects.filter(
            buy_order__product__vendor=vendor,
            status=SellOrder.COMPLETED,
        )
        .values("buy_order_id")
        .annotate(s=Sum("qty_grams"))
    )
    return {r["buy_order_id"]: _dec(r["s"]) for r in rows}


def compute_vendor_cross_payment_snapshot(vendor: User) -> Dict[str, Any]:
    cfg, _ = VendorPricingConfig.objects.get_or_create(user=vendor)
    holding_pct = _dec(cfg.cridora_holding_pct)
    if holding_pct < 0:
        holding_pct = Decimal("0")
    if holding_pct > Decimal("100"):
        holding_pct = Decimal("100")

    sold_map = _sold_grams_by_buy_vendor(vendor)
    paid_orders = list(
        Order.objects.filter(product__vendor=vendor, status=Order.PAID).select_related(
            "product", "product__vendor", "customer"
        )
    )

    lifetime_buy_gross = sum((_dec(o.total_aed) for o in paid_orders), Decimal("0"))
    lifetime_platform_fees_buys = sum((_dec(o.platform_fee_aed) for o in paid_orders), Decimal("0"))
    lifetime_buy_vendor_net = sum(
        (_dec(o.total_aed) - _dec(o.platform_fee_aed) for o in paid_orders), Decimal("0")
    )

    circulation_buyback = Decimal("0")
    circulation_sell_value = Decimal("0")
    holdings_rows: List[Dict[str, Any]] = []

    for o in paid_orders:
        sold = sold_map.get(o.id, Decimal("0"))
        rem = (_dec(o.qty_grams) - sold).quantize(Q4, rounding=ROUND_HALF_UP)
        if rem <= 0:
            continue
        buyback_pg = _dec(o.product.effective_buyback_per_gram())
        sell_pg = _dec(o.product.effective_rate())
        line_buyback = (rem * buyback_pg).quantize(Q2, rounding=ROUND_HALF_UP)
        line_market = (rem * sell_pg).quantize(Q2, rounding=ROUND_HALF_UP)
        circulation_buyback += line_buyback
        circulation_sell_value += line_market
        p = o.product
        spread_pg: Optional[float] = None
        if p.use_live_rate:
            bmap = get_metal_buyback_map(cfg, p.metal)
            v_map, found = get_from_purity_map(bmap, p.purity)
            if not (found and v_map is not None):
                sxp = float(p.buyback_per_gram)
                if sxp > 0:
                    spread_pg = sxp
        holdings_rows.append(
            {
                "order_ref": o.order_ref,
                "order_id": o.id,
                "product_id": p.id,
                "product_name": p.name,
                "metal": p.metal,
                "purity": p.purity,
                "grams_remaining": float(rem),
                "effective_rate_per_gram_aed": float(sell_pg),
                "buyback_per_gram_aed": float(buyback_pg),
                "buyback_spread_per_gram_aed": spread_pg,
                "market_value_aed": float(line_market),
                "buyback_exposure_aed": float(line_buyback),
                "customer_sell_back_value_aed": float(line_buyback),
                "customer": o.customer.get_full_name() or o.customer.email,
                "customer_email": o.customer.email or "",
                "customer_id": o.customer_id,
                "product_visible": bool(p.visible),
                "product_in_stock": bool(p.in_stock),
                "use_live_rate": bool(p.use_live_rate),
            }
        )

    completed_sells = list(
        SellOrder.objects.filter(
            buy_order__product__vendor=vendor,
            status=SellOrder.COMPLETED,
        ).select_related("buy_order__product", "customer")
    )
    total_sell_customer_payout = Decimal("0")
    total_cridora_share_sells = Decimal("0")
    for s in completed_sells:
        total_sell_customer_payout += _dec(s.net_payout_aed)
        total_cridora_share_sells += _dec(s.cridora_share_aed)

    circulation_buyback = _round2(circulation_buyback)
    circulation_sell_value = _round2(circulation_sell_value)
    holding_target_aed = _round2(circulation_sell_value * holding_pct / Decimal("100"))
    vendor_pool_aed = _round2(lifetime_buy_vendor_net - total_sell_customer_payout)
    cridora_share_total = _round2(lifetime_platform_fees_buys + total_cridora_share_sells)

    pool_vs_hold_headroom = _round2(vendor_pool_aed - holding_target_aed)

    start_u, end_u, biz_today, tz_label = platform_today_utc_bounds()
    payout_today = AdminVendorPayout.objects.filter(
        vendor=vendor,
        created_at__gte=start_u,
        created_at__lt=end_u,
    ).exclude(status=AdminVendorPayout.CANCELLED)

    return {
        "vendor_id": vendor.id,
        "vendor_name": vendor.vendor_company or vendor.email,
        "platform_business_timezone": tz_label,
        "platform_business_today": str(biz_today),
        "cridora_holding_pct": float(holding_pct),
        "circulation_sell_value_aed": float(circulation_sell_value),
        "circulation_buyback_aed": float(circulation_buyback),
        "holding_target_aed": float(holding_target_aed),
        "total_buy_gross_aed": float(_round2(lifetime_buy_gross)),
        "total_buy_vendor_net_aed": float(_round2(lifetime_buy_vendor_net)),
        "platform_fees_on_buys_aed": float(_round2(lifetime_platform_fees_buys)),
        "total_sellback_customer_payout_aed": float(_round2(total_sell_customer_payout)),
        "cridora_share_on_sellbacks_aed": float(_round2(total_cridora_share_sells)),
        "cridora_share_total_aed": float(cridora_share_total),
        "vendor_pool_aed": float(vendor_pool_aed),
        "pool_minus_holding_target_aed": float(pool_vs_hold_headroom),
        "holdings_for_verification": sorted(
            holdings_rows,
            key=lambda r: (r["metal"], r["purity"], r["product_name"]),
        ),
        "payouts_today_non_cancelled": payout_today.count(),
        "has_payout_today": payout_today.exists(),
    }


def daily_rollup_vendor(vendor: User, days: int = 14) -> List[Dict[str, Any]]:
    z = platform_tz()
    now_local = timezone.now().astimezone(z)
    end_d = now_local.date()
    start_d = end_d - dt.timedelta(days=max(1, min(days, 90)) - 1)
    out: List[Dict[str, Any]] = []
    d = start_d
    while d <= end_d:
        start_l = dt.datetime.combine(d, dt.time.min, tzinfo=z)
        end_l = start_l + dt.timedelta(days=1)
        su = start_l.astimezone(dt.timezone.utc)
        eu = end_l.astimezone(dt.timezone.utc)

        buys = Order.objects.filter(
            product__vendor=vendor,
            status=Order.PAID,
            created_at__gte=su,
            created_at__lt=eu,
        )
        buy_n = 0
        buy_vendor_net = Decimal("0")
        buy_fees = Decimal("0")
        for o in buys:
            buy_n += 1
            buy_vendor_net += _dec(o.total_aed) - _dec(o.platform_fee_aed)
            buy_fees += _dec(o.platform_fee_aed)

        sells = SellOrder.objects.filter(
            buy_order__product__vendor=vendor,
            status=SellOrder.COMPLETED,
            updated_at__gte=su,
            updated_at__lt=eu,
        )
        sell_n = 0
        sell_cust = Decimal("0")
        sell_cridora = Decimal("0")
        for s in sells:
            sell_n += 1
            sell_cust += _dec(s.net_payout_aed)
            sell_cridora += _dec(s.cridora_share_aed)

        out.append(
            {
                "business_date": str(d),
                "buy_count": buy_n,
                "buy_vendor_net_aed": float(_round2(buy_vendor_net)),
                "buy_platform_fees_aed": float(_round2(buy_fees)),
                "sellback_completed_count": sell_n,
                "sellback_customer_payout_aed": float(_round2(sell_cust)),
                "sellback_cridora_share_aed": float(_round2(sell_cridora)),
                "net_cash_delta_aed": float(_round2(buy_vendor_net - sell_cust)),
            }
        )
        d += dt.timedelta(days=1)
    return list(reversed(out))


def bank_movements_vendor(vendor: User, limit: int = 40) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for p in (
        AdminVendorPayout.objects.filter(vendor=vendor)
        .select_related("created_by", "eod_ledger", "eod_ledger__eod")
        .order_by("-created_at")[:limit]
    ):
        rows.append(
            {
                "kind": "cridora_to_vendor",
                "id": p.id,
                "amount_aed": float(p.amount_aed),
                "status": p.status,
                "created_at": str(p.created_at)[:19].replace("T", " "),
                "confirmed_at": str(p.confirmed_at)[:19].replace("T", " ") if p.confirmed_at else None,
                "reference_note": (p.reference_note or "")[:500],
                "eod_ledger_id": p.eod_ledger_id,
                "eod_business_date": str(p.eod_ledger.eod.business_date)
                if p.eod_ledger_id and p.eod_ledger.eod
                else None,
            }
        )
    for r in (
        VendorToAdminRepayment.objects.filter(vendor=vendor)
        .select_related("confirmed_by")
        .order_by("-created_at")[:limit]
    ):
        rows.append(
            {
                "kind": "vendor_to_cridora",
                "id": r.id,
                "amount_aed": float(r.amount_aed),
                "status": r.status,
                "created_at": str(r.created_at)[:19].replace("T", " "),
                "confirmed_at": str(r.confirmed_at)[:19].replace("T", " ") if r.confirmed_at else None,
                "reason": (r.reason or "")[:500],
            }
        )
    rows.sort(key=lambda x: x["created_at"], reverse=True)
    return rows[: limit * 2]


class AdminCrossPaymentsListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.ADMIN:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        search = (request.query_params.get("search") or "").strip()
        sort_key = (request.query_params.get("sort") or "vendor_name").strip()
        vendors = User.objects.filter(user_type=User.VENDOR).order_by("id")
        if search:
            q = Q(vendor_company__icontains=search) | Q(email__icontains=search)
            if search.isdigit():
                q |= Q(id=int(search))
            vendors = vendors.filter(q)
        rows = [compute_vendor_cross_payment_snapshot(v) for v in vendors]
        rev = sort_key.startswith("-")
        key = sort_key[1:] if rev else sort_key
        allowed = {
            "vendor_name",
            "circulation_sell_value_aed",
            "circulation_buyback_aed",
            "holding_target_aed",
            "vendor_pool_aed",
            "cridora_holding_pct",
        }
        if key not in allowed:
            key = "vendor_name"
        rows.sort(key=lambda r: r.get(key, 0) if isinstance(r.get(key), (int, float)) else str(r.get(key, "")), reverse=rev)
        _, _, biz_today, tz_label = platform_today_utc_bounds()
        return Response(
            {
                "platform_business_timezone": tz_label,
                "platform_business_today": str(biz_today),
                "vendors": rows,
            }
        )


class AdminCrossPaymentVendorDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, vendor_id: int):
        if request.user.user_type != User.ADMIN:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        try:
            v = User.objects.get(id=vendor_id, user_type=User.VENDOR)
        except User.DoesNotExist:
            return Response({"detail": "Vendor not found."}, status=status.HTTP_404_NOT_FOUND)
        try:
            days = int(request.query_params.get("days") or "14")
        except (TypeError, ValueError):
            days = 14
        snap = compute_vendor_cross_payment_snapshot(v)
        return Response(
            {
                **snap,
                "daily_rollup": daily_rollup_vendor(v, days=days),
                "bank_movements": bank_movements_vendor(v, limit=40),
            }
        )


class AdminVendorHoldingPctView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, vendor_id: int):
        if request.user.user_type != User.ADMIN:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        try:
            v = User.objects.get(id=vendor_id, user_type=User.VENDOR)
        except User.DoesNotExist:
            return Response({"detail": "Vendor not found."}, status=status.HTTP_404_NOT_FOUND)
        raw = request.data.get("cridora_holding_pct")
        if raw is None:
            return Response({"detail": "cridora_holding_pct required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            pct = Decimal(str(raw))
        except Exception:
            return Response({"detail": "Invalid cridora_holding_pct."}, status=status.HTTP_400_BAD_REQUEST)
        if pct < 0 or pct > Decimal("100"):
            return Response({"detail": "cridora_holding_pct must be 0–100."}, status=status.HTTP_400_BAD_REQUEST)
        cfg, _ = VendorPricingConfig.objects.get_or_create(user=v)
        cfg.cridora_holding_pct = pct.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        cfg.save(update_fields=["cridora_holding_pct", "updated_at"])
        return Response(compute_vendor_cross_payment_snapshot(v))


class VendorCrossPaymentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.VENDOR:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        try:
            days = int(request.query_params.get("days") or "14")
        except (TypeError, ValueError):
            days = 14
        v = request.user
        snap = compute_vendor_cross_payment_snapshot(v)
        return Response(
            {
                **snap,
                "daily_rollup": daily_rollup_vendor(v, days=days),
                "bank_movements": bank_movements_vendor(v, limit=40),
            }
        )
