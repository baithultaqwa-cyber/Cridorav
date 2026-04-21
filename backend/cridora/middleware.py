"""Middleware that logs every unhandled exception with a full traceback.

Placed first in MIDDLEWARE so it wraps the entire Django stack. Any exception
that bubbles up without being caught by a view or DRF will be logged here
before Django converts it into a 500/502 response.
"""
import logging
import traceback

logger = logging.getLogger('cridora.middleware')


class LogExceptionMiddleware:
    """Log all unhandled exceptions with full tracebacks to stdout."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            response = self.get_response(request)
        except Exception as exc:
            logger.error(
                'Unhandled exception during %s %s\n%s',
                request.method,
                request.get_full_path(),
                traceback.format_exc(),
                exc_info=exc,
            )
            raise
        return response

    def process_exception(self, request, exception):
        """Also called by Django for exceptions raised inside views."""
        logger.error(
            'Exception in view %s %s: %s\n%s',
            request.method,
            request.get_full_path(),
            exception,
            traceback.format_exc(),
            exc_info=exception,
        )
        # Return None so Django's normal exception handling continues.
        return None
