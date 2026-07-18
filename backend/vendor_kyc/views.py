from django.db.models import Q
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from users.models import User

from .models import VendorCustomerVerification, VendorKycAccess, VendorKycAuditLog
from .services import (
    PENDING_MESSAGE,
    access_to_dict,
    decide_verification,
    ensure_pending_verification,
    get_verification_status,
    set_vendor_access,
    vendor_requires_manual_kyc,
    verification_to_dict,
)


def _require_admin(request):
    if request.user.user_type != User.ADMIN:
        return Response({'detail': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)
    return None


class AdminVendorKycAccessListView(APIView):
    """GET: list all vendors with their manual-KYC access flag."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_admin(request)
        if err:
            return err
        vendors = User.objects.filter(user_type=User.VENDOR).order_by('vendor_company', 'id')
        access_map = {
            a.vendor_id: a
            for a in VendorKycAccess.objects.filter(vendor__in=vendors)
        }
        out = []
        for v in vendors:
            a = access_map.get(v.id)
            out.append({
                'vendor_id': v.id,
                'vendor_company': v.vendor_company or '',
                'email': v.email,
                'enabled': bool(a and a.enabled),
                'notes': (a.notes if a else '') or '',
                'granted_at': a.granted_at.isoformat() if a and a.granted_at else None,
            })
        return Response(out)


class AdminVendorKycAccessView(APIView):
    """GET / POST for a single vendor's manual KYC access."""

    permission_classes = [IsAuthenticated]

    def get(self, request, vendor_id):
        err = _require_admin(request)
        if err:
            return err
        try:
            vendor = User.objects.get(id=vendor_id, user_type=User.VENDOR)
        except User.DoesNotExist:
            return Response({'detail': 'Vendor not found.'}, status=status.HTTP_404_NOT_FOUND)
        try:
            access = vendor.manual_kyc_access
            return Response(access_to_dict(access))
        except VendorKycAccess.DoesNotExist:
            return Response({
                'vendor_id': vendor.id,
                'enabled': False,
                'notes': '',
                'granted_at': None,
                'granted_by_id': None,
                'updated_at': None,
            })

    def post(self, request, vendor_id):
        err = _require_admin(request)
        if err:
            return err
        try:
            vendor = User.objects.get(id=vendor_id, user_type=User.VENDOR)
        except User.DoesNotExist:
            return Response({'detail': 'Vendor not found.'}, status=status.HTTP_404_NOT_FOUND)
        enabled = request.data.get('enabled')
        if enabled is None:
            return Response({'detail': 'enabled (bool) is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if isinstance(enabled, str):
            enabled = enabled.lower() in ('1', 'true', 'yes')
        notes = request.data.get('notes', '') or ''
        access = set_vendor_access(vendor, bool(enabled), request.user, notes=notes)
        return Response(access_to_dict(access))


class VendorVerificationListView(APIView):
    """Dealer queue: list / search customers for manual verification."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.VENDOR:
            return Response({'detail': 'Vendor access required.'}, status=status.HTTP_403_FORBIDDEN)
        if not vendor_requires_manual_kyc(request.user):
            return Response(
                {'detail': 'Manual KYC access is not enabled for your account.', 'enabled': False},
                status=status.HTTP_403_FORBIDDEN,
            )

        status_filter = (request.query_params.get('status') or '').strip().lower()
        q = (request.query_params.get('q') or '').strip()

        qs = VendorCustomerVerification.objects.filter(vendor=request.user).select_related('customer')
        if status_filter in (
            VendorCustomerVerification.PENDING,
            VendorCustomerVerification.VERIFIED,
            VendorCustomerVerification.REJECTED,
        ):
            qs = qs.filter(status=status_filter)
        if q:
            qs = qs.filter(
                Q(customer__email__icontains=q)
                | Q(customer__phone__icontains=q)
                | Q(customer__first_name__icontains=q)
                | Q(customer__last_name__icontains=q)
                | Q(customer__username__icontains=q)
            )

        rows = [verification_to_dict(r) for r in qs[:200]]
        return Response({'enabled': True, 'items': rows})


class VendorCustomerSearchView(APIView):
    """Search customers to start a verification before they attempt a purchase."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.VENDOR:
            return Response({'detail': 'Vendor access required.'}, status=status.HTTP_403_FORBIDDEN)
        if not vendor_requires_manual_kyc(request.user):
            return Response({'detail': 'Manual KYC access is not enabled.'}, status=status.HTTP_403_FORBIDDEN)
        q = (request.query_params.get('q') or '').strip()
        if len(q) < 2:
            return Response({'detail': 'q must be at least 2 characters.'}, status=status.HTTP_400_BAD_REQUEST)

        customers = User.objects.filter(user_type=User.CUSTOMER, is_active=True).filter(
            Q(email__icontains=q)
            | Q(phone__icontains=q)
            | Q(first_name__icontains=q)
            | Q(last_name__icontains=q)
        )[:30]

        existing = {
            r.customer_id: r.status
            for r in VendorCustomerVerification.objects.filter(
                vendor=request.user,
                customer_id__in=[c.id for c in customers],
            )
        }
        out = []
        for c in customers:
            out.append({
                'id': c.id,
                'email': c.email,
                'name': c.get_full_name() or c.email,
                'phone': c.phone or '',
                'verification_status': existing.get(c.id),
            })
        return Response(out)


class VendorVerificationActionView(APIView):
    """Approve or reject a customer for this vendor."""

    permission_classes = [IsAuthenticated]

    def post(self, request, customer_id, action):
        if request.user.user_type not in (User.VENDOR, User.ADMIN):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        if action not in ('approve', 'reject'):
            return Response({'detail': 'Invalid action.'}, status=status.HTTP_400_BAD_REQUEST)

        if request.user.user_type == User.ADMIN:
            vendor_id = request.data.get('vendor_id')
            if not vendor_id:
                return Response({'detail': 'vendor_id required for admin.'}, status=status.HTTP_400_BAD_REQUEST)
            try:
                vendor = User.objects.get(id=vendor_id, user_type=User.VENDOR)
            except User.DoesNotExist:
                return Response({'detail': 'Vendor not found.'}, status=status.HTTP_404_NOT_FOUND)
        else:
            vendor = request.user
            if not vendor_requires_manual_kyc(vendor):
                return Response(
                    {'detail': 'Manual KYC access is not enabled for your account.'},
                    status=status.HTTP_403_FORBIDDEN,
                )

        try:
            customer = User.objects.get(id=customer_id, user_type=User.CUSTOMER)
        except User.DoesNotExist:
            return Response({'detail': 'Customer not found.'}, status=status.HTTP_404_NOT_FOUND)

        reason = request.data.get('reason', '') or ''
        try:
            row = decide_verification(
                vendor,
                customer,
                decided_by=request.user,
                approve=(action == 'approve'),
                reason=reason,
            )
        except PermissionError as e:
            return Response({'detail': str(e)}, status=status.HTTP_403_FORBIDDEN)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(verification_to_dict(row))


class VendorVerificationRequestView(APIView):
    """Vendor explicitly starts a pending verification for a found customer."""

    permission_classes = [IsAuthenticated]

    def post(self, request, customer_id):
        if request.user.user_type != User.VENDOR:
            return Response({'detail': 'Vendor access required.'}, status=status.HTTP_403_FORBIDDEN)
        if not vendor_requires_manual_kyc(request.user):
            return Response({'detail': 'Manual KYC access is not enabled.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            customer = User.objects.get(id=customer_id, user_type=User.CUSTOMER)
        except User.DoesNotExist:
            return Response({'detail': 'Customer not found.'}, status=status.HTTP_404_NOT_FOUND)
        row, created = ensure_pending_verification(
            request.user, customer, actor=request.user, notify=False
        )
        return Response(verification_to_dict(row), status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class CustomerVendorStatusView(APIView):
    """Customer checks their verification status with a specific vendor."""

    permission_classes = [IsAuthenticated]

    def get(self, request, vendor_id):
        if request.user.user_type != User.CUSTOMER:
            return Response({'detail': 'Customer access required.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            vendor = User.objects.get(id=vendor_id, user_type=User.VENDOR)
        except User.DoesNotExist:
            return Response({'detail': 'Vendor not found.'}, status=status.HTTP_404_NOT_FOUND)
        requires = vendor_requires_manual_kyc(vendor)
        st = get_verification_status(vendor, request.user) if requires else None
        return Response({
            'vendor_id': vendor.id,
            'vendor_name': vendor.vendor_company or vendor.get_full_name() or vendor.email,
            'requires_manual_kyc': requires,
            'status': st,
            'pending_message': PENDING_MESSAGE if requires and st != VendorCustomerVerification.VERIFIED else '',
        })


class VendorOwnAccessView(APIView):
    """Vendor checks whether they have manual KYC access (for nav visibility)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.VENDOR:
            return Response({'detail': 'Vendor access required.'}, status=status.HTTP_403_FORBIDDEN)
        enabled = vendor_requires_manual_kyc(request.user)
        pending_count = 0
        if enabled:
            pending_count = VendorCustomerVerification.objects.filter(
                vendor=request.user,
                status=VendorCustomerVerification.PENDING,
            ).count()
        return Response({'enabled': enabled, 'pending_count': pending_count})


class VendorKycAuditListView(APIView):
    """Recent audit entries for a vendor (vendor own or admin)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type == User.VENDOR:
            vendor = request.user
        elif request.user.user_type == User.ADMIN:
            vendor_id = request.query_params.get('vendor_id')
            if not vendor_id:
                return Response({'detail': 'vendor_id required.'}, status=status.HTTP_400_BAD_REQUEST)
            try:
                vendor = User.objects.get(id=vendor_id, user_type=User.VENDOR)
            except User.DoesNotExist:
                return Response({'detail': 'Vendor not found.'}, status=status.HTTP_404_NOT_FOUND)
        else:
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        logs = (
            VendorKycAuditLog.objects.filter(vendor=vendor)
            .select_related('customer', 'actor')
            .order_by('-created_at')[:100]
        )
        out = []
        for log in logs:
            out.append({
                'id': log.id,
                'action': log.action,
                'previous_status': log.previous_status,
                'new_status': log.new_status,
                'notes': log.notes,
                'created_at': log.created_at.isoformat() if log.created_at else None,
                'customer_id': log.customer_id,
                'customer_email': log.customer.email if log.customer_id else None,
                'actor_id': log.actor_id,
                'actor_email': log.actor.email if log.actor_id else None,
            })
        return Response(out)
