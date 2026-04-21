"""
WSGI config for cridora project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/wsgi/
"""

import logging
import os
import traceback

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cridora.settings')

logger = logging.getLogger('cridora.wsgi')

try:
    from django.core.wsgi import get_wsgi_application
    _django_app = get_wsgi_application()
    logger.info('Django WSGI application loaded successfully.')
except Exception:
    logger.critical(
        'Failed to load Django WSGI application at startup:\n%s',
        traceback.format_exc(),
    )
    raise


def application(environ, start_response):
    """Thin wrapper around the Django WSGI app that logs any unhandled exception."""
    try:
        return _django_app(environ, start_response)
    except Exception:
        path = environ.get('PATH_INFO', '<unknown>')
        method = environ.get('REQUEST_METHOD', '<unknown>')
        logger.critical(
            'Unhandled exception in WSGI application for %s %s:\n%s',
            method,
            path,
            traceback.format_exc(),
        )
        raise

