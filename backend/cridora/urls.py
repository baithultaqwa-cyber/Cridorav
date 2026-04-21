from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import RedirectView
from django.conf import settings
from django.conf.urls.static import static

from .health import healthz
from .frontend_spa import spa_index, serve_frontend_asset, serve_frontend_root_file
from .spot_prices import SpotPriceView
from .retail_rates import DubaiRetailRatesView

urlpatterns = [
    path('healthz/', healthz),
    path('admin/', RedirectView.as_view(url='/monkey123/', query_string=True)),
    path('monkey123/', admin.site.urls),
    path('api/auth/', include('users.urls')),
    path('api/spot-prices/', SpotPriceView.as_view(), name='spot-prices'),
    path(
        'api/dubai-retail-rates/',
        DubaiRetailRatesView.as_view(),
        name='dubai-retail-rates',
    ),
    path('assets/<path:path>', serve_frontend_asset),
    path(
        'config.runtime.js',
        serve_frontend_root_file,
        {'name': 'config.runtime.js'},
    ),
    path('', spa_index),
    re_path(
        r'^(?!api/|healthz/|monkey123/|admin/|media/|static/|assets/).*$',
        spa_index,
    ),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
