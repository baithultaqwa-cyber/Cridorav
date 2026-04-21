from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView
from django.conf import settings
from django.conf.urls.static import static

from .health import healthz
from .spot_prices import SpotPriceView

urlpatterns = [
    path('', healthz),
    path('healthz/', healthz),
    path('admin/', RedirectView.as_view(url='/monkey123/', query_string=True)),
    path('monkey123/', admin.site.urls),
    path('api/auth/', include('users.urls')),
    path('api/spot-prices/', SpotPriceView.as_view(), name='spot-prices'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
