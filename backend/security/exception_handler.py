import logging

from django.conf import settings
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def cridora_exception_handler(exc, context):
    response = exception_handler(exc, context)
    request = context.get('request') if isinstance(context, dict) else None
    path = getattr(request, 'path', '') if request else ''

    if response is None:
        logger.exception('Unhandled API error path=%s', path[:120])
        if getattr(settings, 'DEBUG', False):
            return None
        return Response({'detail': 'Something went wrong. Please try again.'}, status=500)

    if response.status_code in (401, 403) and path.startswith('/api/'):
        logger.info('Authz denied status=%s path=%s', response.status_code, path[:120])

    if response.status_code >= 500 and not getattr(settings, 'DEBUG', False):
        return Response({'detail': 'Something went wrong. Please try again.'}, status=response.status_code)

    return response
