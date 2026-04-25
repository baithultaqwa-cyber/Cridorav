"""
End-of-day vendor disbursement records (bookkeeping): net owed per vendor
after buy revenue minus completed sell-back payouts.
"""
from decimal import Decimal

from django.db import transaction
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import EndOfDayPayout, Order, SellOrder, User


def build_eod_vendor_rows():
    """
    For each vendor: sum (paid order net to vendor) minus sum (completed sell net payout).
    """
    rows = []
    for v in User.objects.filter(user_type=User.VENDOR).order_by("id"):
        paid_orders = Order.objects.filter(status=Order.PAID, product__vendor=v)
        buy_revenue = sum(
            float(o.total_aed) - float(o.platform_fee_aed) for o in paid_orders
        )
        completed_sells = SellOrder.objects.filter(
            buy_order__product__vendor=v, status=SellOrder.COMPLETED
        )
        sell_ded = sum(float(s.net_payout_aed) for s in completed_sells)
        net = round(Decimal(str(buy_revenue)) - Decimal(str(sell_ded)), 2)
        rows.append(
            {
                "vendor_id": v.id,
                "vendor_name": (v.vendor_company or v.email or "").strip() or f"Vendor #{v.id}",
                "buy_revenue_aed": round(buy_revenue, 2),
                "sell_deductions_aed": round(sell_ded, 2),
                "net_to_vendor_aed": float(net),
            }
        )
    return rows


class AdminEodPayoutView(APIView):
    """
    POST: record an end-of-day snapshot of net amounts owed to each vendor
    (after sell-back deductions). Does not move money; bookkeeping only.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.user_type != User.ADMIN:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        rows = build_eod_vendor_rows()
        total_net = round(
            sum(r["net_to_vendor_aed"] for r in rows if r["net_to_vendor_aed"] > 0), 2
        )
        with transaction.atomic():
            run = EndOfDayPayout.objects.create(created_by=request.user, vendor_rows=rows)
        return Response(
            {
                "id": run.id,
                "created_at": str(run.created_at)[:19].replace("T", " "),
                "vendor_rows": rows,
                "total_net_payable_aed": total_net,
            },
            status=status.HTTP_201_CREATED,
        )
