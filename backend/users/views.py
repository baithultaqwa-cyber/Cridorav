import json
import mimetypes
import os
from io import BytesIO
import requests as http_requests

from django.conf import settings as django_settings
from django.contrib.auth.tokens import default_token_generator
from django.core.files.base import ContentFile
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode

from django.db import OperationalError, ProgrammingError, transaction
from django.http import FileResponse
from django.urls import reverse
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from .serializers import LoginSerializer, RegisterSerializer, UserProfileSerializer
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from django.db.models import Count, Sum
from .models import (
    User,
    KYCDocument,
    KYCDocumentSupersededSnapshot,
    VendorPricingConfig,
    CatalogProduct,
    ProductWishlistItem,
    CatalogStagingImage,
    CustomerBankDetails,
    PlatformConfig,
    Order,
    VendorSchedule,
    SellOrder,
    PasswordResetRequest,
)
from .compliance import (
    customer_compliance_verification,
    vendor_compliance_verification,
    customer_ready_for_kyc_approval,
    vendor_ready_for_kyb_approval,
)


def _doc_to_dict(doc, request):
    file_url = None
    if doc.file:
        file_url = request.build_absolute_uri(
            reverse('kyc-document-file', kwargs={'doc_id': doc.id})
        )
    return {
        'id': doc.id,
        'doc_type': doc.doc_type,
        'label': KYCDocument.DOC_TYPE_LABELS.get(doc.doc_type, doc.doc_type),
        'file_url': file_url,
        'original_filename': doc.original_filename,
        'status': doc.status,
        'rejection_reason': doc.rejection_reason,
        'uploaded_at': str(doc.uploaded_at)[:16],
        'reviewed_at': str(doc.reviewed_at)[:16] if doc.reviewed_at else None,
    }


def _snapshot_to_dict(snap, request):
    file_url = None
    if snap.file:
        file_url = request.build_absolute_uri(
            reverse('kyc-superseded-file', kwargs={'snapshot_id': snap.id})
        )
    return {
        'id': snap.id,
        'doc_type': snap.doc_type,
        'label': KYCDocument.DOC_TYPE_LABELS.get(snap.doc_type, snap.doc_type),
        'file_url': file_url,
        'original_filename': snap.original_filename,
        'reviewed_at': str(snap.reviewed_at)[:16] if snap.reviewed_at else None,
        'reviewed_by_email': snap.reviewed_by.email if snap.reviewed_by else None,
        'superseded_at': str(snap.superseded_at)[:16],
    }


def _admin_doc_detail_dict(doc, request, snaps_for_type=None):
    """Current document row plus archived verified versions (admin UI)."""
    row = _doc_to_dict(doc, request)
    if snaps_for_type is not None:
        snaps = snaps_for_type
    else:
        snaps = (
            KYCDocumentSupersededSnapshot.objects.filter(user=doc.user, doc_type=doc.doc_type)
            .select_related('reviewed_by')
            .order_by('-superseded_at')
        )
    row['previous_verified_versions'] = [_snapshot_to_dict(s, request) for s in snaps]
    return row


def _archive_superseded_verified_document(doc):
    """Keep a copy of the last admin-verified file when the user uploads a replacement."""
    if doc.status != KYCDocument.DOC_VERIFIED or not doc.file:
        return
    with doc.file.open('rb') as f:
        content = f.read()
    base = os.path.basename(doc.file.name) or 'document.bin'
    KYCDocumentSupersededSnapshot.objects.create(
        user=doc.user,
        doc_type=doc.doc_type,
        original_filename=doc.original_filename,
        reviewed_at=doc.reviewed_at,
        reviewed_by=doc.reviewed_by,
        file=ContentFile(content, name=base),
    )


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            return Response(serializer.validated_data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            refresh = RefreshToken.for_user(user)
            return Response({
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user_type': user.user_type,
                'user_id': user.id,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'kyc_status': user.kyc_status,
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class VendorApplyView(APIView):
    """Create a vendor account (kyc_status=pending, no trading until KYB approved)."""
    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data
        email = data.get('email', '').lower().strip()
        password = data.get('password', '')
        first_name = data.get('first_name', '').strip()
        last_name = data.get('last_name', '').strip()
        vendor_company = data.get('vendor_company', '').strip()
        phone = data.get('phone', '').strip()
        country = data.get('country', 'UAE').strip()
        metals = data.get('metals', '')

        errors = {}
        if not email:
            errors['email'] = 'Email is required.'
        elif User.objects.filter(email__iexact=email).exists():
            errors['email'] = 'An account with this email already exists.'
        if not password or len(password) < 8:
            errors['password'] = 'Password must be at least 8 characters.'
        if not first_name:
            errors['first_name'] = 'First name is required.'
        if not vendor_company:
            errors['vendor_company'] = 'Company name is required.'
        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            vendor_company=vendor_company,
            phone=phone,
            country=country,
            user_type=User.VENDOR,
            kyc_status=User.KYC_PENDING,
        )

        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user_type': user.user_type,
            'user_id': user.id,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'kyc_status': user.kyc_status,
            'vendor_company': user.vendor_company,
            'message': 'Vendor application submitted. Awaiting KYB review by Cridora admin.',
        }, status=status.HTTP_201_CREATED)


class WishlistView(APIView):
    """GET / PUT marketplace product wishlist for the signed-in user."""
    permission_classes = [IsAuthenticated]
    _MAX_ITEMS = 500

    def get(self, request):
        rows = (
            ProductWishlistItem.objects.filter(user=request.user)
            .order_by('sort_order', 'id')
            .values_list('product_id', flat=True)
        )
        return Response({'product_ids': list(rows)})

    def put(self, request):
        raw = request.data.get('product_ids')
        if raw is None:
            return Response({'detail': 'product_ids is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(raw, list):
            return Response({'detail': 'product_ids must be a list.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(raw) > self._MAX_ITEMS:
            return Response(
                {'detail': f'At most {self._MAX_ITEMS} products allowed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            pids = [int(x) for x in raw]
        except (TypeError, ValueError):
            return Response({'detail': 'product_ids must be integers.'}, status=status.HTTP_400_BAD_REQUEST)
        seen = set()
        ordered_unique = []
        for x in pids:
            if x in seen:
                continue
            seen.add(x)
            ordered_unique.append(x)
        existing = set(
            CatalogProduct.objects.filter(id__in=ordered_unique).values_list('id', flat=True)
        )
        final = [x for x in ordered_unique if x in existing]
        with transaction.atomic():
            ProductWishlistItem.objects.filter(user=request.user).delete()
            ProductWishlistItem.objects.bulk_create(
                [
                    ProductWishlistItem(user=request.user, product_id=pid, sort_order=i)
                    for i, pid in enumerate(final)
                ]
            )
        return Response({'product_ids': final})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        u = request.user
        data = dict(UserProfileSerializer(u, context={'request': request}).data)
        if u.user_type == User.CUSTOMER:
            c = customer_compliance_verification(u)
            data['compliance'] = c
            data['kyc_status_effective'] = c['status']
        elif u.user_type == User.VENDOR:
            c = vendor_compliance_verification(u)
            data['compliance'] = c
            data['kyc_status_effective'] = c['status']
        return Response(data)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response({'detail': 'Refresh token required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError:
            pass
        return Response({'detail': 'Logged out successfully.'}, status=status.HTTP_200_OK)


# ── Admin action views ────────────────────────────────────────────

def _require_admin(request):
    if request.user.user_type != User.ADMIN:
        return Response({'detail': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)
    return None


def _suspend_account_verification_for_rereview(user):
    """
    After admin requests doc/bank resubmission or a verified user resubmits,
    require full admin re-approval (identity + docs + bank for customers; same for vendors).

    Users stay is_active=True so they can still log in and upload documents; trading is
    blocked via compliance (trading_allowed) on buy/sell and related endpoints only.
    """
    if user.user_type == User.ADMIN:
        return
    fields = []
    if user.kyc_status == User.KYC_VERIFIED:
        user.kyc_status = User.KYC_PENDING
        fields.append('kyc_status')
    if user.kyc_verified_at is not None:
        user.kyc_verified_at = None
        fields.append('kyc_verified_at')
    if fields:
        user.save(update_fields=fields)


class AdminKYCActionView(APIView):
    """Approve or reject a customer's KYC."""
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id, action):
        err = _require_admin(request)
        if err:
            return err
        if action not in ('approve', 'reject'):
            return Response({'detail': 'Invalid action.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(id=user_id, user_type=User.CUSTOMER)
        except User.DoesNotExist:
            return Response({'detail': 'Customer not found.'}, status=status.HTTP_404_NOT_FOUND)
        if action == 'approve':
            ok, err_msg = customer_ready_for_kyc_approval(user)
            if not ok:
                return Response(
                    {'detail': err_msg},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user.kyc_status = User.KYC_VERIFIED
            user.kyc_verified_at = timezone.now()
            user.save(update_fields=['kyc_status', 'kyc_verified_at'])
        else:
            user.kyc_status = User.KYC_REJECTED
            user.save(update_fields=['kyc_status'])
        return Response({'detail': f'KYC {action}d for {user.email}.', 'kyc_status': user.kyc_status})


class AdminKYBActionView(APIView):
    """Approve or reject a vendor's KYB (uses same kyc_status field)."""
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id, action):
        err = _require_admin(request)
        if err:
            return err
        if action not in ('approve', 'reject'):
            return Response({'detail': 'Invalid action.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(id=user_id, user_type=User.VENDOR)
        except User.DoesNotExist:
            return Response({'detail': 'Vendor not found.'}, status=status.HTTP_404_NOT_FOUND)
        if action == 'approve':
            ok, err_msg = vendor_ready_for_kyb_approval(user)
            if not ok:
                return Response(
                    {'detail': err_msg},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user.kyc_status = User.KYC_VERIFIED
            user.kyc_verified_at = timezone.now()
            user.is_active = True
            user.save(update_fields=['kyc_status', 'kyc_verified_at', 'is_active'])
        else:
            user.kyc_status = User.KYC_REJECTED
            user.save(update_fields=['kyc_status'])
        return Response({'detail': f'KYB {action}d for {user.email}.', 'kyc_status': user.kyc_status})


class AdminFreezeUserView(APIView):
    """Freeze or unfreeze any user account."""
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id, action):
        err = _require_admin(request)
        if err:
            return err
        if action not in ('freeze', 'unfreeze'):
            return Response({'detail': 'Invalid action.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
        if user.user_type == User.ADMIN:
            return Response({'detail': 'Cannot freeze admin accounts.'}, status=status.HTTP_400_BAD_REQUEST)
        user.is_active = (action == 'unfreeze')
        user.save(update_fields=['is_active'])
        return Response({'detail': f'User {user.email} {action}d.', 'is_active': user.is_active})


# ── Document views ───────────────────────────────────────────────

class MyDocumentsView(APIView):
    """List the logged-in user's KYC/KYB documents."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        docs = KYCDocument.objects.filter(user=request.user)
        return Response([_doc_to_dict(d, request) for d in docs])


_KYC_MAX_UPLOAD_BYTES = 10 * 1024 * 1024
_KYC_ALLOWED_SUFFIX = frozenset({'.pdf', '.jpg', '.jpeg', '.png', '.webp'})


def _validate_kyc_file_upload(file):
    if file.size > _KYC_MAX_UPLOAD_BYTES:
        return 'File is too large (max 10 MB).'
    name = (getattr(file, 'name', None) or '').lower()
    if '.' not in name:
        return 'Invalid file: use a filename with a proper extension (PDF, JPG, PNG, or WEBP).'
    suffix = name[name.rfind('.'):]
    if suffix not in _KYC_ALLOWED_SUFFIX:
        return 'Only PDF, JPG, PNG, and WEBP uploads are allowed.'
    return None


class DocumentUploadView(APIView):
    """Upload (or replace) a KYC/KYB document."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        doc_type = request.data.get('doc_type', '').strip()
        file = request.FILES.get('file')

        allowed = KYCDocument.CUSTOMER_DOCS if request.user.user_type == User.CUSTOMER else KYCDocument.VENDOR_DOCS
        if doc_type not in allowed:
            return Response({'detail': f'Invalid document type for your account.'}, status=status.HTTP_400_BAD_REQUEST)
        if not file:
            return Response({'detail': 'No file provided.'}, status=status.HTTP_400_BAD_REQUEST)
        err = _validate_kyc_file_upload(file)
        if err:
            return Response({'detail': err}, status=status.HTTP_400_BAD_REQUEST)

        doc, _ = KYCDocument.objects.get_or_create(user=request.user, doc_type=doc_type)
        if doc.file and doc.status == KYCDocument.DOC_VERIFIED:
            _archive_superseded_verified_document(doc)
        if doc.file:
            try:
                doc.file.delete(save=False)
            except Exception:
                pass
        doc.file = file
        doc.original_filename = file.name
        doc.status = KYCDocument.DOC_PENDING
        doc.rejection_reason = ''
        doc.reviewed_at = None
        doc.reviewed_by = None
        was_verified = request.user.kyc_status == User.KYC_VERIFIED
        doc.save()

        if request.user.kyc_status == User.KYC_REJECTED:
            request.user.kyc_status = User.KYC_PENDING
            request.user.save(update_fields=['kyc_status'])
        elif was_verified:
            _suspend_account_verification_for_rereview(request.user)

        return Response(_doc_to_dict(doc, request), status=status.HTTP_201_CREATED)


class AdminUserDocumentsView(APIView):
    """Admin: list all documents for a specific user."""
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        err = _require_admin(request)
        if err:
            return err
        try:
            target = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        required = KYCDocument.VENDOR_DOCS if target.user_type == User.VENDOR else KYCDocument.CUSTOMER_DOCS
        uploaded = {d.doc_type: d for d in KYCDocument.objects.filter(user=target)}
        snaps_by_type = {}
        for snap in (
            KYCDocumentSupersededSnapshot.objects.filter(user=target)
            .select_related('reviewed_by')
            .order_by('-superseded_at')
        ):
            snaps_by_type.setdefault(snap.doc_type, []).append(snap)

        result = []
        for dt in required:
            if dt in uploaded:
                result.append(
                    _admin_doc_detail_dict(uploaded[dt], request, snaps_by_type.get(dt, []))
                )
            else:
                result.append({
                    'id': None,
                    'doc_type': dt,
                    'label': KYCDocument.DOC_TYPE_LABELS.get(dt, dt),
                    'file_url': None,
                    'original_filename': None,
                    'status': 'not_uploaded',
                    'rejection_reason': '',
                    'uploaded_at': None,
                    'reviewed_at': None,
                    'previous_verified_versions': [
                        _snapshot_to_dict(s, request) for s in snaps_by_type.get(dt, [])
                    ],
                })
        return Response(result)


class AdminDocumentReviewView(APIView):
    """Admin: verify or reject a single document."""
    permission_classes = [IsAuthenticated]

    def post(self, request, doc_id, action):
        err = _require_admin(request)
        if err:
            return err
        if action not in ('verify', 'reject'):
            return Response({'detail': 'Invalid action.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            doc = KYCDocument.objects.select_related('user').get(id=doc_id)
        except KYCDocument.DoesNotExist:
            return Response({'detail': 'Document not found.'}, status=status.HTTP_404_NOT_FOUND)

        doc.status = KYCDocument.DOC_VERIFIED if action == 'verify' else KYCDocument.DOC_REJECTED
        doc.rejection_reason = request.data.get('reason', '') if action == 'reject' else ''
        doc.reviewed_at = timezone.now()
        doc.reviewed_by = request.user
        doc.save()
        if action == 'reject':
            _suspend_account_verification_for_rereview(doc.user)

        return Response(_admin_doc_detail_dict(doc, request))


class AdminVerifyAllDocumentsView(APIView):
    """Admin: verify every pending KYC/KYB document for a user (one-click bulk)."""
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id):
        err = _require_admin(request)
        if err:
            return err
        try:
            target = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
        if target.user_type not in (User.CUSTOMER, User.VENDOR):
            return Response({'detail': 'Invalid user type.'}, status=status.HTTP_400_BAD_REQUEST)
        now = timezone.now()
        qs = KYCDocument.objects.filter(user=target, status=KYCDocument.DOC_PENDING)
        n = qs.update(
            status=KYCDocument.DOC_VERIFIED,
            reviewed_at=now,
            reviewed_by_id=request.user.id,
            rejection_reason='',
        )
        return Response({'detail': f'{n} document(s) verified.', 'verified_count': n})


class KYCDocumentFileView(APIView):
    """Authenticated download for KYC/KYB uploads (not public /media/)."""
    permission_classes = [IsAuthenticated]

    def get(self, request, doc_id):
        try:
            doc = KYCDocument.objects.select_related('user').get(id=doc_id)
        except KYCDocument.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if request.user.user_type != User.ADMIN and doc.user_id != request.user.id:
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        if not doc.file:
            return Response({'detail': 'No file.'}, status=status.HTTP_404_NOT_FOUND)
        name = (doc.original_filename or doc.file.name or '').split('/')[-1]
        guessed, _ = mimetypes.guess_type(name)
        content_type = guessed or 'application/octet-stream'
        return FileResponse(doc.file.open('rb'), content_type=content_type, as_attachment=False)


class KYCDocumentSupersededFileView(APIView):
    """Admin-only download for archived (previously verified) document files."""
    permission_classes = [IsAuthenticated]

    def get(self, request, snapshot_id):
        if request.user.user_type != User.ADMIN:
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            snap = KYCDocumentSupersededSnapshot.objects.select_related('user').get(id=snapshot_id)
        except KYCDocumentSupersededSnapshot.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not snap.file:
            return Response({'detail': 'No file.'}, status=status.HTTP_404_NOT_FOUND)
        name = (snap.original_filename or snap.file.name or '').split('/')[-1]
        guessed, _ = mimetypes.guess_type(name)
        content_type = guessed or 'application/octet-stream'
        return FileResponse(snap.file.open('rb'), content_type=content_type, as_attachment=False)


# ── Vendor pricing views ─────────────────────────────────────────

def _require_vendor(request):
    if request.user.user_type != User.VENDOR:
        return Response({'detail': 'Vendor access required.'}, status=status.HTTP_403_FORBIDDEN)
    return None


def _vendor_desk_trading_gate(user):
    """Live desk (incoming buy/sell requests) requires full KYB. Catalog CRUD does not."""
    c = vendor_compliance_verification(user)
    if not c['trading_allowed']:
        return Response(
            {
                'detail': 'Complete KYB verification before using the live trading desk.',
                'pending_items': c['pending_items'],
            },
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


_DEFAULT_GOLD_PURITY_OPTS = ['24K', '22K', '21K', '18K', '999.9', '999', '916']
_DEFAULT_SILVER_PURITY_OPTS = ['999', '999.9', '925', '958']

_GRAM_PURITY_FIELD_NAMES = (
    'gold_gram_rates_by_purity',
    'silver_gram_rates_by_purity',
    'platinum_gram_rates_by_purity',
    'palladium_gram_rates_by_purity',
    'gold_gram_buybacks_by_purity',
    'silver_gram_buybacks_by_purity',
    'platinum_gram_buybacks_by_purity',
    'palladium_gram_buybacks_by_purity',
)


def _coerce_gram_purity_map(raw):
    if not raw or not isinstance(raw, dict):
        return {}
    out = {}
    for k, v in raw.items():
        key = str(k).strip()
        if not key:
            continue
        if v is None or (isinstance(v, str) and not v.strip()):
            continue
        try:
            val = float(v)
        except (TypeError, ValueError):
            continue
        if val < 0 or val > 1e9:
            continue
        out[key] = val
    return out


def _gram_maps_for_api(cfg):
    d = {}
    for name in _GRAM_PURITY_FIELD_NAMES:
        m = getattr(cfg, name, None) or {}
        d[name] = _coerce_gram_purity_map(m) if isinstance(m, dict) else {}
    return d


def _pricing_to_dict(cfg):
    from cridora.spot_prices import get_spot_payload_raw_unmarginated, gold_rate_for_purity_tier, silver_rate_for_purity_tier
    from cridora.purity_pricing import coerce_purity_pricing_map

    gr = float(cfg.gold_rate)
    sr = float(cfg.silver_rate)
    g_opts = list(cfg.gold_purity_options) if cfg.gold_purity_options else _DEFAULT_GOLD_PURITY_OPTS
    s_opts = list(cfg.silver_purity_options) if cfg.silver_purity_options else _DEFAULT_SILVER_PURITY_OPTS

    raw = None
    gpp = coerce_purity_pricing_map(getattr(cfg, 'gold_purity_pricing', None))
    spp = coerce_purity_pricing_map(getattr(cfg, 'silver_purity_pricing', None))
    if cfg.use_home_spot_gold or cfg.use_home_spot_silver or any(
        isinstance(v, dict) and v.get('use_live') for v in gpp.values()
    ) or any(isinstance(v, dict) and v.get('use_live') for v in spp.values()):
        raw = get_spot_payload_raw_unmarginated()
    if raw and raw.get('gold') and cfg.use_home_spot_gold:
        v = gold_rate_for_purity_tier(raw['gold'], '24K')
        if v and v > 0:
            gr = v
    if raw and raw.get('silver') and cfg.use_home_spot_silver:
        v = silver_rate_for_purity_tier(raw['silver'], '999')
        if v and v > 0:
            sr = v

    spot_grams = None
    if raw and raw.get('gold') and raw.get('silver'):
        spot_grams = {'gold': raw['gold'], 'silver': raw['silver']}

    return {
        'gold_rate': gr,
        'silver_rate': sr,
        'platinum_rate': float(cfg.platinum_rate),
        'palladium_rate': float(cfg.palladium_rate),
        'gold_buyback_deduction': float(cfg.gold_buyback_deduction),
        'silver_buyback_deduction': float(cfg.silver_buyback_deduction),
        'platinum_buyback_deduction': float(cfg.platinum_buyback_deduction),
        'palladium_buyback_deduction': float(cfg.palladium_buyback_deduction),
        # Computed effective buyback rates
        'gold_effective_buyback': max(0.0, gr - float(cfg.gold_buyback_deduction)),
        'silver_effective_buyback': max(0.0, sr - float(cfg.silver_buyback_deduction)),
        'platinum_effective_buyback': max(0.0, float(cfg.platinum_rate) - float(cfg.platinum_buyback_deduction)),
        'palladium_effective_buyback': max(0.0, float(cfg.palladium_rate) - float(cfg.palladium_buyback_deduction)),
        'use_home_spot_gold': bool(cfg.use_home_spot_gold),
        'use_home_spot_silver': bool(cfg.use_home_spot_silver),
        'gold_purity_pricing': gpp,
        'silver_purity_pricing': spp,
        'spot_grams_unmarginated': spot_grams,
        'gold_purity_options': g_opts,
        'silver_purity_options': s_opts,
        'feed_url': cfg.feed_url,
        'feed_enabled': cfg.feed_enabled,
        'feed_auth_header': cfg.feed_auth_header,
        'feed_auth_value': cfg.feed_auth_value,
        'feed_gold_field': cfg.feed_gold_field,
        'feed_silver_field': cfg.feed_silver_field,
        'feed_platinum_field': cfg.feed_platinum_field,
        'feed_palladium_field': cfg.feed_palladium_field,
        'feed_last_fetched': str(cfg.feed_last_fetched)[:16] if cfg.feed_last_fetched else None,
        'feed_last_error': cfg.feed_last_error,
        'updated_at': str(cfg.updated_at)[:16],
        **_gram_maps_for_api(cfg),
    }


def _schema_mismatch_response(_exc=None):
    return Response(
        {
            'detail': (
                'Server database is out of date (missing columns). On Railway, run release migrations: '
                'python manage.py migrate --noinput'
            ),
            'code': 'schema_mismatch',
        },
        status=status.HTTP_503_SERVICE_UNAVAILABLE,
    )


class VendorPricingView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_vendor(request)
        if err:
            return err
        try:
            cfg, _ = VendorPricingConfig.objects.get_or_create(user=request.user)
            return Response(_pricing_to_dict(cfg))
        except (ProgrammingError, OperationalError):
            return _schema_mismatch_response(None)

    def post(self, request):
        err = _require_vendor(request)
        if err:
            return err
        try:
            cfg, _ = VendorPricingConfig.objects.get_or_create(user=request.user)
        except (ProgrammingError, OperationalError):
            return _schema_mismatch_response(None)
        fields = [
            'use_home_spot_gold', 'use_home_spot_silver',
            'gold_rate', 'silver_rate', 'platinum_rate', 'palladium_rate',
            'gold_buyback_deduction', 'silver_buyback_deduction',
            'platinum_buyback_deduction', 'palladium_buyback_deduction',
            'feed_url', 'feed_enabled', 'feed_auth_header', 'feed_auth_value',
            'feed_gold_field', 'feed_silver_field', 'feed_platinum_field', 'feed_palladium_field',
        ]
        for f in fields:
            if f not in request.data:
                continue
            setattr(cfg, f, request.data[f])
        d = request.data
        if 'gold_purity_options' in d:
            val = d['gold_purity_options']
            cfg.gold_purity_options = [str(x).strip() for x in (val or []) if str(x).strip()]
        if 'silver_purity_options' in d:
            val = d['silver_purity_options']
            cfg.silver_purity_options = [str(x).strip() for x in (val or []) if str(x).strip()]
        if 'gold_purity_pricing' in d or 'silver_purity_pricing' in d:
            from cridora.purity_pricing import coerce_purity_pricing_map
            if 'gold_purity_pricing' in d:
                cfg.gold_purity_pricing = coerce_purity_pricing_map(d.get('gold_purity_pricing'))
            if 'silver_purity_pricing' in d:
                cfg.silver_purity_pricing = coerce_purity_pricing_map(d.get('silver_purity_pricing'))
            gpp = cfg.gold_purity_pricing or {}
            spp = cfg.silver_purity_pricing or {}
            cfg.use_home_spot_gold = any(
                isinstance(v, dict) and v.get('use_live') for v in (gpp.values() if isinstance(gpp, dict) else [])
            )
            cfg.use_home_spot_silver = any(
                isinstance(v, dict) and v.get('use_live') for v in (spp.values() if isinstance(spp, dict) else [])
            )
        for fname in _GRAM_PURITY_FIELD_NAMES:
            if fname in d:
                setattr(cfg, fname, _coerce_gram_purity_map(d.get(fname)))
        try:
            cfg.save()
        except (ProgrammingError, OperationalError):
            return _schema_mismatch_response(None)
        CatalogProduct.objects.filter(vendor=request.user, use_live_rate=True).update(updated_at=timezone.now())
        return Response(_pricing_to_dict(cfg))


class VendorPriceFeedFetchView(APIView):
    """Fetch rates from the vendor's external API and update their config."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        err = _require_vendor(request)
        if err:
            return err
        try:
            cfg, _ = VendorPricingConfig.objects.get_or_create(user=request.user)
        except (ProgrammingError, OperationalError):
            return _schema_mismatch_response(None)

        url = request.data.get('feed_url') or cfg.feed_url
        if not url:
            return Response({'detail': 'No feed URL configured.'}, status=status.HTTP_400_BAD_REQUEST)

        headers = {'Accept': 'application/json'}
        if cfg.feed_auth_header and cfg.feed_auth_value:
            headers[cfg.feed_auth_header] = cfg.feed_auth_value

        try:
            resp = http_requests.get(url, headers=headers, timeout=8)
            resp.raise_for_status()
            data = resp.json()
        except http_requests.exceptions.Timeout:
            cfg.feed_last_error = 'Request timed out after 8s'
            cfg.save(update_fields=['feed_last_error'])
            return Response({'detail': cfg.feed_last_error}, status=status.HTTP_502_BAD_GATEWAY)
        except Exception as e:
            cfg.feed_last_error = str(e)[:300]
            cfg.save(update_fields=['feed_last_error'])
            return Response({'detail': cfg.feed_last_error}, status=status.HTTP_502_BAD_GATEWAY)

        def _get_nested(obj, path):
            for key in str(path).split('.'):
                if isinstance(obj, dict):
                    obj = obj.get(key)
                else:
                    return None
            return obj

        updated = {}
        for metal, field_attr in [
            ('gold', 'feed_gold_field'), ('silver', 'feed_silver_field'),
            ('platinum', 'feed_platinum_field'), ('palladium', 'feed_palladium_field'),
        ]:
            field_path = getattr(cfg, field_attr, '')
            if field_path:
                val = _get_nested(data, field_path)
                if val is not None:
                    try:
                        setattr(cfg, f'{metal}_rate', float(val))
                        updated[metal] = float(val)
                    except (TypeError, ValueError):
                        pass

        cfg.feed_last_fetched = timezone.now()
        cfg.feed_last_error = ''
        cfg.save()
        CatalogProduct.objects.filter(vendor=request.user, use_live_rate=True).update(updated_at=timezone.now())

        return Response({
            'detail': f'Feed fetched. Updated: {list(updated.keys()) or "none (check field mappings)"}',
            'updated_rates': updated,
            'pricing': _pricing_to_dict(cfg),
        })


# ── Type-safe coercion helpers (FormData sends everything as strings) ──

_TRUE_VALS = {'true', '1', 'yes', 'on'}
_FALSE_VALS = {'false', '0', 'no', 'off'}

def _safe_bool(val, default=False):
    if isinstance(val, bool):
        return val
    if val is None:
        return default
    s = str(val).lower().strip()
    if s in _TRUE_VALS:
        return True
    if s in _FALSE_VALS:
        return False
    return default

def _safe_float(val, default=0.0):
    if val is None or val == '':
        return default
    try:
        return float(val)
    except (TypeError, ValueError):
        return default

def _safe_int(val, default=0):
    if val is None or val == '':
        return default
    try:
        return int(float(val))
    except (TypeError, ValueError):
        return default


# ── Vendor catalog views ──────────────────────────────────────────

def _absolute_media_url(request, relative_path):
    """Browser-loadable URL for files under MEDIA_URL (e.g. /media/catalog_images/...)."""
    if not relative_path:
        return None
    from django.conf import settings as dj_settings
    p = str(relative_path).replace('\\', '/')
    if not p.startswith('/'):
        p = f'/{p}'
    public = getattr(dj_settings, 'PUBLIC_BASE_URL', '') or ''
    if public:
        return f'{public.rstrip("/")}{p}'
    if request:
        return request.build_absolute_uri(p)
    return p


def _product_to_dict(p, request=None):
    # Relative /media/... only — the SPA prepends the configured API origin (VITE / window).
    # Avoids broken absolute URLs from proxy Host / DJANGO_PUBLIC_BASE_URL mismatch on Railway.
    image_url = p.image.url if p.image else None
    return {
        'id': p.id,
        'name': p.name,
        'metal': p.metal,
        'weight': float(p.weight_grams),
        'purity': p.purity,
        'use_live_rate': p.use_live_rate,
        'manual_rate_per_gram': float(p.manual_rate_per_gram),
        'buyback_per_gram': float(p.buyback_per_gram),
        'packaging_fee': float(p.packaging_fee),
        'storage_fee': float(p.storage_fee),
        'insurance_fee': float(p.insurance_fee),
        'vat_pct': float(p.vat_pct),
        'vat_inclusive': p.vat_inclusive,
        'in_stock': p.in_stock,
        'visible': p.visible,
        'stock_qty': p.stock_qty,
        'image_url': image_url,
        'effective_rate': p.effective_rate(),
        'effective_buyback_per_gram': p.effective_buyback_per_gram(),
        'final_price': p.final_price(),
        'final_rate_per_gram': p.final_rate_per_gram(),
    }


def _copy_staging_image_to_product(product, staging):
    with staging.image.open('rb') as f:
        name = os.path.basename(staging.image.name) or 'product.jpg'
        product.image.save(name, ContentFile(f.read()), save=False)
    staging.delete()


def _get_catalog_staging_for_vendor(request, staging_id, allow_with_upload):
    if not staging_id or allow_with_upload:
        return None
    try:
        return CatalogStagingImage.objects.get(id=staging_id, vendor=request.user)
    except CatalogStagingImage.DoesNotExist:
        return None


_CATALOG_IMAGE_MAX_BYTES = 5 * 1024 * 1024
_CATALOG_IMAGE_EXTS = ('.jpg', '.jpeg', '.png', '.webp')
_CATALOG_IMAGE_OK_TYPES = {
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
    'image/pjpeg', 'image/x-png',
}
_CATALOG_PIL_FORMATS = frozenset({'JPEG', 'PNG', 'WEBP', 'MPO'})


def _pil_validate_catalog_image(data: bytes):
    """
    Ensure bytes are a decodable image in an allowed format (JPEG, PNG, WebP).
    Rejects wrong formats, empty files, and mislabeled HEIC/others.
    """
    if not data:
        return False, 'Image file is empty.'
    if len(data) > _CATALOG_IMAGE_MAX_BYTES:
        return False, 'Image must be 5MB or smaller.'
    from PIL import Image, UnidentifiedImageError

    try:
        with Image.open(BytesIO(data)) as im:
            im.load()
            fmt = (im.format or '').upper()
    except (UnidentifiedImageError, OSError, ValueError):
        return (
            False,
            'File is not a valid JPEG, PNG, or WebP image, or is corrupted. '
            'HEIC, GIF, SVG, and other formats are not supported.',
        )
    if fmt not in _CATALOG_PIL_FORMATS:
        return (
            False,
            f'Image format {fmt or "?"} is not allowed. Use JPEG, PNG, or WebP only.',
        )
    return True, None


def _validate_catalog_image_upload(f):
    """
    Size, extension, MIME hint, and Pillow decode. Resets file read pointer for save().
    Browsers may send image/jpg, application/octet-stream, or empty Content-Type.
    """
    if getattr(f, 'size', None) is not None and f.size > _CATALOG_IMAGE_MAX_BYTES:
        return False, 'Image must be 5MB or smaller.'
    name = (getattr(f, 'name', '') or '').lower()
    ext_ok = any(name.endswith(s) for s in _CATALOG_IMAGE_EXTS)
    if not ext_ok:
        return False, 'File name must end with .jpg, .jpeg, .png, or .webp (HEIC and other types are not supported).'
    ct = (getattr(f, 'content_type', None) or '').strip().lower()
    if ct and ct not in _CATALOG_IMAGE_OK_TYPES and ct != 'application/octet-stream':
        if not ct.startswith('image/'):
            return False, 'Only image uploads are allowed. Use a JPG, PNG, or WebP file.'
    try:
        data = f.read()
    except Exception as e:
        return False, f'Could not read upload: {e}'[:200]
    if hasattr(f, 'seek'):
        f.seek(0)
    if len(data) > _CATALOG_IMAGE_MAX_BYTES:
        return False, 'Image must be 5MB or smaller.'
    ok, err = _pil_validate_catalog_image(data)
    if not ok:
        return False, err
    return True, None


class VendorCatalogStagingImageView(APIView):
    """Upload a catalog image to server storage; returns URL for preview before product save."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        err = _require_vendor(request)
        if err:
            return err
        if 'image' not in request.FILES:
            return Response({'detail': 'No image file (field name "image" required).'}, status=status.HTTP_400_BAD_REQUEST)
        f = request.FILES['image']
        ok, msg = _validate_catalog_image_upload(f)
        if not ok:
            return Response({'detail': msg}, status=status.HTTP_400_BAD_REQUEST)
        try:
            CatalogStagingImage.objects.filter(vendor=request.user).delete()
            s = CatalogStagingImage.objects.create(vendor=request.user, image=f)
        except Exception as e:
            return Response({'detail': str(e)[:500]}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {
                'staging_id': s.id,
                'image_url': s.image.url,
            },
            status=status.HTTP_201_CREATED,
        )


class VendorCatalogStagingImageDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        err = _require_vendor(request)
        if err:
            return err
        n, _ = CatalogStagingImage.objects.filter(id=pk, vendor=request.user).delete()
        if not n:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


class VendorCatalogView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_vendor(request)
        if err:
            return err
        products = CatalogProduct.objects.filter(vendor=request.user)
        return Response([_product_to_dict(p, request) for p in products])

    def post(self, request):
        err = _require_vendor(request)
        if err:
            return err
        d = request.data
        staging_id = _safe_int(d.get('staging_id') or 0, 0)
        staging = _get_catalog_staging_for_vendor(request, staging_id, 'image' in request.FILES)
        if 'image' in request.FILES:
            ok, msg = _validate_catalog_image_upload(request.FILES['image'])
            if not ok:
                return Response({'detail': msg}, status=status.HTTP_400_BAD_REQUEST)
        try:
            p = CatalogProduct.objects.create(
                vendor=request.user,
                name=d.get('name', ''),
                metal=d.get('metal', 'gold'),
                weight_grams=_safe_float(d.get('weight') or d.get('weight_grams'), 0),
                purity=d.get('purity', '999.9'),
                use_live_rate=_safe_bool(d.get('use_live_rate'), True),
                manual_rate_per_gram=_safe_float(d.get('manual_rate_per_gram'), 0),
                buyback_per_gram=_safe_float(d.get('buyback_per_gram'), 0),
                packaging_fee=_safe_float(d.get('packaging_fee'), 0),
                storage_fee=_safe_float(d.get('storage_fee'), 0),
                insurance_fee=_safe_float(d.get('insurance_fee'), 0),
                vat_pct=_safe_float(d.get('vat_pct'), 0),
                vat_inclusive=_safe_bool(d.get('vat_inclusive'), False),
                in_stock=_safe_bool(d.get('in_stock'), True),
                visible=_safe_bool(d.get('visible'), True),
                stock_qty=_safe_int(d.get('stock_qty'), 0),
            )
            if p.stock_qty > 0:
                p.in_stock = True
            if 'image' in request.FILES:
                p.image = request.FILES['image']
            elif staging:
                _copy_staging_image_to_product(p, staging)
            p.save()
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(_product_to_dict(p, request), status=status.HTTP_201_CREATED)


class VendorCatalogDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_product(self, request, pk):
        try:
            return CatalogProduct.objects.get(id=pk, vendor=request.user)
        except CatalogProduct.DoesNotExist:
            return None

    def put(self, request, pk):
        err = _require_vendor(request)
        if err:
            return err
        p = self._get_product(request, pk)
        if not p:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        d = request.data
        staging_id = _safe_int(d.get('staging_id') or 0, 0)
        staging = _get_catalog_staging_for_vendor(request, staging_id, 'image' in request.FILES)
        if 'image' in request.FILES:
            ok, msg = _validate_catalog_image_upload(request.FILES['image'])
            if not ok:
                return Response({'detail': msg}, status=status.HTTP_400_BAD_REQUEST)
        try:
            if 'name' in d:
                p.name = d['name']
            if 'metal' in d:
                p.metal = d['metal']
            if 'purity' in d:
                p.purity = d['purity']
            if 'use_live_rate' in d:
                p.use_live_rate = _safe_bool(d['use_live_rate'], p.use_live_rate)
            if 'in_stock' in d:
                p.in_stock = _safe_bool(d['in_stock'], p.in_stock)
            if 'visible' in d:
                p.visible = _safe_bool(d['visible'], p.visible)
            if 'vat_inclusive' in d:
                p.vat_inclusive = _safe_bool(d['vat_inclusive'], p.vat_inclusive)
            if 'stock_qty' in d:
                p.stock_qty = _safe_int(d['stock_qty'], p.stock_qty)
            weight_val = d.get('weight') or d.get('weight_grams')
            if weight_val is not None:
                p.weight_grams = _safe_float(weight_val, p.weight_grams)
            for f in ['manual_rate_per_gram', 'buyback_per_gram', 'packaging_fee',
                      'storage_fee', 'insurance_fee', 'vat_pct']:
                if f in d:
                    setattr(p, f, _safe_float(d[f], getattr(p, f)))
            if 'image' in request.FILES:
                p.image = request.FILES['image']
            elif staging:
                _copy_staging_image_to_product(p, staging)
            if p.stock_qty > 0:
                p.in_stock = True
            p.save()
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(_product_to_dict(p, request))

    def delete(self, request, pk):
        err = _require_vendor(request)
        if err:
            return err
        p = self._get_product(request, pk)
        if not p:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        p.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Public marketplace view ───────────────────────────────────────

class PublicMarketplaceView(APIView):
    """Returns all visible, in-stock catalog products for the marketplace. No auth required."""
    permission_classes = [AllowAny]

    def get(self, request):
        products = (
            CatalogProduct.objects
            .filter(visible=True, in_stock=True, vendor__kyc_status=User.KYC_VERIFIED)
            .select_related('vendor', 'vendor__pricing_config', 'vendor__schedule')
            .order_by('-created_at')
        )
        result = []
        for p in products:
            d = _product_to_dict(p, request)
            d['vendor_name'] = p.vendor.vendor_company or p.vendor.get_full_name() or p.vendor.email
            d['vendor_verified'] = True
            d['source'] = 'live'
            try:
                d['is_open'] = p.vendor.schedule.is_open_now()
            except VendorSchedule.DoesNotExist:
                d['is_open'] = True
            result.append(d)
        cfg = PlatformConfig.get()
        return Response({
            'items': result,
            'buy_fee_pct': float(cfg.buy_fee_pct),
            'quote_ttl_seconds': int(cfg.quote_ttl_seconds),
        })


class PublicVerifiedVendorsView(APIView):
    """KYB-verified vendors for public marketing pages (name, country, optional intro)."""
    permission_classes = [AllowAny]

    def get(self, request):
        rows = (
            User.objects.filter(
                user_type=User.VENDOR,
                kyc_status=User.KYC_VERIFIED,
                is_active=True,
            )
            .order_by('vendor_company', 'id')
        )
        out = []
        for u in rows:
            name = (u.vendor_company or '').strip() or (
                f"{(u.first_name or '').strip()} {(u.last_name or '').strip()}".strip()
            ) or (u.email or '')
            out.append({
                'id': u.id,
                'vendor_company': name,
                'vendor_description': (u.vendor_description or '').strip(),
                'country': (u.country or '').strip(),
                'logo_url': u.vendor_logo.url if u.vendor_logo else None,
            })
        return Response({'vendors': out})


# ── Customer profile update view ──────────────────────────────────

class UpdateProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        user = request.user
        d = request.data
        fields = []
        if 'first_name' in d:
            user.first_name = str(d['first_name']).strip()
            fields.append('first_name')
        if 'last_name' in d:
            user.last_name = str(d['last_name']).strip()
            fields.append('last_name')
        if 'phone' in d:
            user.phone = str(d['phone']).strip()
            fields.append('phone')
        if 'country' in d:
            user.country = str(d['country']).strip()
            fields.append('country')
        if user.user_type == User.VENDOR and 'vendor_description' in d:
            user.vendor_description = str(d.get('vendor_description') or '')[:2000]
            fields.append('vendor_description')
        if fields:
            user.save(update_fields=fields)
        body = {
            'first_name': user.first_name,
            'last_name': user.last_name,
            'email': user.email,
            'phone': user.phone,
            'country': user.country,
        }
        if user.user_type == User.VENDOR:
            body['vendor_description'] = user.vendor_description
            body['vendor_logo_url'] = user.vendor_logo.url if user.vendor_logo else None
        return Response(body)


class VendorLogoView(APIView):
    """POST multipart logo (field logo or image); DELETE removes logo. Vendor only. Same rules as catalog images."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        err = _require_vendor(request)
        if err:
            return err
        f = request.FILES.get('logo') or request.FILES.get('image')
        if not f:
            return Response(
                {'detail': 'No image file. Use field name "logo" or "image".'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ok, msg = _validate_catalog_image_upload(f)
        if not ok:
            return Response({'detail': msg}, status=status.HTTP_400_BAD_REQUEST)
        u = request.user
        data = f.read()
        if len(data) > _CATALOG_IMAGE_MAX_BYTES:
            return Response({'detail': 'Image must be 5MB or smaller.'}, status=status.HTTP_400_BAD_REQUEST)
        raw_name = (getattr(f, 'name', '') or 'logo.jpg').lower()
        ext = os.path.splitext(raw_name)[1] if raw_name else ''
        if ext not in _CATALOG_IMAGE_EXTS:
            ext = '.jpg'
        safe = f'logo{ext}'
        if u.vendor_logo:
            u.vendor_logo.delete(save=False)
        u.vendor_logo.save(safe, ContentFile(data), save=True)
        return Response({'vendor_logo_url': u.vendor_logo.url})

    def delete(self, request):
        err = _require_vendor(request)
        if err:
            return err
        u = request.user
        if u.vendor_logo:
            u.vendor_logo.delete(save=True)
        return Response({'vendor_logo_url': None})


# ── Customer bank details views ───────────────────────────────────

def _bank_to_dict(bank):
    return {
        'account_name': bank.account_name,
        'bank_name': bank.bank_name,
        'account_number': bank.account_number,
        'ifsc': bank.ifsc,
        'status': bank.status,
        'updated_at': str(bank.updated_at)[:16],
    }


class CustomerBankDetailsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.CUSTOMER:
            return Response({'detail': 'Customer access required.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            bank = request.user.bank_details
            return Response(_bank_to_dict(bank))
        except CustomerBankDetails.DoesNotExist:
            return Response({
                'account_name': '', 'bank_name': '', 'account_number': '',
                'ifsc': '', 'status': 'not_added', 'updated_at': None,
            })

    def post(self, request):
        if request.user.user_type != User.CUSTOMER:
            return Response({'detail': 'Customer access required.'}, status=status.HTTP_403_FORBIDDEN)
        d = request.data
        bank, _ = CustomerBankDetails.objects.get_or_create(user=request.user)
        bank.account_name = str(d.get('account_name', bank.account_name)).strip()
        bank.bank_name = str(d.get('bank_name', bank.bank_name)).strip()
        bank.account_number = str(d.get('account_number', bank.account_number)).strip()
        bank.ifsc = str(d.get('ifsc', bank.ifsc)).strip()
        bank.status = CustomerBankDetails.PENDING
        bank.save()
        if request.user.kyc_status == User.KYC_REJECTED:
            request.user.kyc_status = User.KYC_PENDING
            request.user.save(update_fields=['kyc_status'])
        else:
            _suspend_account_verification_for_rereview(request.user)
        return Response(_bank_to_dict(bank))


# ── Admin platform fee config view ───────────────────────────────

def _config_to_dict(cfg):
    return {
        'buy_fee_pct':               float(cfg.buy_fee_pct),
        'sell_fee_pct':              float(cfg.sell_fee_pct),
        'sell_share_pct':            float(cfg.sell_share_pct),
        'quote_ttl_seconds':         int(cfg.quote_ttl_seconds),
        'vendor_accept_ttl_seconds': int(cfg.vendor_accept_ttl_seconds),
        'home_spot_display_margin_pct': float(getattr(cfg, 'home_spot_display_margin_pct', 0) or 0),
    }


class AdminPlatformFeeView(APIView):
    permission_classes = [IsAuthenticated]

    def _require_admin(self, request):
        if request.user.user_type != User.ADMIN:
            return Response({'detail': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)
        return None

    def get(self, request):
        err = self._require_admin(request)
        if err:
            return err
        return Response(_config_to_dict(PlatformConfig.get()))

    def patch(self, request):
        err = self._require_admin(request)
        if err:
            return err
        cfg = PlatformConfig.get()
        d = request.data
        decimal_fields = ('buy_fee_pct', 'sell_fee_pct', 'sell_share_pct', 'home_spot_display_margin_pct')
        int_fields = ('quote_ttl_seconds', 'vendor_accept_ttl_seconds')
        for field in decimal_fields:
            if field in d:
                try:
                    val = float(d[field])
                    if field == 'home_spot_display_margin_pct' and (val < -100 or val > 500.0):
                        return Response(
                            {'detail': 'home_spot_display_margin_pct must be between -100 and 500.'},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    setattr(cfg, field, val)
                except (ValueError, TypeError):
                    return Response({'detail': f'Invalid {field}.'}, status=status.HTTP_400_BAD_REQUEST)
        for field in int_fields:
            if field in d:
                try:
                    val = int(d[field])
                    if val < 5:
                        return Response({'detail': f'{field} must be at least 5 seconds.'}, status=status.HTTP_400_BAD_REQUEST)
                    setattr(cfg, field, val)
                except (ValueError, TypeError):
                    return Response({'detail': f'Invalid {field}.'}, status=status.HTTP_400_BAD_REQUEST)
        cfg.save()
        return Response(_config_to_dict(cfg))


# ── Admin bank details review view ───────────────────────────────

class AdminBankDetailsView(APIView):
    permission_classes = [IsAuthenticated]

    def _require_admin(self, request):
        if request.user.user_type != User.ADMIN:
            return Response({'detail': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)
        return None

    def _get_bank(self, user_id):
        try:
            target = User.objects.get(id=user_id, user_type=User.CUSTOMER)
        except User.DoesNotExist:
            return None, None
        try:
            return target, target.bank_details
        except CustomerBankDetails.DoesNotExist:
            return target, None

    def get(self, request, user_id):
        err = self._require_admin(request)
        if err:
            return err
        _, bank = self._get_bank(user_id)
        if bank is None:
            return Response({'status': 'not_added'})
        return Response(_bank_to_dict(bank))

    def post(self, request, user_id, action):
        err = self._require_admin(request)
        if err:
            return err
        if action not in ('verify', 'reject'):
            return Response({'detail': 'Invalid action.'}, status=status.HTTP_400_BAD_REQUEST)
        target, bank = self._get_bank(user_id)
        if bank is None:
            return Response({'detail': 'No bank details found for this user.'}, status=status.HTTP_404_NOT_FOUND)
        bank.status = CustomerBankDetails.VERIFIED if action == 'verify' else CustomerBankDetails.REJECTED
        bank.save(update_fields=['status'])
        if action == 'reject':
            _suspend_account_verification_for_rereview(target)
        return Response(_bank_to_dict(bank))


# ── Order helpers ────────────────────────────────────────────────

def _order_to_customer_dict(order):
    now = timezone.now()
    expires_in = max(0, int((order.expires_at - now).total_seconds()))
    return {
        'id': order.id,
        'order_ref': order.order_ref,
        'product_id': order.product_id,
        'product_name': order.product.name,
        'metal': order.product.metal,
        'vendor_name': order.product.vendor.vendor_company or order.product.vendor.email,
        'qty_units': order.qty_units,
        'qty_grams': float(order.qty_grams),
        'rate_per_gram': float(order.rate_per_gram),
        'buyback_per_gram': float(order.buyback_per_gram),
        'platform_fee_aed': float(order.platform_fee_aed),
        'total_aed': float(order.total_aed),
        'status': order.status,
        'expires_in': expires_in,
        'created_at': str(order.created_at)[:19].replace('T', ' '),
        'expires_at': str(order.expires_at)[:19].replace('T', ' '),
    }


def _order_to_vendor_dict(order):
    now = timezone.now()
    remaining = max(0, int((order.expires_at - now).total_seconds()))
    return {
        'id': order.id,
        'order_ref': order.order_ref,
        'customer': f"{order.customer.first_name} {order.customer.last_name}".strip() or order.customer.email,
        'product': order.product.name,
        'metal': order.product.metal,
        'qty_units': order.qty_units,
        'qty_grams': float(order.qty_grams),
        'price_aed': float(order.total_aed),
        'platform_fee_aed': float(order.platform_fee_aed),
        'expires_in': remaining,
        'created_at': str(order.created_at)[:19].replace('T', ' '),
        'status': order.status,
    }


# ── Customer order views ──────────────────────────────────────────

class CustomerPlaceOrderView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.user_type != User.CUSTOMER:
            return Response({'detail': 'Customer access required.'}, status=status.HTTP_403_FORBIDDEN)
        c = customer_compliance_verification(request.user)
        if not c['trading_allowed']:
            return Response(
                {
                    'detail': 'Complete KYC (documents and verified bank account) before placing orders.',
                    'pending_items': c['pending_items'],
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        d = request.data
        product_id = d.get('product_id')
        qty = int(d.get('qty', 1))
        if not product_id or qty < 1:
            return Response({'detail': 'product_id and qty are required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            product = CatalogProduct.objects.select_related('vendor', 'vendor__pricing_config').get(
                id=product_id, visible=True, in_stock=True,
            )
        except CatalogProduct.DoesNotExist:
            return Response({'detail': 'Product not found or unavailable.'}, status=status.HTTP_404_NOT_FOUND)

        cfg = PlatformConfig.get()
        metal_rate = product.effective_rate()
        rate = product.final_rate_per_gram()
        weight = float(product.weight_grams)
        qty_grams = weight * qty
        metal_total = rate * qty_grams
        platform_fee = round(metal_total * float(cfg.buy_fee_pct) / 100, 2)
        total = round(metal_total + platform_fee, 2)
        buyback = product.effective_buyback_per_gram()
        expires_at = timezone.now() + timedelta(seconds=int(cfg.vendor_accept_ttl_seconds))

        # metal_rate_per_gram must always be a positive stored value so that the
        # purchase rate in a customer's portfolio never changes after order creation.
        # Use the all-in rate_per_gram as a floor if effective_rate() returned 0.
        stored_metal_rate = metal_rate if metal_rate > 0 else rate

        order = Order.objects.create(
            customer=request.user,
            product=product,
            qty_units=qty,
            qty_grams=qty_grams,
            rate_per_gram=rate,
            metal_rate_per_gram=stored_metal_rate,
            buyback_per_gram=buyback,
            platform_fee_aed=platform_fee,
            total_aed=total,
            status=Order.PENDING_VENDOR,
            expires_at=expires_at,
        )
        return Response(_order_to_customer_dict(order), status=status.HTTP_201_CREATED)


class CustomerOrderView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_order(self, request, order_id):
        try:
            return Order.objects.select_related('product', 'product__vendor').get(
                id=order_id, customer=request.user,
            )
        except Order.DoesNotExist:
            return None

    def get(self, request, order_id):
        if request.user.user_type != User.CUSTOMER:
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        order = self._get_order(request, order_id)
        if not order:
            return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(_order_to_customer_dict(order))

    def post(self, request, order_id):
        if request.user.user_type != User.CUSTOMER:
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        c_pay = customer_compliance_verification(request.user)
        if not c_pay['trading_allowed']:
            return Response(
                {
                    'detail': 'Complete KYC (documents and verified bank account) before completing payment.',
                    'pending_items': c_pay['pending_items'],
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        with transaction.atomic():
            try:
                order = Order.objects.select_for_update().select_related(
                    'product', 'product__vendor',
                ).get(id=order_id, customer=request.user)
            except Order.DoesNotExist:
                return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)
            if order.status == Order.EXPIRED:
                return Response({'detail': 'Order has expired.'}, status=status.HTTP_400_BAD_REQUEST)
            if order.status == Order.REJECTED:
                return Response({'detail': 'Order was rejected by the vendor.'}, status=status.HTTP_400_BAD_REQUEST)
            if order.status != Order.VENDOR_ACCEPTED:
                return Response(
                    {'detail': 'Payment is not available yet — waiting for vendor approval.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            product = order.product
            if product.stock_qty < order.qty_units:
                return Response(
                    {
                        'detail': 'Insufficient stock to complete this order. Contact support or wait for the vendor to restock.',
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            product.stock_qty -= order.qty_units
            if product.stock_qty == 0:
                product.in_stock = False
            product.save(update_fields=['stock_qty', 'in_stock'])
            order.status = Order.PAID
            order.save(update_fields=['status'])
        return Response(_order_to_customer_dict(order))


# ── Vendor order views ────────────────────────────────────────────

class VendorPendingOrdersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.VENDOR:
            return Response({'detail': 'Vendor access required.'}, status=status.HTTP_403_FORBIDDEN)
        gate = _vendor_desk_trading_gate(request.user)
        if gate:
            return gate
        now = timezone.now()
        Order.objects.filter(
            product__vendor=request.user,
            status=Order.PENDING_VENDOR,
            expires_at__lt=now,
        ).update(status=Order.EXPIRED)
        orders = Order.objects.filter(
            product__vendor=request.user,
            status=Order.PENDING_VENDOR,
        ).select_related('customer', 'product').order_by('expires_at')
        return Response([_order_to_vendor_dict(o) for o in orders])


class VendorOrderActionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, order_id, action):
        if request.user.user_type != User.VENDOR:
            return Response({'detail': 'Vendor access required.'}, status=status.HTTP_403_FORBIDDEN)
        if action not in ('accept', 'reject'):
            return Response({'detail': 'Invalid action.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            order = Order.objects.get(id=order_id, product__vendor=request.user)
        except Order.DoesNotExist:
            return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)
        if order.status != Order.PENDING_VENDOR:
            return Response({'detail': f'Order cannot be actioned (status: {order.status}).'}, status=status.HTTP_400_BAD_REQUEST)
        gate = _vendor_desk_trading_gate(request.user)
        if gate:
            return gate
        order.status = Order.VENDOR_ACCEPTED if action == 'accept' else Order.REJECTED
        order.save(update_fields=['status'])
        return Response(_order_to_vendor_dict(order))


# ── Vendor portfolio view ─────────────────────────────────────────

class VendorPortfolioView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.VENDOR:
            return Response({'detail': 'Vendor access required.'}, status=status.HTTP_403_FORBIDDEN)

        user = request.user
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        orders = (
            Order.objects
            .filter(product__vendor=user)
            .select_related('customer', 'product')
            .order_by('-created_at')
        )

        total = orders.count()
        accepted_qs   = [o for o in orders if o.status == Order.PAID]
        accepted_count = len(accepted_qs)
        revenue = sum(float(o.total_aed) for o in accepted_qs)
        platform_fees_collected = sum(float(o.platform_fee_aed) for o in accepted_qs)

        today_paid  = [o for o in accepted_qs if o.created_at >= today_start]
        today_revenue = sum(float(o.total_aed) for o in today_paid)
        today_orders_count = len([o for o in orders if o.created_at >= today_start])

        # Sell order data
        all_sell_orders = list(
            SellOrder.objects
            .filter(buy_order__product__vendor=user)
            .select_related('customer', 'buy_order__product')
            .order_by('-created_at')
        )
        completed_sells   = [so for so in all_sell_orders if so.status == SellOrder.COMPLETED]
        pending_sells     = [so for so in all_sell_orders if so.status == SellOrder.PENDING_VENDOR]
        total_sellbacks   = sum(float(so.net_payout_aed) for so in completed_sells)
        today_sellbacks   = sum(float(so.net_payout_aed) for so in completed_sells if so.updated_at >= today_start)

        counts = {
            'accepted': accepted_count,
            'rejected': sum(1 for o in orders if o.status == Order.REJECTED),
            'expired':  sum(1 for o in orders if o.status == Order.EXPIRED),
            'pending':  sum(1 for o in orders if o.status in (Order.PENDING_VENDOR, Order.VENDOR_ACCEPTED)),
        }

        metal_revenue = {}
        metal_units   = {}
        for o in accepted_qs:
            m = o.product.metal
            metal_revenue[m] = round(metal_revenue.get(m, 0) + float(o.total_aed), 2)
            metal_units[m]   = round(metal_units.get(m, 0)   + float(o.qty_grams), 4)

        product_stats = {}
        for o in accepted_qs:
            pid = o.product_id
            if pid not in product_stats:
                product_stats[pid] = {
                    'name': o.product.name, 'metal': o.product.metal,
                    'orders': 0, 'revenue': 0, 'grams': 0,
                }
            product_stats[pid]['orders']  += 1
            product_stats[pid]['revenue']  = round(product_stats[pid]['revenue'] + float(o.total_aed), 2)
            product_stats[pid]['grams']    = round(product_stats[pid]['grams']   + float(o.qty_grams), 4)

        recent_buy = [{
            'type': 'BUY',
            'id': o.id,
            'order_ref': o.order_ref,
            'customer': f"{o.customer.first_name} {o.customer.last_name}".strip() or o.customer.email,
            'product': o.product.name,
            'metal': o.product.metal,
            'qty_grams': float(o.qty_grams),
            'total_aed': float(o.total_aed),
            'status': o.status,
            'created_at': str(o.created_at)[:10],
        } for o in orders[:15]]
        recent_sell = [{
            'type': 'SELL',
            'id': so.id,
            'order_ref': so.order_ref,
            'customer': so.customer.get_full_name() or so.customer.email,
            'product': so.buy_order.product.name,
            'metal': so.buy_order.product.metal,
            'qty_grams': float(so.qty_grams),
            'total_aed': float(so.net_payout_aed),
            'status': so.status,
            'created_at': str(so.created_at)[:10],
        } for so in all_sell_orders[:15]]
        recent = sorted(recent_buy + recent_sell, key=lambda x: x['created_at'], reverse=True)[:20]

        # Catalog / inventory snapshot
        products_qs = CatalogProduct.objects.filter(vendor=user)
        active_products   = products_qs.filter(visible=True, in_stock=True).count()
        low_stock_products = products_qs.filter(visible=True, in_stock=True, stock_qty__lte=5, stock_qty__gt=0).count()
        out_of_stock      = products_qs.filter(visible=True, in_stock=False).count()
        total_products    = products_qs.count()

        # Schedule snapshot
        try:
            sched = user.schedule
            schedule = {
                'is_open_now':    sched.is_open_now(),
                'opening_time':   str(sched.opening_time) if sched.opening_time else None,
                'closing_time':   str(sched.closing_time) if sched.closing_time else None,
                'holidays_count': len(sched.holiday_dates or []),
                'always_open':    not sched.opening_time and not sched.closing_time,
            }
        except Exception:
            schedule = {
                'is_open_now': True, 'opening_time': None,
                'closing_time': None, 'holidays_count': 0, 'always_open': True,
            }

        # Live pricing snapshot
        try:
            cfg = user.pricing_config
            live_rates = {
                'gold':      float(cfg.gold_rate),
                'silver':    float(cfg.silver_rate),
                'platinum':  float(cfg.platinum_rate),
                'palladium': float(cfg.palladium_rate),
            }
        except Exception:
            live_rates = {}

        return Response({
            'stats': {
                'total_orders':        total,
                'accepted':            counts['accepted'],
                'rejected':            counts['rejected'],
                'expired':             counts['expired'],
                'pending':             counts['pending'],
                'revenue_aed':         round(revenue, 2),
                'acceptance_rate':     round(counts['accepted'] / total * 100, 1) if total else 0,
                'avg_order_aed':       round(revenue / accepted_count, 2) if accepted_count else 0,
                'today_revenue_aed':   round(today_revenue, 2),
                'today_orders':        today_orders_count,
                'fees_collected_aed':  round(platform_fees_collected, 2),
                'total_sellbacks':     len(completed_sells),
                'pending_sellbacks':   len(pending_sells),
                'total_sellbacks_aed': round(total_sellbacks, 2),
                'net_revenue_aed':     round(revenue - total_sellbacks, 2),
            },
            'financials': {
                'pool_balance_aed':     round(revenue - platform_fees_collected - total_sellbacks, 2),
                'total_revenue_aed':    round(revenue, 2),
                'total_sellbacks_aed':  round(total_sellbacks, 2),
                'credits_today_aed':    round(today_revenue, 2),
                'debits_today_aed':     round(today_sellbacks, 2),
                'platform_fees_aed':    round(platform_fees_collected, 2),
                'pending_sellbacks':    len(pending_sells),
            },
            'inventory': {
                'total_products':    total_products,
                'active':            active_products,
                'low_stock':         low_stock_products,
                'out_of_stock':      out_of_stock,
            },
            'schedule': schedule,
            'live_rates': live_rates,
            'metal_revenue': metal_revenue,
            'metal_units':   metal_units,
            'product_stats': sorted(product_stats.values(), key=lambda x: -x['revenue']),
            'recent_orders': recent,
        })


# ── Vendor schedule views ─────────────────────────────────────────

def _schedule_to_dict(s):
    return {
        'opening_time': s.opening_time.strftime('%H:%M') if s.opening_time else None,
        'closing_time': s.closing_time.strftime('%H:%M') if s.closing_time else None,
        'timezone': s.timezone,
        'holiday_dates': s.holiday_dates or [],
        'is_open_now': s.is_open_now(),
    }


class VendorScheduleView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_schedule(self, user):
        obj, _ = VendorSchedule.objects.get_or_create(vendor=user)
        return obj

    def get(self, request):
        if request.user.user_type != User.VENDOR:
            return Response({'detail': 'Vendor access required.'}, status=status.HTTP_403_FORBIDDEN)
        return Response(_schedule_to_dict(self._get_schedule(request.user)))

    def post(self, request):
        if request.user.user_type != User.VENDOR:
            return Response({'detail': 'Vendor access required.'}, status=status.HTTP_403_FORBIDDEN)
        s = self._get_schedule(request.user)
        d = request.data
        if 'opening_time' in d:
            s.opening_time = d['opening_time'] or None
        if 'closing_time' in d:
            s.closing_time = d['closing_time'] or None
        if 'timezone' in d:
            s.timezone = d['timezone'] or 'Asia/Dubai'
        if 'holiday_dates' in d:
            s.holiday_dates = [str(x) for x in (d['holiday_dates'] or [])]
        s.save()
        return Response(_schedule_to_dict(s))


# ── Password management views ────────────────────────────────────

class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        old_password = request.data.get('old_password', '')
        new_password = request.data.get('new_password', '')
        if not old_password or not new_password:
            return Response({'detail': 'old_password and new_password are required.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(new_password) < 8:
            return Response({'detail': 'New password must be at least 8 characters.'}, status=status.HTTP_400_BAD_REQUEST)
        if not request.user.check_password(old_password):
            return Response({'detail': 'Current password is incorrect.'}, status=status.HTTP_400_BAD_REQUEST)
        request.user.set_password(new_password)
        request.user.save(update_fields=['password'])
        return Response({'detail': 'Password changed successfully.'})


def _forgot_password_response():
    return Response({
        'detail': 'If an account exists for that email, you will receive password reset instructions.',
    })


def _try_send_reset_email(user):
    if not django_settings.EMAIL_HOST:
        return False
    uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    link = f'{django_settings.FRONTEND_BASE_URL}/reset-password?uid={uidb64}&token={token}'
    try:
        send_mail(
            subject='Reset your Cridora password',
            message=(
                'You (or someone) asked to reset your Cridora account password.\n\n'
                f'Open this link to set a new password:\n{link}\n\n'
                'If you did not request a reset, you can ignore this message.'
            ),
            from_email=django_settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        return True
    except Exception:
        return False


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        if not email:
            return Response({'detail': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return _forgot_password_response()
        if _try_send_reset_email(user):
            return _forgot_password_response()
        if not PasswordResetRequest.objects.filter(
            user=user, status=PasswordResetRequest.PENDING
        ).exists():
            PasswordResetRequest.objects.create(user=user)
        return _forgot_password_response()


class PasswordResetConfirmView(APIView):
    """Complete self-service password reset (link from email). AllowAny: uid+token are credentials."""
    permission_classes = [AllowAny]

    def post(self, request):
        uidb64 = (request.data.get('uid') or '').strip()
        token = (request.data.get('token') or '').strip()
        new_password = request.data.get('new_password', '')
        if not uidb64 or not token or not new_password:
            return Response(
                {'detail': 'uid, token, and new_password are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(new_password) < 8:
            return Response(
                {'detail': 'New password must be at least 8 characters.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError, UnicodeDecodeError):
            return Response(
                {'detail': 'Invalid or expired reset link.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not default_token_generator.check_token(user, token):
            return Response(
                {'detail': 'Invalid or expired reset link.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.set_password(new_password)
        user.save(update_fields=['password'])
        return Response({
            'detail': 'Your password has been updated. You can sign in with your new password.',
        })


class AdminPasswordRequestsView(APIView):
    permission_classes = [IsAuthenticated]

    def _require_admin(self, request):
        if request.user.user_type != User.ADMIN:
            return Response({'detail': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)
        return None

    def get(self, request):
        err = self._require_admin(request)
        if err:
            return err
        reqs = PasswordResetRequest.objects.filter(
            status=PasswordResetRequest.PENDING
        ).select_related('user').order_by('-created_at')
        return Response([{
            'id':         r.id,
            'user_id':    r.user.id,
            'email':      r.user.email,
            'name':       r.user.get_full_name() or r.user.email,
            'user_type':  r.user.user_type,
            'created_at': str(r.created_at)[:19].replace('T', ' '),
        } for r in reqs])

    def post(self, request, request_id):
        err = self._require_admin(request)
        if err:
            return err
        temp_password = request.data.get('temp_password', '')
        if not temp_password or len(temp_password) < 6:
            return Response({'detail': 'temp_password must be at least 6 characters.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            reset_req = PasswordResetRequest.objects.get(id=request_id, status=PasswordResetRequest.PENDING)
        except PasswordResetRequest.DoesNotExist:
            return Response({'detail': 'Request not found or already resolved.'}, status=status.HTTP_404_NOT_FOUND)
        reset_req.user.set_password(temp_password)
        reset_req.user.save(update_fields=['password'])
        reset_req.status     = PasswordResetRequest.RESOLVED
        reset_req.resolved_at = timezone.now()
        reset_req.resolved_by = request.user
        reset_req.save()
        return Response({'detail': f'Temporary password set for {reset_req.user.email}.'})


# ── Sell Order views ──────────────────────────────────────────────

def _sell_order_to_dict(so):
    return {
        'id':                    so.id,
        'order_ref':             so.order_ref,
        'buy_order_ref':         so.buy_order.order_ref,
        'customer_email':        so.customer.email,
        'customer_name':         so.customer.get_full_name() or so.customer.email,
        'product_name':          so.buy_order.product.name,
        'metal':                 so.buy_order.product.metal,
        'purity':                so.buy_order.product.purity,
        'qty_grams':             float(so.qty_grams),
        'buyback_rate_per_gram': float(so.buyback_rate_per_gram),
        'purchase_rate_per_gram': float(so.purchase_rate_per_gram),
        'gross_aed':             float(so.gross_aed),
        'purchase_cost_aed':     float(so.purchase_cost_aed),
        'profit_aed':            float(so.profit_aed),
        'cridora_share_pct':     float(so.cridora_share_pct),
        'cridora_share_aed':     float(so.cridora_share_aed),
        'net_payout_aed':                float(so.net_payout_aed),
        'vendor_balance_used':           so.vendor_balance_used,
        'vendor_pool_balance_at_accept': float(so.vendor_pool_balance_at_accept),
        'status':                        so.status,
        'created_at':                    str(so.created_at)[:19].replace('T', ' '),
    }


class CustomerCreateSellOrderView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.user_type != User.CUSTOMER:
            return Response({'detail': 'Customer access required.'}, status=status.HTTP_403_FORBIDDEN)
        c = customer_compliance_verification(request.user)
        if not c['trading_allowed']:
            return Response(
                {
                    'detail': 'Complete KYC (documents and verified bank account) before sell-back.',
                    'pending_items': c['pending_items'],
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        buy_order_id = request.data.get('buy_order_id')
        qty_grams    = request.data.get('qty_grams')
        if not buy_order_id or qty_grams is None:
            return Response({'detail': 'buy_order_id and qty_grams are required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            qty = Decimal(str(qty_grams)).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
        except (InvalidOperation, TypeError, ValueError):
            return Response({'detail': 'Invalid qty_grams value.'}, status=status.HTTP_400_BAD_REQUEST)
        if qty < Decimal('0.0001'):
            return Response({'detail': 'qty_grams must be at least 0.0001.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            try:
                buy_order = Order.objects.select_for_update().select_related(
                    'product', 'product__vendor', 'product__vendor__pricing_config',
                ).get(
                    id=buy_order_id, customer=request.user, status=Order.PAID,
                )
            except Order.DoesNotExist:
                return Response(
                    {'detail': 'Buy order not found or not eligible for sell.'},
                    status=status.HTTP_404_NOT_FOUND,
                )
            committed = SellOrder.objects.filter(
                buy_order=buy_order,
            ).exclude(
                status=SellOrder.REJECTED,
            ).aggregate(t=Sum('qty_grams'))['t'] or Decimal('0')
            remaining = buy_order.qty_grams - committed
            if remaining <= 0 or qty > remaining:
                return Response(
                    {
                        'detail': (
                            'Amount exceeds remaining balance for this order. '
                            f'Remaining: {float(remaining):.4f} g (including in-flight sell-backs).'
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            cfg = PlatformConfig.get()
            buyback_rate   = buy_order.product.effective_buyback_per_gram()
            _mr = float(buy_order.metal_rate_per_gram)
            _ai = float(buy_order.rate_per_gram)
            purchase_rate  = _mr if _mr > 0 else (_ai if _ai > 0 else 0)
            qf = float(qty)
            gross          = round(qf * buyback_rate, 2)
            purchase_cost  = round(qf * purchase_rate, 2)
            profit         = round(gross - purchase_cost, 2)
            share_pct      = float(cfg.sell_share_pct)
            share_aed      = round(max(0, profit) * share_pct / 100, 2)
            net_payout     = round(gross - share_aed, 2)

            so = SellOrder.objects.create(
                customer=request.user,
                buy_order=buy_order,
                qty_grams=qty,
                buyback_rate_per_gram=buyback_rate,
                purchase_rate_per_gram=purchase_rate,
                gross_aed=gross,
                purchase_cost_aed=purchase_cost,
                profit_aed=profit,
                cridora_share_pct=share_pct,
                cridora_share_aed=share_aed,
                net_payout_aed=net_payout,
                status=SellOrder.PENDING_VENDOR,
            )
        return Response(_sell_order_to_dict(so), status=status.HTTP_201_CREATED)


class CustomerSellOrderStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, sell_order_id):
        try:
            so = SellOrder.objects.get(id=sell_order_id, customer=request.user)
        except SellOrder.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(_sell_order_to_dict(so))


class VendorPendingSellOrdersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.VENDOR:
            return Response({'detail': 'Vendor access required.'}, status=status.HTTP_403_FORBIDDEN)
        gate = _vendor_desk_trading_gate(request.user)
        if gate:
            return gate
        orders = SellOrder.objects.filter(
            buy_order__product__vendor=request.user,
            status=SellOrder.PENDING_VENDOR,
        ).select_related('customer', 'buy_order__product')
        return Response([_sell_order_to_dict(so) for so in orders])


class VendorSellOrderActionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, sell_order_id, action):
        if request.user.user_type != User.VENDOR:
            return Response({'detail': 'Vendor access required.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            so = SellOrder.objects.get(
                id=sell_order_id,
                buy_order__product__vendor=request.user,
                status=SellOrder.PENDING_VENDOR,
            )
        except SellOrder.DoesNotExist:
            return Response({'detail': 'Sell order not found.'}, status=status.HTTP_404_NOT_FOUND)
        gate = _vendor_desk_trading_gate(request.user)
        if gate:
            return gate
        if action == 'accept':
            # Compute vendor pool balance (revenues from paid buy orders minus payouts from balance-used sell orders)
            paid_revenue = sum(
                float(o.total_aed) - float(o.platform_fee_aed)
                for o in Order.objects.filter(product__vendor=request.user, status=Order.PAID)
            )
            already_paid = sum(
                float(s.net_payout_aed)
                for s in SellOrder.objects.filter(
                    buy_order__product__vendor=request.user,
                    vendor_balance_used=True,
                    status__in=[SellOrder.VENDOR_ACCEPTED, SellOrder.COMPLETED],
                )
            )
            pool_balance = round(paid_revenue - already_paid, 2)
            so.vendor_pool_balance_at_accept = round(pool_balance, 2)
            so.vendor_balance_used = pool_balance >= float(so.net_payout_aed)
            so.status = SellOrder.VENDOR_ACCEPTED
        elif action == 'reject':
            so.status = SellOrder.REJECTED
        else:
            return Response({'detail': 'action must be accept or reject.'}, status=status.HTTP_400_BAD_REQUEST)
        so.save()
        return Response(_sell_order_to_dict(so))


class AdminPendingSellOrdersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.ADMIN:
            return Response({'detail': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)
        orders = SellOrder.objects.filter(
            status__in=[SellOrder.VENDOR_ACCEPTED, SellOrder.ADMIN_APPROVED],
        ).select_related('customer', 'buy_order__product__vendor').order_by('status', '-created_at')
        return Response([_sell_order_to_dict(so) for so in orders])


class AdminSellOrderApproveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, sell_order_id, action):
        if request.user.user_type != User.ADMIN:
            return Response({'detail': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            so = SellOrder.objects.select_related('buy_order__product').get(id=sell_order_id)
        except SellOrder.DoesNotExist:
            return Response({'detail': 'Sell order not found.'}, status=status.HTTP_404_NOT_FOUND)

        if action == 'approve':
            if so.status != SellOrder.VENDOR_ACCEPTED:
                return Response(
                    {'detail': 'Funds can only be confirmed while the sell order awaits admin (vendor accepted).'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            so.status = SellOrder.ADMIN_APPROVED
            so.save()
        elif action == 'complete':
            if so.status != SellOrder.ADMIN_APPROVED:
                return Response(
                    {'detail': 'Payout can only be completed after funds are confirmed (admin approved).'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            so.status = SellOrder.COMPLETED
            so.save()
            product = so.buy_order.product
            weight = float(product.weight_grams) if float(product.weight_grams) > 0 else 1
            units_returned = max(1, round(float(so.qty_grams) / weight))
            product.stock_qty += units_returned
            product.in_stock = True
            product.save(update_fields=['stock_qty', 'in_stock'])
        elif action == 'reject':
            if so.status not in (SellOrder.VENDOR_ACCEPTED, SellOrder.ADMIN_APPROVED):
                return Response(
                    {'detail': 'Only pending admin sell orders can be rejected.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            so.status = SellOrder.REJECTED
            so.save()
        else:
            return Response(
                {'detail': 'action must be approve (confirm funds), complete (payout done), or reject.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(_sell_order_to_dict(so))


# ── Dashboard data views ──────────────────────────────────────────

class CustomerDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.CUSTOMER:
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        return Response(_customer_dashboard_data(request.user))


class VendorDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.VENDOR:
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        return Response(_vendor_dashboard_data(request.user))


class AdminDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != User.ADMIN:
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        return Response(_admin_dashboard_data())


# ── Dummy data generators ─────────────────────────────────────────

DEMO_CUSTOMER_EMAIL = 'customer@example.com'
DEMO_VENDOR_EMAIL = 'vendor@emiratesgold.com'


def _customer_dashboard_data(user):
    kyc_section = {
        "status": user.kyc_status,
        "submitted_at": str(user.kyc_submitted_at)[:10] if user.kyc_submitted_at else None,
        "verified_at": str(user.kyc_verified_at)[:10] if user.kyc_verified_at else None,
        "documents": [
            {
                "type": "Passport",
                "status": "verified" if user.kyc_status == "verified" else "pending",
                "uploaded": str(user.date_joined)[:10],
            },
        ],
    }
    profile_section = {
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "phone": user.phone or "",
        "country": user.country or "",
    }
    try:
        b = user.bank_details
        bank_section = {
            "account_name": b.account_name,
            "bank_name": b.bank_name,
            "account_number": b.account_number,
            "ifsc": b.ifsc,
            "status": b.status,
        }
    except CustomerBankDetails.DoesNotExist:
        bank_section = {
            "account_name": f"{user.first_name} {user.last_name}".strip() or "Account Holder",
            "bank_name": "",
            "account_number": "",
            "ifsc": "",
            "status": "not_added",
        }

    # Demo account — return representative data
    if user.email.lower() == DEMO_CUSTOMER_EMAIL:
        return {
            "portfolio": {
                "total_value_aed": 52300,
                "total_buyback_value_aed": 51200,
                "total_invested_aed": 48000,
                "unrealized_pnl_aed": 4300,
                "unrealized_pnl_pct": 8.96,
                "realized_pnl_aed": 1200,
                "gold_grams": 120.5,
                "silver_grams": 800,
                "other_grams": 31.1,
            },
            "holdings": [
                {
                    "vendor": "Emirates Gold Dubai", "vendor_verified": True,
                    "total_value_aed": 32000, "total_grams": 75, "metal": "gold",
                    "products": [
                        {"id": "h1", "name": "24K Gold Bar 100g", "grams": 50, "avg_buy_price": 245, "buyback_price": 260, "value_aed": 13000, "pnl_aed": 750, "metal": "gold"},
                        {"id": "h2", "name": "Gold Krugerrand 1oz", "grams": 25, "avg_buy_price": 242, "buyback_price": 258, "value_aed": 6450, "pnl_aed": 400, "metal": "gold"},
                    ],
                },
                {
                    "vendor": "Gulf Bullion House", "vendor_verified": True,
                    "total_value_aed": 20300, "total_grams": 800, "metal": "silver",
                    "products": [
                        {"id": "h3", "name": "Fine Silver Bar 1kg", "grams": 800, "avg_buy_price": 0.268, "buyback_price": 0.278, "value_aed": 222.4, "pnl_aed": 8, "metal": "silver"},
                    ],
                },
            ],
            "ledger": [
                {"id": "L-10234", "date": "2026-04-12", "type": "BUY", "product": "Gold Bar 100g", "vendor": "Emirates Gold Dubai", "qty_grams": 100, "buy_price_per_gram": 245, "current_value_aed": 26000, "status": "Completed", "metal": "gold", "lot_detail": {"quote_id": "Q-88921", "original_qty": 100, "remaining_qty": 100}},
                {"id": "L-10198", "date": "2026-04-08", "type": "BUY", "product": "Silver Bar 1kg", "vendor": "Gulf Bullion House", "qty_grams": 1000, "buy_price_per_gram": 0.268, "current_value_aed": 278, "status": "Completed", "metal": "silver", "lot_detail": {"quote_id": "Q-88722", "original_qty": 1000, "remaining_qty": 800}},
                {"id": "L-10155", "date": "2026-03-30", "type": "SELL", "product": "Gold Bar 100g", "vendor": "Emirates Gold Dubai", "qty_grams": -10, "buy_price_per_gram": 240, "current_value_aed": 2600, "status": "Completed", "metal": "gold", "lot_detail": {"quote_id": "Q-88500", "original_qty": 10, "remaining_qty": 0}},
                {"id": "L-10102", "date": "2026-03-18", "type": "BUY", "product": "Gold Krugerrand 1oz", "vendor": "Emirates Gold Dubai", "qty_grams": 31.1, "buy_price_per_gram": 242, "current_value_aed": 8026.2, "status": "Completed", "metal": "gold", "lot_detail": {"quote_id": "Q-88210", "original_qty": 31.1, "remaining_qty": 25}},
            ],
            "orders": [
                {"id": "ORD-5521", "date": "2026-04-19", "type": "BUY", "product": "Gold Bar 100g", "vendor": "Emirates Gold Dubai", "qty_grams": 100, "price_per_gram": 245, "total_aed": 24500, "status": "Completed", "metal": "gold"},
                {"id": "ORD-5498", "date": "2026-04-14", "type": "BUY", "product": "Silver Bar 1kg", "vendor": "Gulf Bullion House", "qty_grams": 1000, "price_per_gram": 0.268, "total_aed": 268, "status": "Completed", "metal": "silver"},
                {"id": "ORD-5441", "date": "2026-03-30", "type": "SELL", "product": "Gold Bar 100g", "vendor": "Emirates Gold Dubai", "qty_grams": 10, "price_per_gram": 260, "total_aed": 2600, "status": "Completed", "metal": "gold"},
                {"id": "ORD-5390", "date": "2026-03-18", "type": "BUY", "product": "Gold Krugerrand 1oz", "vendor": "Emirates Gold Dubai", "qty_grams": 31.1, "price_per_gram": 242, "total_aed": 7526.2, "status": "Completed", "metal": "gold"},
            ],
            "kyc": {
                **kyc_section,
                "status": "verified",
                "admin_identity_status": user.kyc_status,
                "trading_allowed": True,
                "pending_items": [],
                "documents": [
                    {"type": "Passport", "status": "verified", "uploaded": "2026-02-10"},
                    {"type": "Proof of Address", "status": "verified", "uploaded": "2026-02-10"},
                ],
            },
            "profile": {**profile_section, "phone": user.phone or "+91 98765 43210", "country": user.country or "India"},
            "bank": {"account_name": "Arjun Mehta", "bank_name": "HDFC Bank", "account_number": "****4821", "ifsc": "HDFC0001234", "status": "verified"},
        }

    # Real customer — compute from actual Order records
    all_orders = (
        Order.objects
        .filter(customer=user)
        .select_related('product', 'product__vendor')
        .order_by('-created_at')
    )

    paid_orders = [o for o in all_orders if o.status == Order.PAID]

    # Portfolio summary
    # total_invested = grams × pure metal rate at purchase time (stored in metal_rate_per_gram).
    #   Falls back to the stored all-in rate_per_gram for legacy orders where
    #   metal_rate_per_gram was not recorded.  Both values come from the Order
    #   record and are therefore immutable — they NEVER change after the order
    #   is completed, regardless of any subsequent vendor or admin price updates.
    # total_value    = grams × current live metal rate (real-time, intentionally dynamic)
    def _invested_rate(o):
        mr = float(o.metal_rate_per_gram)
        if mr > 0:
            return mr
        stored_all_in = float(o.rate_per_gram)
        return stored_all_in if stored_all_in > 0 else 0

    # All sell orders for this customer
    customer_sell_orders = (
        SellOrder.objects
        .filter(customer=user)
        .select_related('buy_order__product__vendor')
        .order_by('-created_at')
    )

    # Grams already sold (completed) per buy_order_id
    sold_grams_by_buy = {}
    for so in customer_sell_orders:
        if so.status == SellOrder.COMPLETED:
            sold_grams_by_buy[so.buy_order_id] = round(
                sold_grams_by_buy.get(so.buy_order_id, 0) + float(so.qty_grams), 4
            )

    # Active (in-flight) sell orders per buy_order_id
    active_sell_statuses = (SellOrder.PENDING_VENDOR, SellOrder.VENDOR_ACCEPTED, SellOrder.ADMIN_APPROVED)
    active_sells_by_buy = {}
    for so in customer_sell_orders:
        if so.status in active_sell_statuses:
            active_sells_by_buy[so.buy_order_id] = so

    # Recompute portfolio totals using remaining grams (after completed sells)
    total_invested = 0
    total_value    = 0
    total_buyback_value = 0
    gold_grams     = 0
    silver_grams   = 0
    other_grams    = 0
    for o in paid_orders:
        sold      = sold_grams_by_buy.get(o.id, 0)
        remaining = round(float(o.qty_grams) - sold, 4)
        if remaining <= 0:
            continue
        rate  = _invested_rate(o)
        live  = o.product.effective_rate()
        buyback = o.product.effective_buyback_per_gram()
        total_invested += remaining * rate
        total_value    += remaining * live
        total_buyback_value += remaining * buyback
        if o.product.metal == 'gold':
            gold_grams += remaining
        elif o.product.metal == 'silver':
            silver_grams += remaining
        else:
            other_grams += remaining

    unrealized_pnl = round(total_value - total_invested, 2)
    unrealized_pct = round(unrealized_pnl / total_invested * 100, 2) if total_invested else 0

    realized_pnl_aed = round(sum(
        float(so.net_payout_aed) - float(so.purchase_cost_aed)
        for so in customer_sell_orders if so.status == SellOrder.COMPLETED
    ), 2)

    # Holdings — flat list, one row per paid order (only rows with remaining grams)
    holdings = []
    for o in paid_orders:
        sold      = sold_grams_by_buy.get(o.id, 0)
        remaining = round(float(o.qty_grams) - sold, 4)
        if remaining <= 0:
            continue  # fully sold — no longer a holding
        current_rate    = o.product.effective_rate()
        current_buyback = o.product.effective_buyback_per_gram()
        purchase_rate   = _invested_rate(o)
        purchase_value  = round(remaining * purchase_rate, 2)
        current_value   = round(remaining * current_rate, 2)
        pnl             = round(current_value - purchase_value, 2)
        active_sell     = active_sells_by_buy.get(o.id)
        holdings.append({
            'order_ref':        o.order_ref,
            'order_id':         o.id,
            'date':             str(o.created_at)[:10],
            'vendor':           o.product.vendor.vendor_company or o.product.vendor.email,
            'vendor_verified':  o.product.vendor.kyc_status == 'verified',
            'metal':            o.product.metal,
            'product_name':     o.product.name,
            'purity':           o.product.purity,
            'grams':            remaining,
            'purchase_rate':    purchase_rate,
            'current_rate':     current_rate,
            'current_buyback':  current_buyback,
            'purchase_value':   purchase_value,
            'current_value':    current_value,
            'pnl_aed':          pnl,
            'sell_order_id':    active_sell.id if active_sell else None,
            'sell_order_ref':   active_sell.order_ref if active_sell else None,
            'sell_status':      active_sell.status if active_sell else None,
        })

    SELL_STATUS_LABEL = {
        SellOrder.PENDING_VENDOR:  'Awaiting Vendor',
        SellOrder.VENDOR_ACCEPTED: 'Awaiting Admin (funds)',
        SellOrder.ADMIN_APPROVED:  'Funds Confirmed — Payout Pending',
        SellOrder.COMPLETED:       'Completed',
        SellOrder.REJECTED:        'Rejected',
    }
    STATUS_LABEL = {
        Order.PENDING_VENDOR:  'Awaiting Vendor',
        Order.VENDOR_ACCEPTED: 'Pending Payment',
        Order.PAID:            'Completed',
        Order.REJECTED:        'Rejected',
        Order.EXPIRED:         'Expired',
    }

    # Ledger: BUY rows from paid orders + SELL rows from completed/in-progress sell orders
    ledger = [{
        'id': o.order_ref,
        'date': str(o.created_at)[:10],
        'type': 'BUY',
        'product': o.product.name,
        'vendor': o.product.vendor.vendor_company or o.product.vendor.email,
        'qty_grams': float(o.qty_grams),
        'metal_rate_per_gram': float(o.metal_rate_per_gram),
        'buy_price_per_gram': float(o.rate_per_gram),
        'total_aed': float(o.total_aed),
        'status': 'Completed',
        'metal': o.product.metal,
    } for o in paid_orders]

    for so in customer_sell_orders:
        ledger.append({
            'id': so.order_ref,
            'date': str(so.created_at)[:10],
            'type': 'SELL',
            'product': so.buy_order.product.name,
            'vendor': so.buy_order.product.vendor.vendor_company or so.buy_order.product.vendor.email,
            'qty_grams': -float(so.qty_grams),
            'metal_rate_per_gram': float(so.purchase_rate_per_gram),
            'buy_price_per_gram': float(so.buyback_rate_per_gram),
            'total_aed': float(so.net_payout_aed),
            'status': SELL_STATUS_LABEL.get(so.status, so.status),
            'metal': so.buy_order.product.metal,
        })
    ledger.sort(key=lambda r: r['date'], reverse=True)

    # Orders & history: buy orders + sell requests (chronological, most recent first)
    orders_merged = []
    for o in all_orders:
        orders_merged.append((
            o.created_at,
            {
                'id': o.order_ref,
                'order_id': o.id,
                'date': str(o.created_at)[:10],
                'type': 'BUY',
                'product': o.product.name,
                'vendor': o.product.vendor.vendor_company or o.product.vendor.email,
                'qty_grams': float(o.qty_grams),
                'price_per_gram': float(o.rate_per_gram),
                'total_aed': float(o.total_aed),
                'status': STATUS_LABEL.get(o.status, o.status),
                'raw_status': o.status,
                'metal': o.product.metal,
                'expires_in': max(0, int((o.expires_at - timezone.now()).total_seconds())),
            },
        ))
    for so in customer_sell_orders:
        orders_merged.append((
            so.created_at,
            {
                'id': so.order_ref,
                'order_id': so.id,
                'date': str(so.created_at)[:10],
                'type': 'SELL',
                'product': so.buy_order.product.name,
                'vendor': so.buy_order.product.vendor.vendor_company or so.buy_order.product.vendor.email,
                'qty_grams': float(so.qty_grams),
                'price_per_gram': float(so.buyback_rate_per_gram),
                'total_aed': float(so.gross_aed),
                'status': SELL_STATUS_LABEL.get(so.status, so.status),
                'raw_status': so.status,
                'metal': so.buy_order.product.metal,
                'expires_in': 0,
            },
        ))
    orders_merged.sort(key=lambda x: (x[0], x[1]['order_id'], x[1]['type']), reverse=True)
    orders_list = [r[1] for r in orders_merged]

    comp = customer_compliance_verification(user)
    kyc_section = {
        **kyc_section,
        'status': comp['status'],
        'admin_identity_status': user.kyc_status,
        'trading_allowed': comp['trading_allowed'],
        'pending_items': comp['pending_items'],
    }

    return {
        "portfolio": {
            "total_value_aed": round(total_value, 2),
            "total_buyback_value_aed": round(total_buyback_value, 2),
            "total_invested_aed": round(total_invested, 2),
            "unrealized_pnl_aed": unrealized_pnl,
            "unrealized_pnl_pct": unrealized_pct,
            "realized_pnl_aed": realized_pnl_aed,
            "gold_grams": round(gold_grams, 4),
            "silver_grams": round(silver_grams, 4),
            "other_grams": round(other_grams, 4),
        },
        "holdings": holdings,
        "ledger": ledger,
        "orders": orders_list,
        "kyc": kyc_section,
        "profile": profile_section,
        "bank": bank_section,
        "platform": {"sell_share_pct": float(PlatformConfig.get().sell_share_pct)},
    }


def _vendor_dashboard_data(user):
    empty_inventory = {
        "summary": {"total_gold_grams": 0, "total_silver_grams": 0, "total_platinum_grams": 0, "reserved_gold_grams": 0, "reserved_silver_grams": 0},
        "alerts": [],
        "items": [],
    }
    cfg = PlatformConfig.get()

    # ── Real data from DB ──────────────────────────────────────────
    today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)

    all_vendor_orders = (
        Order.objects
        .filter(product__vendor=user)
        .select_related('customer', 'product')
        .order_by('-created_at')
    )
    paid_orders   = [o for o in all_vendor_orders if o.status == Order.PAID]
    pending_orders_qs = [o for o in all_vendor_orders if o.status in (Order.PENDING_VENDOR, Order.VENDOR_ACCEPTED)]

    revenue_total  = sum(float(o.total_aed) - float(o.platform_fee_aed) for o in paid_orders)
    credits_today  = sum(
        float(o.total_aed) - float(o.platform_fee_aed)
        for o in paid_orders if o.created_at >= today_start
    )
    reserved_aed   = sum(float(o.total_aed) for o in pending_orders_qs)
    today_orders_count = sum(1 for o in all_vendor_orders if o.created_at >= today_start)

    unique_customers = len({o.customer_id for o in paid_orders})

    # Catalog and inventory from CatalogProduct
    products_qs = list(
        CatalogProduct.objects.filter(vendor=user).order_by('metal', 'weight_grams')
    )
    active_inventory = sum(1 for p in products_qs if p.visible and p.in_stock)

    real_inventory_items = [
        {
            "id": p.id,
            "name": p.name,
            "metal": p.metal,
            "available_grams": round(float(p.weight_grams) * p.stock_qty, 4),
            "reserved_grams": 0,
            "total_grams": round(float(p.weight_grams) * p.stock_qty, 4),
            "available_units": p.stock_qty,
            "reserved_units": 0,
        }
        for p in products_qs
    ]
    gold_g     = sum(float(p.weight_grams) * p.stock_qty for p in products_qs if p.metal == 'gold')
    silver_g   = sum(float(p.weight_grams) * p.stock_qty for p in products_qs if p.metal == 'silver')
    platinum_g = sum(float(p.weight_grams) * p.stock_qty for p in products_qs if p.metal == 'platinum')
    low_stock_alerts = [
        {"product": p.name, "message": "Stock at 0 — marked out of stock", "level": "critical"}
        for p in products_qs if not p.in_stock and p.visible
    ] + [
        {"product": p.name, "message": f"Low stock: {p.stock_qty} units remaining", "level": "warning"}
        for p in products_qs if p.in_stock and p.visible and 0 < p.stock_qty <= 5
    ]

    real_inventory = {
        "summary": {
            "total_gold_grams": round(gold_g, 4),
            "total_silver_grams": round(silver_g, 4),
            "total_platinum_grams": round(platinum_g, 4),
            "reserved_gold_grams": 0,
            "reserved_silver_grams": 0,
        },
        "alerts": low_stock_alerts,
        "items": real_inventory_items,
    }

    # Completed sell orders for this vendor
    completed_sell_orders = (
        SellOrder.objects
        .filter(buy_order__product__vendor=user, status=SellOrder.COMPLETED)
        .select_related('customer', 'buy_order__product')
        .order_by('-created_at')
    )

    # Daily statements from PAID buy orders + COMPLETED sell orders
    from collections import defaultdict
    daily = defaultdict(lambda: {"sales": 0.0, "buy_count": 0, "sellbacks": 0.0, "sell_count": 0})
    for o in paid_orders:
        day = str(o.created_at)[:10]
        daily[day]["sales"]     += float(o.total_aed)
        daily[day]["buy_count"] += 1
    for so in completed_sell_orders:
        day = str(so.updated_at)[:10]
        daily[day]["sellbacks"]   += float(so.net_payout_aed)
        daily[day]["sell_count"]  += 1
    real_statements = [
        {
            "id":                  f"EOD-{day.replace('-', '')}",
            "date":                day,
            "total_sales_aed":     round(v["sales"], 2),
            "total_sellbacks_aed": round(v["sellbacks"], 2),
            "net_aed":             round(v["sales"] - v["sellbacks"], 2),
            "transactions":        v["buy_count"] + v["sell_count"],
            "buy_count":           v["buy_count"],
            "sell_count":          v["sell_count"],
            "status":              "final",
        }
        for day, v in sorted(daily.items(), reverse=True)
    ]

    # Recent transactions for vendor (buy + sell)
    vendor_transactions = []
    for o in paid_orders[:50]:
        vendor_transactions.append({
            "type":       "BUY",
            "ref":        o.order_ref,
            "date":       str(o.created_at)[:10],
            "customer":   o.customer.get_full_name() or o.customer.email,
            "product":    o.product.name,
            "metal":      o.product.metal,
            "qty_grams":  float(o.qty_grams),
            "amount_aed": float(o.total_aed),
            "net_aed":    round(float(o.total_aed) - float(o.platform_fee_aed), 2),
        })
    for so in completed_sell_orders[:50]:
        vendor_transactions.append({
            "type":       "SELL",
            "ref":        so.order_ref,
            "date":       str(so.updated_at)[:10],
            "customer":   so.customer.get_full_name() or so.customer.email,
            "product":    so.buy_order.product.name,
            "metal":      so.buy_order.product.metal,
            "qty_grams":  float(so.qty_grams),
            "amount_aed": float(so.net_payout_aed),
            "net_aed":    -round(float(so.net_payout_aed), 2),
        })
    vendor_transactions.sort(key=lambda t: t["date"], reverse=True)
    vendor_transactions = vendor_transactions[:100]

    total_sellbacks_aed = sum(float(so.net_payout_aed) for so in completed_sell_orders)
    net_pool_balance    = round(revenue_total - total_sellbacks_aed, 2)
    available_balance   = round(net_pool_balance - reserved_aed, 2)

    real_financials = {
        "pool_balance_aed":       net_pool_balance,
        "total_sellbacks_aed":    round(total_sellbacks_aed, 2),
        "pending_debits_aed":     round(reserved_aed, 2),
        "credits_today_aed":      round(credits_today, 2),
        "available_balance_aed":  available_balance,
    }

    # Pending sell orders (awaiting vendor action) for this vendor
    pending_sell_qs = list(
        SellOrder.objects
        .filter(buy_order__product__vendor=user, status=SellOrder.PENDING_VENDOR)
        .select_related('customer', 'buy_order__product')
        .order_by('-created_at')
    )
    sellback_queue_data = [_sell_order_to_dict(so) for so in pending_sell_qs]

    base = {
        "stats": {
            "today_sales_aed":    round(credits_today, 2),
            "today_orders":       today_orders_count,
            "active_inventory":   active_inventory,
            "sellback_requests":  len(pending_sell_qs),
            "active_customers":   unique_customers,
        },
        "pending_orders": [],
        "sellback_queue": sellback_queue_data,
        "catalog": [],
        "inventory": real_inventory,
        "financials": real_financials,
        "statements": real_statements,
        "transactions": vendor_transactions,
        "config": {"vendor_accept_ttl_seconds": int(cfg.vendor_accept_ttl_seconds)},
        "team": [
            {
                "id": 1,
                "name": f"{user.first_name} {user.last_name}".strip() or user.email,
                "email": user.email,
                "role": "Owner",
                "status": "active",
                "joined": str(user.date_joined)[:10],
                "last_active": str(user.date_joined)[:10],
            }
        ],
    }

    # Demo vendor — return representative data
    if user.email.lower() == DEMO_VENDOR_EMAIL:
        base.update({
            "stats": {"today_sales_aed": 45200, "active_inventory": 12, "sellback_requests": 3, "active_customers": 89},
            "pending_orders": [
                {"id": "ORD-5521", "customer": "Arjun M.", "product": "Gold Bar 100g", "qty_grams": 100, "price_aed": 24200, "expires_in": 48, "created_at": "2026-04-19T09:42:00Z"},
                {"id": "ORD-5520", "customer": "Sara K.", "product": "Gold Bar 50g", "qty_grams": 50, "price_aed": 12100, "expires_in": 31, "created_at": "2026-04-19T09:38:00Z"},
                {"id": "ORD-5518", "customer": "David L.", "product": "Krugerrand 1oz", "qty_grams": 31.1, "price_aed": 7540, "expires_in": 12, "created_at": "2026-04-19T09:31:00Z"},
            ],
            "sellback_queue": [
                {"id": "SB-2201", "customer": "Priya R.", "product": "Gold Bar 100g", "qty_grams": 20, "payout_aed": 5200, "status": "pending", "requested_at": "2026-04-19T08:10:00Z"},
                {"id": "SB-2198", "customer": "Omar F.", "product": "Silver Bar 1kg", "qty_grams": 500, "payout_aed": 139, "status": "pending", "requested_at": "2026-04-18T16:45:00Z"},
            ],
            "catalog": [
                {"id": 1, "name": "24K Gold Bar 100g", "metal": "gold", "weight": 100, "purity": "999.9", "rate_per_gram": 242, "buyback_per_gram": 236, "in_stock": True, "visible": True, "stock_qty": 45},
                {"id": 2, "name": "24K Gold Bar 50g", "metal": "gold", "weight": 50, "purity": "999.9", "rate_per_gram": 243, "buyback_per_gram": 237, "in_stock": True, "visible": True, "stock_qty": 30},
                {"id": 3, "name": "Gold Krugerrand 1oz", "metal": "gold", "weight": 31.1, "purity": "916", "rate_per_gram": 242.5, "buyback_per_gram": 236.5, "in_stock": True, "visible": True, "stock_qty": 20},
                {"id": 4, "name": "Silver Bar 1kg", "metal": "silver", "weight": 1000, "purity": "999", "rate_per_gram": 0.29, "buyback_per_gram": 0.27, "in_stock": True, "visible": True, "stock_qty": 100},
                {"id": 5, "name": "Platinum Bar 100g", "metal": "platinum", "weight": 100, "purity": "999.5", "rate_per_gram": 415, "buyback_per_gram": 405, "in_stock": False, "visible": False, "stock_qty": 0},
            ],
            "inventory": {
                "summary": {"total_gold_grams": 4750, "total_silver_grams": 85000, "total_platinum_grams": 0, "reserved_gold_grams": 1200, "reserved_silver_grams": 8000},
                "alerts": [
                    {"product": "24K Gold Bar 100g", "message": "Stock below 50 units", "level": "warning"},
                    {"product": "Platinum Bar 100g", "message": "Out of stock", "level": "critical"},
                ],
                "items": [
                    {"id": 1, "name": "24K Gold Bar 100g", "metal": "gold", "available_grams": 4500, "reserved_grams": 1200, "total_grams": 5700, "available_units": 45, "reserved_units": 12},
                    {"id": 2, "name": "24K Gold Bar 50g", "metal": "gold", "available_grams": 1500, "reserved_grams": 500, "total_grams": 2000, "available_units": 30, "reserved_units": 10},
                    {"id": 3, "name": "Gold Krugerrand 1oz", "metal": "gold", "available_grams": 622, "reserved_grams": 93.3, "total_grams": 715.3, "available_units": 20, "reserved_units": 3},
                    {"id": 4, "name": "Silver Bar 1kg", "metal": "silver", "available_grams": 100000, "reserved_grams": 8000, "total_grams": 108000, "available_units": 100, "reserved_units": 8},
                ],
            },
            "financials": {"pool_balance_aed": 342800, "pending_debits_aed": 5339, "credits_today_aed": 45200, "available_balance_aed": 337461},
            "statements": [
                {"id": "EOD-20260419", "date": "2026-04-19", "total_sales_aed": 45200, "total_sellbacks_aed": 5339, "net_aed": 39861, "transactions": 7, "status": "final"},
                {"id": "EOD-20260418", "date": "2026-04-18", "total_sales_aed": 38700, "total_sellbacks_aed": 2100, "net_aed": 36600, "transactions": 5, "status": "final"},
                {"id": "EOD-20260417", "date": "2026-04-17", "total_sales_aed": 61200, "total_sellbacks_aed": 0, "net_aed": 61200, "transactions": 9, "status": "final"},
            ],
            "team": [
                {"id": 1, "name": "Hassan Al-Rashid", "email": "hassan@emiratesgold.com", "role": "Owner", "status": "active", "joined": "2025-01-10", "last_active": "2026-04-19"},
                {"id": 2, "name": "Lina Khoury", "email": "lina@emiratesgold.com", "role": "Sales Staff", "status": "active", "joined": "2025-03-15", "last_active": "2026-04-19"},
            ],
        })

    vcomp = vendor_compliance_verification(user)
    base['compliance'] = vcomp
    if user.email.lower() == DEMO_VENDOR_EMAIL:
        base['compliance'] = {
            'status': 'verified',
            'trading_allowed': True,
            'pending_items': [],
        }

    return base


def _admin_dashboard_data():
    all_users = list(User.objects.values(
        'id', 'email', 'first_name', 'last_name', 'user_type',
        'kyc_status', 'is_active', 'date_joined', 'vendor_company', 'country',
    ))
    formatted_users = [
        {
            'id': u['id'],
            'name': f"{u['first_name']} {u['last_name']}".strip() or u['email'],
            'email': u['email'],
            'user_type': u['user_type'],
            'kyc_status': u['kyc_status'],
            'is_active': u['is_active'],
            'joined': str(u['date_joined'])[:10],
            'vendor_company': u['vendor_company'],
            'country': u['country'],
        }
        for u in all_users
    ]

    # Real vendor data from DB
    vendor_users = [u for u in formatted_users if u['user_type'] == 'vendor']
    vendor_list = [
        {
            'id': str(v['id']),
            'company': v['vendor_company'] or v['email'],
            'owner': v['name'],
            'email': v['email'],
            'kyb_status': v['kyc_status'],
            'is_active': v['is_active'],
            'total_listings': 0,
            'total_volume_aed': 0,
            'joined': v['joined'],
            'country': v['country'] or 'UAE',
        }
        for v in vendor_users
    ]

    customer_ids = [u['id'] for u in formatted_users if u['user_type'] == 'customer']
    bank_by_uid = {}
    if customer_ids:
        bank_by_uid = {
            b.user_id: b.status
            for b in CustomerBankDetails.objects.filter(user_id__in=customer_ids)
        }

    # Customers: any open verification (identity KYC, documents, bank) — not only kyc_status=pending.
    kyc_queue = []
    customers_qs = (
        User.objects.filter(user_type=User.CUSTOMER)
        .select_related('bank_details')
        .prefetch_related('kyc_documents')
    )
    for cu in customers_qs:
        comp = customer_compliance_verification(cu)
        if comp['trading_allowed']:
            continue
        u = next((x for x in formatted_users if x['id'] == cu.id), None)
        if not u:
            continue
        entry = dict(u)
        entry['bank_status'] = bank_by_uid.get(u['id'], 'not_added')
        can_kyc, _ = customer_ready_for_kyc_approval(cu)
        identity_pending = u['kyc_status'] == User.KYC_PENDING
        entry['identity_decision_pending'] = identity_pending
        entry['can_approve_kyc'] = bool(can_kyc and identity_pending)
        entry['pending_review_labels'] = [p.get('label', '') for p in comp['pending_items'][:8]]
        kyc_queue.append(entry)
    kyc_queue.sort(key=lambda e: (0 if e.get('identity_decision_pending') else 1, e['id']))

    # Bank-only reviews are merged into kyc_queue above; keep key for older clients.
    bank_review_queue = []

    # Vendors: any open KYB/doc verification — not only kyc_status=pending.
    kyb_queue = []
    vendors_qs = User.objects.filter(user_type=User.VENDOR).prefetch_related('kyc_documents')
    for vu in vendors_qs:
        comp = vendor_compliance_verification(vu)
        if comp['trading_allowed']:
            continue
        u = next((x for x in formatted_users if x['id'] == vu.id), None)
        if not u:
            continue
        entry = dict(u)
        can_kyb, _ = vendor_ready_for_kyb_approval(vu)
        identity_pending = u['kyc_status'] == User.KYC_PENDING
        entry['identity_decision_pending'] = identity_pending
        entry['can_approve_kyb'] = bool(can_kyb and identity_pending)
        entry['pending_review_labels'] = [p.get('label', '') for p in comp['pending_items'][:8]]
        kyb_queue.append(entry)
    kyb_queue.sort(key=lambda e: (0 if e.get('identity_decision_pending') else 1, e['id']))

    # ── Real sales / revenue data ──────────────────────────────────
    paid_orders_all = (
        Order.objects
        .filter(status=Order.PAID)
        .select_related('customer', 'product', 'product__vendor')
        .order_by('-created_at')
    )

    total_buy_volume   = sum(float(o.total_aed) for o in paid_orders_all)
    platform_fees_total = sum(float(o.platform_fee_aed) for o in paid_orders_all)
    vendor_payouts     = total_buy_volume - platform_fees_total

    sell_non_rejected = list(
        SellOrder.objects
        .exclude(status=SellOrder.REJECTED)
        .select_related('customer', 'buy_order__product__vendor')
    )
    completed_sells = [s for s in sell_non_rejected if s.status == SellOrder.COMPLETED]
    cridora_from_sells = sum(float(s.cridora_share_aed) for s in completed_sells)
    total_sellback_volume = sum(float(s.gross_aed) for s in completed_sells)
    platform_revenue_combined = platform_fees_total + cridora_from_sells

    # Recent transactions: last 50 by time (PAID buys + all non-rejected sell orders)
    def _tx_customer(u):
        return f"{u.first_name} {u.last_name}".strip() or u.email

    SELL_TX_STATUS = {
        SellOrder.PENDING_VENDOR:  'Pending',
        SellOrder.VENDOR_ACCEPTED: 'Pending',
        SellOrder.ADMIN_APPROVED:  'Pending',
        SellOrder.COMPLETED:       'Completed',
        SellOrder.REJECTED:        'Rejected',
    }
    recent_tx_merged = []
    for o in paid_orders_all:
        recent_tx_merged.append((
            o.created_at,
            0,
            o.id,
            {
                "id": o.order_ref,
                "type": "BUY",
                "customer": _tx_customer(o.customer),
                "vendor": o.product.vendor.vendor_company or o.product.vendor.email,
                "product": o.product.name,
                "amount_aed": float(o.total_aed),
                "platform_fee_aed": float(o.platform_fee_aed),
                "status": "Completed",
                "date": str(o.created_at)[:10],
            },
        ))
    for so in sell_non_rejected:
        recent_tx_merged.append((
            so.created_at,
            1,
            so.id,
            {
                "id": so.order_ref,
                "type": "SELL",
                "customer": _tx_customer(so.customer),
                "vendor": so.buy_order.product.vendor.vendor_company or so.buy_order.product.vendor.email,
                "product": so.buy_order.product.name,
                "amount_aed": float(so.gross_aed),
                "platform_fee_aed": float(so.cridora_share_aed),
                "status": SELL_TX_STATUS.get(so.status, so.status),
                "date": str(so.created_at)[:10],
            },
        ))
    recent_tx_merged.sort(key=lambda x: (x[0], x[1], x[2]), reverse=True)
    recent_transactions = [t[3] for t in recent_tx_merged[:50]]

    # Platform revenue ledger (oldest first): each row + running admin cash balance
    buy_rev_rows = list(
        Order.objects
        .filter(status=Order.PAID)
        .select_related('customer', 'product', 'product__vendor')
        .order_by('created_at', 'id')
    )
    sell_rev_rows = list(
        SellOrder.objects
        .exclude(status=SellOrder.REJECTED)
        .select_related('customer', 'buy_order__product__vendor')
        .order_by('created_at', 'id')
    )
    rev_merged = []
    for o in buy_rev_rows:
        rev_merged.append((
            o.created_at, 'BUY', o, None,
        ))
    for so in sell_rev_rows:
        rev_merged.append((
            so.created_at, 'SELL', None, so,
        ))
    rev_merged.sort(key=lambda x: (x[0], x[1], x[2].id if x[1] == 'BUY' else x[3].id))

    balance = 0.0
    platform_revenue_ledger = []
    for _ts, kind, o, so in rev_merged:
        if kind == 'BUY':
            ar = float(o.platform_fee_aed)
            balance += ar
            platform_revenue_ledger.append({
                "id": o.order_ref,
                "type": "BUY",
                "date": str(o.created_at)[:10],
                "customer": _tx_customer(o.customer),
                "vendor": o.product.vendor.vendor_company or o.product.vendor.email,
                "product": o.product.name,
                "order_total_aed": float(o.total_aed),
                "admin_revenue_aed": round(ar, 2),
                "balance_after_aed": round(balance, 2),
            })
        else:
            done = so.status == SellOrder.COMPLETED
            ar = float(so.cridora_share_aed) if done else 0.0
            balance += ar
            platform_revenue_ledger.append({
                "id": so.order_ref,
                "type": "SELL",
                "date": str(so.created_at)[:10],
                "customer": _tx_customer(so.customer),
                "vendor": so.buy_order.product.vendor.vendor_company or so.buy_order.product.vendor.email,
                "product": so.buy_order.product.name,
                "order_total_aed": float(so.gross_aed),
                "admin_revenue_aed": round(ar, 2),
                "balance_after_aed": round(balance, 2),
            })

    # Pending settlement = value of VENDOR_ACCEPTED orders (accepted but not yet paid)
    pending_settlement = sum(
        float(o.total_aed)
        for o in Order.objects.filter(status=Order.VENDOR_ACCEPTED)
    )

    # Vendor pool balances (per vendor, from PAID orders)
    vendor_pool_map = {}
    for o in paid_orders_all:
        vid = o.product.vendor_id
        vname = o.product.vendor.vendor_company or o.product.vendor.email
        if vid not in vendor_pool_map:
            vendor_pool_map[vid] = {"vendor": vname, "pool_balance_aed": 0.0, "reserved_aed": 0.0}
        vendor_pool_map[vid]["pool_balance_aed"] += float(o.total_aed) - float(o.platform_fee_aed)

    for o in Order.objects.filter(status=Order.VENDOR_ACCEPTED).select_related('product', 'product__vendor'):
        vid = o.product.vendor_id
        vname = o.product.vendor.vendor_company or o.product.vendor.email
        if vid not in vendor_pool_map:
            vendor_pool_map[vid] = {"vendor": vname, "pool_balance_aed": 0.0, "reserved_aed": 0.0}
        vendor_pool_map[vid]["reserved_aed"] += float(o.total_aed)

    vendor_pools = [
        {
            "vendor": v["vendor"],
            "pool_balance_aed": round(v["pool_balance_aed"], 2),
            "reserved_aed": round(v["reserved_aed"], 2),
            "available_aed": round(v["pool_balance_aed"], 2),
        }
        for v in sorted(vendor_pool_map.values(), key=lambda x: -x["pool_balance_aed"])
    ]

    # Enrich vendor_list with real volume and listing counts
    vendor_volume_map = {}
    for o in paid_orders_all:
        vid = o.product.vendor_id
        vendor_volume_map[vid] = vendor_volume_map.get(vid, 0) + float(o.total_aed)

    vendor_listing_map = {}
    for p in CatalogProduct.objects.filter(visible=True).values('vendor_id'):
        vid = p['vendor_id']
        vendor_listing_map[vid] = vendor_listing_map.get(vid, 0) + 1

    enriched_vendor_list = []
    for v in vendor_list:
        vid = int(v["id"])
        vu = User.objects.get(id=vid)
        can_kyb = False
        if v["kyb_status"] == User.KYC_PENDING:
            can_kyb, _ = vendor_ready_for_kyb_approval(vu)
        enriched_vendor_list.append({
            **v,
            "total_listings": vendor_listing_map.get(vid, 0),
            "total_volume_aed": round(vendor_volume_map.get(vid, 0), 2),
            "can_approve_kyb": can_kyb,
        })

    today_str = str(timezone.now())[:10]

    non_admin_ids = [u['id'] for u in formatted_users if u['user_type'] != User.ADMIN]
    doc_counts = {}
    if non_admin_ids:
        doc_counts = {
            row['user_id']: row['n']
            for row in KYCDocument.objects.filter(user_id__in=non_admin_ids)
            .values('user_id')
            .annotate(n=Count('id'))
        }
    verification_directory = []
    for u in formatted_users:
        if u['user_type'] == User.ADMIN:
            continue
        uid = u['id']
        item = {
            'id': uid,
            'name': u['name'],
            'email': u['email'],
            'user_type': u['user_type'],
            'kyc_status': u['kyc_status'],
            'joined': u['joined'],
            'doc_count': doc_counts.get(uid, 0),
        }
        if u['user_type'] == User.CUSTOMER:
            item['bank_status'] = bank_by_uid.get(uid, 'not_added')
        else:
            item['bank_status'] = None
        verification_directory.append(item)

    return {
        "stats": {
            "total_users":               User.objects.count(),
            "active_users":              User.objects.filter(user_type=User.CUSTOMER, is_active=True).count(),
            "pending_users":             User.objects.filter(user_type=User.CUSTOMER, kyc_status=User.KYC_PENDING).count(),
            "total_vendors":             User.objects.filter(user_type=User.VENDOR).count(),
            "pending_vendors":           User.objects.filter(user_type=User.VENDOR, kyc_status=User.KYC_PENDING).count(),
            "total_transactions":        Order.objects.count(),
            "total_buy_volume_aed":      round(total_buy_volume, 2),
            "total_sellback_volume_aed": round(total_sellback_volume, 2),
            "platform_revenue_aed":      round(platform_revenue_combined, 2),
            "platform_buy_fees_aed":     round(platform_fees_total, 2),
            "platform_sell_cridora_aed": round(cridora_from_sells, 2),
            "active_vendors":            User.objects.filter(user_type=User.VENDOR, is_active=True, kyc_status=User.KYC_VERIFIED).count(),
            "alerts":                    len(kyc_queue) + len(kyb_queue),
        },
        "users": formatted_users,
        "verification_directory": verification_directory,
        "kyc_queue": kyc_queue,
        "bank_review_queue": bank_review_queue,
        "kyb_queue": kyb_queue,
        "vendors": enriched_vendor_list,
        "recent_transactions": recent_transactions,
        "platform_revenue_ledger": platform_revenue_ledger,
        "settlement": {
            "total_inflow_aed":        round(total_buy_volume, 2),
            "vendor_payouts_aed":      round(vendor_payouts, 2),
            "platform_fees_aed":       round(platform_fees_total, 2),
            "pending_settlement_aed":  round(pending_settlement, 2),
            "last_reconciled":         today_str,
            "reconciliation_status":   "current",
            "vendor_pools":            vendor_pools,
        },
        "fees_config": {
            **_config_to_dict(PlatformConfig.get()),
            "vendor_tiers": [
                {"tier": "Standard", "fee_pct": 2.0, "min_volume_aed": 0},
                {"tier": "Premium",  "fee_pct": 1.5, "min_volume_aed": 500000},
                {"tier": "Elite",    "fee_pct": 1.0, "min_volume_aed": 2000000},
            ],
            "feature_flags": {"stripe_payments": True, "crypto_payments": False, "kyc_auto_verify": False, "vendor_insights": True, "platform_maintenance": False},
        },
        "risk_disputes": [],
        "audit_logs": [],
        "password_reset_requests": PasswordResetRequest.objects.filter(
            status=PasswordResetRequest.PENDING
        ).count(),
    }
