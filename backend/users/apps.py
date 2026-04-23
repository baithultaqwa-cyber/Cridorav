import logging
import os

from django.apps import AppConfig
from django.conf import settings

logger = logging.getLogger(__name__)


class UsersConfig(AppConfig):
    name = 'users'

    def ready(self):
        try:
            os.makedirs(settings.MEDIA_ROOT, mode=0o755, exist_ok=True)
        except OSError as exc:
            logger.warning('Could not create MEDIA_ROOT %s: %s', settings.MEDIA_ROOT, exc)
