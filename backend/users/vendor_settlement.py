"""
Admin ↔ vendor bank transfer records (off-Stripe): admin→vendor payouts with proof,
vendor→admin repayments (e.g. pool top-up) with proof. Customer card payments stay on Stripe/Checkout.
"""
import os

from django.db import transaction
from django.http import FileResponse, Http404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .cross_payments import platform_today_utc_bounds
from .eod_services import generate_and_save_ledger_pdf
from .models import AdminVendorPayout, EodVendorLedger, User, VendorToAdminRepayment, SellOrder

_PROOF_MAX_BYTES = 6 * 1024 * 1024
_PROOF_SUFFIX = ('.pdf', '.jpg', '.jpeg', '.png', '.webp')


def _require_admin(user):
    if user.user_type != User.ADMIN or not user.is_authenticated:
        return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
    return None


def _require_vendor(user):
    if user.user_type != User.VENDOR or not user.is_authenticated:
        return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
    return None


def _validate_proof_file(f):
    if not f:
        return "No file provided."
    if getattr(f, "size", 0) > _PROOF_MAX_BYTES:
        return "File too large (max 6MB)."
    name = (getattr(f, "name", None) or "").lower()
    if "." not in name:
        return "Use a file with extension (PDF, JPG, PNG, or WEBP)."
    suf = name[name.rfind(".") :]
    if suf not in _PROOF_SUFFIX:
        return "Only PDF, JPG, PNG, and WEBP are allowed."
    return None


def _payout_to_dict(p):
    d = {
        "id": p.id,
        "vendor_id": p.vendor_id,
        "vendor_name": p.vendor.vendor_company or p.vendor.email,
        "amount_aed": float(p.amount_aed),
        "reference_note": p.reference_note or "",
        "status": p.status,
        "created_at": str(p.created_at)[:19].replace("T", " "),
        "created_by": p.created_by.email if p.created_by else None,
        "confirmed_at": str(p.confirmed_at)[:19].replace("T", " ") if p.confirmed_at else None,
        "confirmed_note": p.confirmed_note or "",
        "eod_ledger_id": p.eod_ledger_id,
        "eod_business_date": None,
    }
    if p.eod_ledger_id:
        try:
            el = p.eod_ledger
        except EodVendorLedger.DoesNotExist:
            el = None
        if el and el.eod and el.eod.business_date:
            d["eod_business_date"] = str(el.eod.business_date)
    return d


def _repayment_to_dict(r):
    return {
        "id": r.id,
        "vendor_id": r.vendor_id,
        "vendor_name": r.vendor.vendor_company or r.vendor.email,
        "amount_aed": float(r.amount_aed),
        "reason": r.reason or "",
        "sell_order_id": r.sell_order_id,
        "status": r.status,
        "created_at": str(r.created_at)[:19].replace("T", " "),
        "confirmed_at": str(r.confirmed_at)[:19].replace("T", " ") if r.confirmed_at else None,
        "admin_note": r.admin_note or "",
        "confirmed_by": r.confirmed_by.email if r.confirmed_by else None,
    }


class AdminVendorPayoutListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_admin(request)
        if err:
            return err
        q = AdminVendorPayout.objects.select_related(
            "vendor", "created_by", "eod_ledger", "eod_ledger__eod"
        ).order_by("-created_at")
        vid = request.query_params.get("vendor_id")
        if vid and str(vid).isdigit():
            q = q.filter(vendor_id=int(vid))
        return Response([_payout_to_dict(p) for p in q[:200]])

    def post(self, request):
        err = _require_admin(request)
        if err:
            return err
        try:
            vendor_id = int(request.data.get("vendor_id") or 0)
        except (TypeError, ValueError):
            return Response({"detail": "vendor_id required."}, status=status.HTTP_400_BAD_REQUEST)
        if not User.objects.filter(id=vendor_id, user_type=User.VENDOR).exists():
            return Response({"detail": "Invalid vendor."}, status=status.HTTP_400_BAD_REQUEST)
        start_u, end_u, _, _ = platform_today_utc_bounds()
        if AdminVendorPayout.objects.filter(
            vendor_id=vendor_id,
            created_at__gte=start_u,
            created_at__lt=end_u,
        ).exclude(status=AdminVendorPayout.CANCELLED).exists():
            return Response(
                {
                    "detail": (
                        "Only one Cridora→vendor bank payout per vendor per platform business day. "
                        "Cancel the pending payout for today or wait until the next calendar day."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            amount = float(request.data.get("amount_aed") or 0)
        except (TypeError, ValueError):
            return Response({"detail": "Invalid amount."}, status=status.HTTP_400_BAD_REQUEST)
        if amount <= 0 or amount > 1e12:
            return Response({"detail": "Invalid amount."}, status=status.HTTP_400_BAD_REQUEST)
        f = request.FILES.get("proof") or request.FILES.get("file")
        e = _validate_proof_file(f)
        if e:
            return Response({"detail": e}, status=status.HTTP_400_BAD_REQUEST)
        ref = (request.data.get("reference_note") or "")[:2000]
        el_raw = request.data.get("eod_ledger_id")
        with transaction.atomic():
            eod_ledger = None
            if el_raw not in (None, "", 0, "0"):
                try:
                    eod_ledger = EodVendorLedger.objects.select_for_update().get(
                        id=int(el_raw), vendor_id=vendor_id, status=EodVendorLedger.PENDING_BANK
                    )
                except (TypeError, ValueError, EodVendorLedger.DoesNotExist):
                    return Response(
                        {"detail": "Invalid eod_ledger_id (must be pending bank for this vendor)."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                payable = float(eod_ledger.payable_to_vendor_aed)
                if abs(float(amount) - payable) > 0.05:
                    return Response(
                        {"detail": f"Amount must match EOD payable AED {payable:.2f} (±0.05)."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            p = AdminVendorPayout(
                vendor_id=vendor_id,
                amount_aed=amount,
                reference_note=ref,
                proof_file=f,
                status=AdminVendorPayout.PENDING,
                created_by=request.user,
            )
            if eod_ledger is not None:
                p.eod_ledger = eod_ledger
            p.save()
            if eod_ledger is not None:
                eod_ledger.status = EodVendorLedger.AWAITING_VENDOR
                eod_ledger.save(update_fields=["status", "updated_at"])
        return Response(_payout_to_dict(AdminVendorPayout.objects.get(pk=p.id)), status=status.HTTP_201_CREATED)


class VendorIncomingPayoutListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_vendor(request)
        if err:
            return err
        rows = (
            AdminVendorPayout.objects.filter(vendor=request.user)
            .select_related("created_by", "eod_ledger", "eod_ledger__eod")
            .order_by("-created_at")[:100]
        )
        return Response([_payout_to_dict(p) for p in rows])


class VendorConfirmPayoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, payout_id):
        err = _require_vendor(request)
        if err:
            return err
        note = (request.data.get("confirmed_note") or "")[:2000]
        with transaction.atomic():
            try:
                p = AdminVendorPayout.objects.select_for_update().get(
                    id=payout_id, vendor=request.user, status=AdminVendorPayout.PENDING
                )
            except AdminVendorPayout.DoesNotExist:
                return Response(
                    {"detail": "Payout not found or already handled."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            p.status = AdminVendorPayout.CONFIRMED
            p.confirmed_at = timezone.now()
            p.confirmed_note = note
            p.save(update_fields=["status", "confirmed_at", "confirmed_note"])
            if p.eod_ledger_id:
                leg = EodVendorLedger.objects.select_for_update().get(pk=p.eod_ledger_id)
                leg.status = EodVendorLedger.CLOSED
                leg.save(update_fields=["status", "updated_at"])
        if p.eod_ledger_id:
            leg2 = EodVendorLedger.objects.get(pk=p.eod_ledger_id)
            generate_and_save_ledger_pdf(leg2)
        return Response(_payout_to_dict(AdminVendorPayout.objects.get(pk=p.id)))


class AdminVendorPayoutCancelView(APIView):
    """Admin cancels a payout still pending vendor confirmation (e.g. wrong amount)."""

    permission_classes = [IsAuthenticated]

    def post(self, request, payout_id, **_kwargs):
        err = _require_admin(request)
        if err:
            return err
        with transaction.atomic():
            try:
                p = AdminVendorPayout.objects.select_for_update().get(
                    id=payout_id, status=AdminVendorPayout.PENDING
                )
            except AdminVendorPayout.DoesNotExist:
                return Response(
                    {"detail": "Payout not found or not pending."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            lid = p.eod_ledger_id
            p.eod_ledger = None
            p.status = AdminVendorPayout.CANCELLED
            p.save(update_fields=["status", "eod_ledger"])
            if lid:
                EodVendorLedger.objects.filter(pk=lid).update(
                    status=EodVendorLedger.PENDING_BANK, updated_at=timezone.now()
                )
        return Response(_payout_to_dict(AdminVendorPayout.objects.get(pk=payout_id)))


class VendorRepaymentListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_vendor(request)
        if err:
            return err
        rows = (
            VendorToAdminRepayment.objects.filter(vendor=request.user)
            .select_related("confirmed_by", "sell_order")
            .order_by("-created_at")[:100]
        )
        return Response([_repayment_to_dict(r) for r in rows])

    def post(self, request):
        err = _require_vendor(request)
        if err:
            return err
        try:
            amount = float(request.data.get("amount_aed") or 0)
        except (TypeError, ValueError):
            return Response({"detail": "Invalid amount."}, status=status.HTTP_400_BAD_REQUEST)
        if amount <= 0 or amount > 1e12:
            return Response({"detail": "Invalid amount."}, status=status.HTTP_400_BAD_REQUEST)
        f = request.FILES.get("proof") or request.FILES.get("file")
        e = _validate_proof_file(f)
        if e:
            return Response({"detail": e}, status=status.HTTP_400_BAD_REQUEST)
        reason = (request.data.get("reason") or "")[:2000]
        so_id = request.data.get("sell_order_id")
        sell_order = None
        if so_id not in (None, "", 0, "0"):
            try:
                so_id = int(so_id)
                sell_order = SellOrder.objects.get(
                    id=so_id, buy_order__product__vendor=request.user
                )
            except (ValueError, TypeError, SellOrder.DoesNotExist):
                return Response({"detail": "Invalid sell_order_id."}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            r = VendorToAdminRepayment(
                vendor=request.user,
                amount_aed=amount,
                reason=reason,
                sell_order=sell_order,
                proof_file=f,
                status=VendorToAdminRepayment.PENDING,
            )
            r.save()
        return Response(_repayment_to_dict(r), status=status.HTTP_201_CREATED)


class AdminRepaymentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_admin(request)
        if err:
            return err
        st = request.query_params.get("status")
        q = VendorToAdminRepayment.objects.select_related("vendor", "confirmed_by", "sell_order").order_by(
            "-created_at"
        )
        if st in (VendorToAdminRepayment.PENDING, VendorToAdminRepayment.CONFIRMED, VendorToAdminRepayment.REJECTED):
            q = q.filter(status=st)
        return Response([_repayment_to_dict(r) for r in q[:200]])


class AdminRepaymentActionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, repayment_id):
        err = _require_admin(request)
        if err:
            return err
        action = (request.data.get("action") or "").strip().lower()
        admin_note = (request.data.get("admin_note") or "")[:2000]
        if action not in ("confirm", "reject"):
            return Response({"detail": "action must be confirm or reject."}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            try:
                r = VendorToAdminRepayment.objects.select_for_update().get(
                    id=repayment_id, status=VendorToAdminRepayment.PENDING
                )
            except VendorToAdminRepayment.DoesNotExist:
                return Response(
                    {"detail": "Repayment not found or not pending."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            if action == "confirm":
                r.status = VendorToAdminRepayment.CONFIRMED
                r.confirmed_at = timezone.now()
                r.confirmed_by = request.user
            else:
                r.status = VendorToAdminRepayment.REJECTED
                r.confirmed_at = timezone.now()
                r.confirmed_by = request.user
            r.admin_note = admin_note
            r.save(
                update_fields=["status", "confirmed_at", "confirmed_by", "admin_note", "updated_at"]
            )
        r2 = VendorToAdminRepayment.objects.get(pk=r.id)
        return Response(_repayment_to_dict(r2))


def _file_response_for_field(file_field, as_attachment=True):
    if not file_field or not file_field.name:
        raise Http404()
    p = file_field.path
    if not os.path.isfile(p):
        raise Http404()
    name = os.path.basename(file_field.name)
    resp = FileResponse(open(p, "rb"), as_attachment=as_attachment, filename=name)
    return resp


class AdminVendorPayoutProofView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, payout_id):
        if request.user.user_type not in (User.ADMIN, User.VENDOR):
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        try:
            p = AdminVendorPayout.objects.get(pk=payout_id)
        except AdminVendorPayout.DoesNotExist:
            raise Http404()
        if request.user.user_type == User.VENDOR and p.vendor_id != request.user.id:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        return _file_response_for_field(p.proof_file, as_attachment=False)


class VendorRepaymentProofView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, repayment_id):
        if request.user.user_type not in (User.ADMIN, User.VENDOR):
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        try:
            r = VendorToAdminRepayment.objects.get(pk=repayment_id)
        except VendorToAdminRepayment.DoesNotExist:
            raise Http404()
        if request.user.user_type == User.VENDOR and r.vendor_id != request.user.id:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        return _file_response_for_field(r.proof_file, as_attachment=False)
