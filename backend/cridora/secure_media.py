"""Serve public media (e.g. catalog images) but block direct access to KYC uploads."""
from django.conf import settings
from django.http import Http404
from django.views.static import serve


def serve_public_media(request, path):
    norm = path.replace('\\', '/').lstrip('/')
    if norm.startswith('kyc_docs/'):
        raise Http404()
    if (
        norm.startswith('payout_proofs/')
        or norm.startswith('vendor_repayments/')
        or norm.startswith('eod_ledgers/')
    ):
        raise Http404()
    return serve(request, path, document_root=settings.MEDIA_ROOT)
