import json
import requests as http_requests

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
from .models import User, KYCDocument, VendorPricingConfig, CatalogProduct, CustomerBankDetails, PlatformConfig, Order, VendorSchedule, SellOrder, PasswordResetRequest


def _doc_to_dict(doc, request):
    return {
        'id': doc.id,
        'doc_type': doc.doc_type,
        'label': KYCDocument.DOC_TYPE_LABELS.get(doc.doc_type, doc.doc_type),
        'file_url': request.build_absolute_uri(doc.file.url) if doc.file else None,
        'original_filename': doc.original_filename,
        'status': doc.status,
        'rejection_reason': doc.rejection_reason,
        'uploaded_at': str(doc.uploaded_at)[:16],
        'reviewed_at': str(doc.reviewed_at)[:16] if doc.reviewed_at else None,
    }


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


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data)


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
        user.kyc_status = User.KYC_VERIFIED if action == 'approve' else User.KYC_REJECTED
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
        user.kyc_status = User.KYC_VERIFIED if action == 'approve' else User.KYC_REJECTED
        if action == 'approve':
            user.is_active = True
        user.save(update_fields=['kyc_status', 'is_active'])
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

        doc, _ = KYCDocument.objects.get_or_create(user=request.user, doc_type=doc_type)
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
        doc.save()

        if request.user.kyc_status == User.KYC_REJECTED:
            request.user.kyc_status = User.KYC_PENDING
            request.user.save(update_fields=['kyc_status'])

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

        result = []
        for dt in required:
            if dt in uploaded:
                result.append(_doc_to_dict(uploaded[dt], request))
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

        return Response(_doc_to_dict(doc, request))


# ── Vendor pricing views ─────────────────────────────────────────

def _require_vendor(request):
    if request.user.user_type != User.VENDOR:
        return Response({'detail': 'Vendor access required.'}, status=status.HTTP_403_FORBIDDEN)
    return None


def _pricing_to_dict(cfg):
    return {
        'gold_rate': float(cfg.gold_rate),
        'silver_rate': float(cfg.silver_rate),
        'platinum_rate': float(cfg.platinum_rate),
        'palladium_rate': float(cfg.palladium_rate),
        'gold_buyback_deduction': float(cfg.gold_buyback_deduction),
        'silver_buyback_deduction': float(cfg.silver_buyback_deduction),
        'platinum_buyback_deduction': float(cfg.platinum_buyback_deduction),
        'palladium_buyback_deduction': float(cfg.palladium_buyback_deduction),
        # Computed effective buyback rates
        'gold_effective_buyback': max(0.0, float(cfg.gold_rate) - float(cfg.gold_buyback_deduction)),
        'silver_effective_buyback': max(0.0, float(cfg.silver_rate) - float(cfg.silver_buyback_deduction)),
        'platinum_effective_buyback': max(0.0, float(cfg.platinum_rate) - float(cfg.platinum_buyback_deduction)),
        'palladium_effective_buyback': max(0.0, float(cfg.palladium_rate) - float(cfg.palladium_buyback_deduction)),
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
    }


class VendorPricingView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_vendor(request)
        if err:
            return err
        cfg, _ = VendorPricingConfig.objects.get_or_create(user=request.user)
        return Response(_pricing_to_dict(cfg))

    def post(self, request):
        err = _require_vendor(request)
        if err:
            return err
        cfg, _ = VendorPricingConfig.objects.get_or_create(user=request.user)
        fields = [
            'gold_rate', 'silver_rate', 'platinum_rate', 'palladium_rate',
            'gold_buyback_deduction', 'silver_buyback_deduction',
            'platinum_buyback_deduction', 'palladium_buyback_deduction',
            'feed_url', 'feed_enabled', 'feed_auth_header', 'feed_auth_value',
            'feed_gold_field', 'feed_silver_field', 'feed_platinum_field', 'feed_palladium_field',
        ]
        for f in fields:
            if f in request.data:
                setattr(cfg, f, request.data[f])
        cfg.save()
        CatalogProduct.objects.filter(vendor=request.user, use_live_rate=True).update(updated_at=timezone.now())
        return Response(_pricing_to_dict(cfg))


class VendorPriceFeedFetchView(APIView):
    """Fetch rates from the vendor's external API and update their config."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        err = _require_vendor(request)
        if err:
            return err
        cfg, _ = VendorPricingConfig.objects.get_or_create(user=request.user)

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

def _product_to_dict(p, request=None):
    image_url = None
    if p.image:
        image_url = request.build_absolute_uri(p.image.url) if request else p.image.url
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
            if 'image' in request.FILES:
                p.image = request.FILES['image']
                p.save(update_fields=['image'])
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
            .filter(visible=True, in_stock=True)
            .exclude(vendor__kyc_status=User.KYC_REJECTED)
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


# ── Customer profile update view ──────────────────────────────────

class UpdateProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        user = request.user
        d = request.data
        if 'first_name' in d:
            user.first_name = str(d['first_name']).strip()
        if 'last_name' in d:
            user.last_name = str(d['last_name']).strip()
        if 'phone' in d:
            user.phone = str(d['phone']).strip()
        if 'country' in d:
            user.country = str(d['country']).strip()
        user.save(update_fields=['first_name', 'last_name', 'phone', 'country'])
        return Response({
            'first_name': user.first_name,
            'last_name': user.last_name,
            'email': user.email,
            'phone': user.phone,
            'country': user.country,
        })


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
        request.user.kyc_status = User.KYC_PENDING
        request.user.save(update_fields=['kyc_status'])
        return Response(_bank_to_dict(bank))


# ── Admin platform fee config view ───────────────────────────────

def _config_to_dict(cfg):
    return {
        'buy_fee_pct':               float(cfg.buy_fee_pct),
        'sell_fee_pct':              float(cfg.sell_fee_pct),
        'sell_share_pct':            float(cfg.sell_share_pct),
        'quote_ttl_seconds':         int(cfg.quote_ttl_seconds),
        'vendor_accept_ttl_seconds': int(cfg.vendor_accept_ttl_seconds),
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
        decimal_fields = ('buy_fee_pct', 'sell_fee_pct', 'sell_share_pct')
        int_fields = ('quote_ttl_seconds', 'vendor_accept_ttl_seconds')
        for field in decimal_fields:
            if field in d:
                try:
                    setattr(cfg, field, float(d[field]))
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
        _, bank = self._get_bank(user_id)
        if bank is None:
            return Response({'detail': 'No bank details found for this user.'}, status=status.HTTP_404_NOT_FOUND)
        bank.status = CustomerBankDetails.VERIFIED if action == 'verify' else CustomerBankDetails.REJECTED
        bank.save(update_fields=['status'])
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
        if request.user.kyc_status != User.KYC_VERIFIED:
            return Response(
                {'detail': 'KYC verification is required before you can place orders.'},
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
        order = self._get_order(request, order_id)
        if not order:
            return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)
        if order.status == Order.EXPIRED:
            return Response({'detail': 'Order has expired.'}, status=status.HTTP_400_BAD_REQUEST)
        if order.status == Order.REJECTED:
            return Response({'detail': 'Order was rejected by the vendor.'}, status=status.HTTP_400_BAD_REQUEST)
        if order.status != Order.VENDOR_ACCEPTED:
            return Response({'detail': 'Payment is not available yet — waiting for vendor approval.'}, status=status.HTTP_400_BAD_REQUEST)

        # Reduce stock
        product = order.product
        if product.stock_qty >= order.qty_units:
            product.stock_qty -= order.qty_units
        else:
            product.stock_qty = 0
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


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        if not email:
            return Response({'detail': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            # Return success to avoid email enumeration
            return Response({'detail': 'If this email is registered, a reset request has been sent to admin.'})
        # Avoid duplicate pending requests
        if not PasswordResetRequest.objects.filter(user=user, status=PasswordResetRequest.PENDING).exists():
            PasswordResetRequest.objects.create(user=user)
        return Response({'detail': 'Reset request submitted. Admin will set a temporary password for you.'})


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
        if request.user.kyc_status != User.KYC_VERIFIED:
            return Response(
                {'detail': 'KYC verification is required before you can request sell-back.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        buy_order_id = request.data.get('buy_order_id')
        qty_grams    = request.data.get('qty_grams')
        if not buy_order_id or qty_grams is None:
            return Response({'detail': 'buy_order_id and qty_grams are required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            buy_order = Order.objects.get(id=buy_order_id, customer=request.user, status=Order.PAID)
        except Order.DoesNotExist:
            return Response({'detail': 'Buy order not found or not eligible for sell.'}, status=status.HTTP_404_NOT_FOUND)

        qty = round(float(qty_grams), 4)
        max_qty = float(buy_order.qty_grams)
        if qty <= 0 or qty > max_qty:
            return Response({'detail': f'qty_grams must be between 0.0001 and {max_qty}.'}, status=status.HTTP_400_BAD_REQUEST)

        cfg = PlatformConfig.get()
        buyback_rate   = buy_order.product.effective_buyback_per_gram()
        _mr = float(buy_order.metal_rate_per_gram)
        _ai = float(buy_order.rate_per_gram)
        purchase_rate  = _mr if _mr > 0 else (_ai if _ai > 0 else 0)
        gross          = round(qty * buyback_rate, 2)
        purchase_cost  = round(qty * purchase_rate, 2)
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
            "kyc": {**kyc_section, "documents": [
                {"type": "Passport", "status": "verified", "uploaded": "2026-02-10"},
                {"type": "Proof of Address", "status": "verified", "uploaded": "2026-02-10"},
            ]},
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

    SELL_STATUS_LABEL = {
        SellOrder.PENDING_VENDOR:  'Awaiting Vendor',
        SellOrder.VENDOR_ACCEPTED: 'Awaiting Admin (funds)',
        SellOrder.ADMIN_APPROVED:  'Funds Confirmed — Payout Pending',
        SellOrder.COMPLETED:       'Completed',
        SellOrder.REJECTED:        'Rejected',
    }
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

    # Orders list (all statuses)
    STATUS_LABEL = {
        Order.PENDING_VENDOR:  'Awaiting Vendor',
        Order.VENDOR_ACCEPTED: 'Pending Payment',
        Order.PAID:            'Completed',
        Order.REJECTED:        'Rejected',
        Order.EXPIRED:         'Expired',
    }
    orders_list = [{
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
    } for o in all_orders]

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

    kyc_queue_raw = [u for u in formatted_users if u['kyc_status'] == 'pending' and u['user_type'] == 'customer']
    kyc_queue = []
    for u in kyc_queue_raw:
        entry = dict(u)
        try:
            bank = CustomerBankDetails.objects.get(user_id=u['id'])
            entry['bank_status'] = bank.status
        except CustomerBankDetails.DoesNotExist:
            entry['bank_status'] = 'not_added'
        kyc_queue.append(entry)

    kyb_queue = [u for u in formatted_users if u['kyc_status'] == 'pending' and u['user_type'] == 'vendor']

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

    # Pending settlement = value of VENDOR_ACCEPTED orders (accepted but not yet paid)
    pending_settlement = sum(
        float(o.total_aed)
        for o in Order.objects.filter(status=Order.VENDOR_ACCEPTED)
    )

    # Recent transactions (last 50 PAID orders)
    recent_transactions = [
        {
            "id": o.order_ref,
            "type": "BUY",
            "customer": f"{o.customer.first_name} {o.customer.last_name}".strip() or o.customer.email,
            "vendor": o.product.vendor.vendor_company or o.product.vendor.email,
            "product": o.product.name,
            "amount_aed": float(o.total_aed),
            "platform_fee_aed": float(o.platform_fee_aed),
            "status": "Completed",
            "date": str(o.created_at)[:10],
        }
        for o in paid_orders_all[:50]
    ]

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

    enriched_vendor_list = [
        {
            **v,
            "total_listings":    vendor_listing_map.get(int(v["id"]), 0),
            "total_volume_aed":  round(vendor_volume_map.get(int(v["id"]), 0), 2),
        }
        for v in vendor_list
    ]

    today_str = str(timezone.now())[:10]

    return {
        "stats": {
            "total_users":               User.objects.count(),
            "active_users":              User.objects.filter(user_type=User.CUSTOMER, is_active=True).count(),
            "pending_users":             User.objects.filter(user_type=User.CUSTOMER, kyc_status=User.KYC_PENDING).count(),
            "total_vendors":             User.objects.filter(user_type=User.VENDOR).count(),
            "pending_vendors":           User.objects.filter(user_type=User.VENDOR, kyc_status=User.KYC_PENDING).count(),
            "total_transactions":        Order.objects.count(),
            "total_buy_volume_aed":      round(total_buy_volume, 2),
            "total_sellback_volume_aed": 0,
            "platform_revenue_aed":      round(platform_fees_total, 2),
            "active_vendors":            User.objects.filter(user_type=User.VENDOR, is_active=True, kyc_status=User.KYC_VERIFIED).count(),
            "alerts":                    len(kyc_queue) + len(kyb_queue),
        },
        "users": formatted_users,
        "kyc_queue": kyc_queue,
        "kyb_queue": kyb_queue,
        "vendors": enriched_vendor_list,
        "recent_transactions": recent_transactions,
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
