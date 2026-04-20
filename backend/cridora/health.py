"""Liveness/readiness — no DB access (safe while Postgres warms up)."""
from django.http import HttpResponse


def healthz(_request):
    return HttpResponse('ok', content_type='text/plain')
