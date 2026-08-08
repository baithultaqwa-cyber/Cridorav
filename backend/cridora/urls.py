from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import RedirectView
from users.payment_stripe import stripe_webhook
from payments.views import TelrWebhookView
from .health import healthz
from .secure_media import serve_public_media
from .frontend_spa import (
    DIST_ROOT_FILES,
    spa_index,
    serve_dist_root_file,
    serve_frontend_asset,
    serve_frontend_demo,
    serve_spa_or_dist_root_file,
)
from .metal_history import MetalHistoryView
from .spot_prices import SpotPriceView
from .retail_rates import DubaiRetailRatesView
from .market_matrix import MarketRateMatrixView
from .rate_ledger_api import (
    RateLedgerLatestView,
    RateLedgerMovementsView,
    RateLedgerComparisonsView,
)
urlpatterns = [
    re_path(r'^healthz/?$', healthz),
    path('api/webhooks/stripe/', stripe_webhook, name='stripe-webhook'),
    path('api/webhooks/telr/', TelrWebhookView.as_view(), name='telr-webhook'),
    path('admin/', RedirectView.as_view(url='/monkey123/', query_string=True)),
    path('monkey123/', admin.site.urls),
    path('api/auth/', include('users.urls')),
    path('api/auth/otp/', include('otp.urls')),
    path('api/messaging/', include('messaging.urls')),
    path('api/vendor-kyc/', include('vendor_kyc.urls')),
    path('api/notifications/', include('notifications.urls')),
    path('api/payments/', include('payments.urls')),
    path('api/spot-prices/', SpotPriceView.as_view(), name='spot-prices'),
    path(
        'api/metal-history/',
        MetalHistoryView.as_view(),
        name='metal-history',
    ),
    path(
        'api/dubai-retail-rates/',
        DubaiRetailRatesView.as_view(),
        name='dubai-retail-rates',
    ),
    path(
        'api/market-rate-matrix/',
        MarketRateMatrixView.as_view(),
        name='market-rate-matrix',
    ),
    path(
        'api/rate-ledger/latest/',
        RateLedgerLatestView.as_view(),
        name='rate-ledger-latest',
    ),
    path(
        'api/rate-ledger/movements/',
        RateLedgerMovementsView.as_view(),
        name='rate-ledger-movements',
    ),
    path(
        'api/rate-ledger/comparisons/',
        RateLedgerComparisonsView.as_view(),
        name='rate-ledger-comparisons',
    ),
    path('assets/<path:path>', serve_frontend_asset),
    path('demos/<path:path>', serve_frontend_demo),
    *[
        path(name, serve_dist_root_file, {'filename': name})
        for name in DIST_ROOT_FILES
    ],
    path('', spa_index),
    re_path(
        r'^(?!api/|healthz/?|monkey123/|admin/|media/|static/|assets/|demos/).*$',
        serve_spa_or_dist_root_file,
    ),
]

urlpatterns += [
    re_path(r'^media/(?P<path>.*)$', serve_public_media),
]
