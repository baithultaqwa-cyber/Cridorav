"""Catalog and staging product images: local MEDIA_ROOT or S3-compatible object storage."""
from functools import lru_cache

from django.conf import settings
from django.core.files.storage import FileSystemStorage


@lru_cache(maxsize=1)
def get_catalog_media_storage():
    if getattr(settings, 'CATALOG_MEDIA_USE_S3', False):
        from storages.backends.s3boto3 import S3Boto3Storage

        opts = getattr(settings, 'CATALOG_MEDIA_S3_STORAGE_OPTIONS', None) or {}
        return S3Boto3Storage(**opts)
    return FileSystemStorage(location=str(settings.MEDIA_ROOT))
