"""
End-of-day business date, per-vendor ledger rows, and PDF generation.
"""
import datetime as dt
from decimal import Decimal
from io import BytesIO
from typing import Tuple
from zoneinfo import ZoneInfo

from django.core.files.base import ContentFile
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .models import EodVendorLedger, Order, PlatformConfig, SellOrder, User


def business_day_window(business_date: dt.date, tz_name: str):
    """Return timezone-aware [start, end) in UTC for ORM filtering."""
    z = ZoneInfo(tz_name)
    start_local = dt.datetime.combine(business_date, dt.time.min, tzinfo=z)
    end_local = start_local + dt.timedelta(days=1)
    return start_local, end_local


def _dec(x) -> Decimal:
    if x is None:
        return Decimal("0")
    return Decimal(str(x))


def compute_vendor_day_totals(vendor: User, start, end):
    """Buy net to vendor and sell net payout for orders/sells active in [start, end)."""
    paid = Order.objects.filter(
        product__vendor=vendor,
        status=Order.PAID,
        created_at__gte=start,
        created_at__lt=end,
    )
    buy_revenue = sum((float(o.total_aed) - float(o.platform_fee_aed)) for o in paid)
    completed = SellOrder.objects.filter(
        buy_order__product__vendor=vendor,
        status=SellOrder.COMPLETED,
        updated_at__gte=start,
        updated_at__lt=end,
    )
    sell_ded = sum(float(s.net_payout_aed) for s in completed)
    buy_d = _dec(buy_revenue).quantize(Decimal("0.01"))
    sell_d = _dec(sell_ded).quantize(Decimal("0.01"))
    net = (buy_d - sell_d).quantize(Decimal("0.01"))
    return buy_d, sell_d, net


def apply_holding(net: Decimal, holding_pct: Decimal) -> Tuple[Decimal, Decimal]:
    """
    Hold is applied only on positive daily net: held = net * (pct/100), payable = net - held.
    If net <= 0, nothing is held; payable equals net (vendor may owe Cridora).
    """
    hp = holding_pct if holding_pct > 0 else Decimal("0")
    if net > 0:
        held = (net * hp / Decimal("100")).quantize(Decimal("0.01"))
        payable = (net - held).quantize(Decimal("0.01"))
        return held, payable
    return Decimal("0"), net


def collect_ledger_transaction_rows(vendor: User, start, end):
    """Line items for PDF: paid buys and completed sells in the window."""
    rows = []
    for o in (
        Order.objects.filter(
            product__vendor=vendor,
            status=Order.PAID,
            created_at__gte=start,
            created_at__lt=end,
        )
        .select_related("customer", "product")
        .order_by("created_at")
    ):
        net_v = float(o.total_aed) - float(o.platform_fee_aed)
        rows.append(
            {
                "kind": "BUY",
                "ref": getattr(o, "order_ref", None) or f"#{o.id}",
                "when": o.created_at,
                "detail": (o.product.name if o.product else "")[:80],
                "amount_aed": float(o.total_aed),
                "net_aed": round(net_v, 2),
            }
        )
    for s in (
        SellOrder.objects.filter(
            buy_order__product__vendor=vendor,
            status=SellOrder.COMPLETED,
            updated_at__gte=start,
            updated_at__lt=end,
        )
        .select_related("customer", "buy_order__product")
        .order_by("updated_at")
    ):
        rows.append(
            {
                "kind": "SELL",
                "ref": getattr(s, "order_ref", None) or f"SB-{s.id}",
                "when": s.updated_at,
                "detail": (s.buy_order.product.name if s.buy_order and s.buy_order.product else "")[:80],
                "amount_aed": float(s.net_payout_aed),
                "net_aed": -round(float(s.net_payout_aed), 2),
            }
        )
    rows.sort(key=lambda r: r["when"])
    return rows


def build_vendor_row_dict(
    vendor: User, start, end, holding_pct: Decimal
) -> dict:
    buy_d, sell_d, net = compute_vendor_day_totals(vendor, start, end)
    held, payable = apply_holding(net, holding_pct)
    name = (vendor.vendor_company or vendor.email or "").strip() or f"Vendor #{vendor.id}"
    return {
        "vendor_id": vendor.id,
        "vendor_name": name,
        "buy_revenue_aed": float(buy_d),
        "sell_deductions_aed": float(sell_d),
        "net_before_hold_aed": float(net),
        "held_aed": float(held),
        "payable_to_vendor_aed": float(payable),
        "net_to_vendor_aed": float(net),
    }


def render_ledger_pdf_bytes(ledger: EodVendorLedger) -> bytes:
    eod = ledger.eod
    vendor = ledger.vendor
    tz_name = (eod.eod_business_timezone or PlatformConfig.get().eod_business_timezone or "Asia/Dubai").strip() or "Asia/Dubai"
    if not eod.business_date:
        raise ValueError("EOD has no business_date")
    start, end = business_day_window(eod.business_date, tz_name)
    lines = collect_ledger_transaction_rows(vendor, start, end)

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=1.5 * cm, leftMargin=1.5 * cm, topMargin=1.2 * cm, bottomMargin=1.2 * cm)
    styles = getSampleStyleSheet()
    story = [
        Paragraph("<b>Cridora — Daily transaction ledger (EOD)</b>", styles["Title"]),
        Spacer(1, 0.3 * cm),
        Paragraph(
            f"Business date: <b>{eod.business_date}</b> &nbsp;|&nbsp; Timezone: {tz_name}",
            styles["Normal"],
        ),
        Paragraph(
            f"Vendor: <b>{(vendor.vendor_company or vendor.email or str(vendor.id))}</b> &nbsp;|&nbsp; "
            f"EOD run #{eod.id} &nbsp;|&nbsp; Ledger line #{ledger.id}",
            styles["Normal"],
        ),
        Spacer(1, 0.4 * cm),
        Paragraph(
            f"Summary: Buy (net) AED {ledger.buy_revenue_aed} &nbsp;|&nbsp; Sells (payout) AED {ledger.sell_deductions_aed} "
            f"&nbsp;|&nbsp; Net (before hold) AED {ledger.net_before_hold_aed} &nbsp;|&nbsp; Cridora hold AED {ledger.held_aed} "
            f"&nbsp;|&nbsp; <b>Payable to vendor AED {ledger.payable_to_vendor_aed}</b>",
            styles["Normal"],
        ),
        Spacer(1, 0.5 * cm),
        Paragraph("<b>Transactions (buy and sell) for the business day</b>", styles["Heading2"]),
        Spacer(1, 0.2 * cm),
    ]

    data = [["Type", "Ref", "Time (UTC)", "Detail", "Net to vendor (AED)"]]
    for r in lines:
        ts = r["when"]
        if timezone.is_aware(ts):
            ts = ts.astimezone(dt.timezone.utc)
        data.append(
            [
                r["kind"],
                str(r["ref"])[:32],
                ts.strftime("%Y-%m-%d %H:%M") if ts else "—",
                r["detail"][:60],
                f"{r['net_aed']:.2f}",
            ]
        )
    if len(data) == 1:
        data.append(["—", "—", "—", "No transactions in this window", "0.00"])

    t = Table(data, colWidths=[2 * cm, 2.2 * cm, 3.2 * cm, 4.5 * cm, 3 * cm])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a1a1a")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 7),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(t)
    story.append(Spacer(1, 0.4 * cm))
    story.append(
        Paragraph(
            "Customer card payments are collected via Stripe. This ledger reflects Cridora’s records for the stated business day. "
            "Settle in-bank differences using the bank proof and confirmation in the app.",
            styles["BodyText"],
        )
    )
    doc.build(story)
    return buf.getvalue()


def generate_and_save_ledger_pdf(ledger: EodVendorLedger) -> EodVendorLedger:
    if ledger.pdf_file and ledger.pdf_file.name:
        return ledger
    raw = render_ledger_pdf_bytes(ledger)
    name = f"eod-ledger-eod{ledger.eod_id}-v{ledger.vendor_id}.pdf"
    ledger.pdf_file.save(name, ContentFile(raw), save=False)
    ledger.pdf_generated_at = timezone.now()
    ledger.save(update_fields=["pdf_file", "pdf_generated_at", "updated_at"])
    return ledger
