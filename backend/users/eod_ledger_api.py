"""
List and download EOD PDF ledgers (JWT; private media).
"""
import os

from django.http import FileResponse, Http404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AdminVendorPayout, EodVendorLedger, User


def _require_admin(user):
    if user.user_type != User.ADMIN or not user.is_authenticated:
        return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
    return None


def _require_vendor(user):
    if user.user_type != User.VENDOR or not user.is_authenticated:
        return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
    return None


def ledger_to_dict(ledger: EodVendorLedger):
    eod = ledger.eod
    p = AdminVendorPayout.objects.filter(eod_ledger=ledger).first()
    return {
        "id": ledger.id,
        "eod_id": ledger.eod_id,
        "business_date": str(eod.business_date) if eod.business_date else None,
        "vendor_id": ledger.vendor_id,
        "vendor_name": ledger.vendor.vendor_company or ledger.vendor.email,
        "buy_revenue_aed": float(ledger.buy_revenue_aed),
        "sell_deductions_aed": float(ledger.sell_deductions_aed),
        "net_before_hold_aed": float(ledger.net_before_hold_aed),
        "held_aed": float(ledger.held_aed),
        "payable_to_vendor_aed": float(ledger.payable_to_vendor_aed),
        "status": ledger.status,
        "has_pdf": bool(ledger.pdf_file and ledger.pdf_file.name),
        "payout_id": p.id if p else None,
        "pdf_generated_at": str(ledger.pdf_generated_at)[:19].replace("T", " ") if ledger.pdf_generated_at else None,
        "window_start_utc": ledger.window_start.isoformat() if ledger.window_start else None,
        "window_end_utc": ledger.window_end.isoformat() if ledger.window_end else None,
    }


class VendorEodLedgerListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_vendor(request)
        if err:
            return err
        rows = EodVendorLedger.objects.filter(vendor=request.user).select_related("eod", "vendor").order_by(
            "-eod__created_at"
        )[:60]
        return Response([ledger_to_dict(x) for x in rows])


class AdminEodLedgerListView(APIView):
    """All ledger lines; optional ?status=pending_bank&vendor_id= """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_admin(request)
        if err:
            return err
        q = EodVendorLedger.objects.select_related("eod", "vendor").order_by("-eod__created_at", "-id")
        st = (request.query_params.get("status") or "").strip()
        if st in (
            EodVendorLedger.PENDING_BANK,
            EodVendorLedger.AWAITING_VENDOR,
            EodVendorLedger.CLOSED,
        ):
            q = q.filter(status=st)
        vid = request.query_params.get("vendor_id")
        if vid and str(vid).isdigit():
            q = q.filter(vendor_id=int(vid))
        return Response([ledger_to_dict(x) for x in q[:200]])


def _file_response_pdf(ledger: EodVendorLedger, as_attachment: bool) -> FileResponse:
    f = ledger.pdf_file
    if not f or not f.name:
        raise Http404()
    p = f.path
    if not os.path.isfile(p):
        raise Http404()
    name = os.path.basename(f.name)
    return FileResponse(open(p, "rb"), as_attachment=as_attachment, filename=name)


class EodLedgerPdfView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, ledger_id):
        try:
            ledger = EodVendorLedger.objects.select_related("eod", "vendor").get(pk=ledger_id)
        except EodVendorLedger.DoesNotExist:
            raise Http404()
        u = request.user
        if u.user_type == User.VENDOR and ledger.vendor_id != u.id:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        if u.user_type not in (User.ADMIN, User.VENDOR):
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        if not (ledger.pdf_file and ledger.pdf_file.name):
            return Response({"detail": "PDF not available yet for this line."}, status=status.HTTP_404_NOT_FOUND)
        return _file_response_pdf(ledger, as_attachment=bool(int(request.query_params.get("download", 0) or 0)))
