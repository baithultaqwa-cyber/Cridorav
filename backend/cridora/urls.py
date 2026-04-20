from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from .spot_prices import SpotPriceView

urlpatterns = [
    path('monkey123/', admin.site.urls),
    path('api/auth/', include('users.urls')),
    path('api/spot-prices/', SpotPriceView.as_view(), name='spot-prices'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
