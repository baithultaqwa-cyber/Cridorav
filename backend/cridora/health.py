"""Liveness/readiness — no DB access (safe while Postgres warms up)."""
from django.http import HttpResponse


def healthz(_request):
    return HttpResponse('ok', content_type='text/plain')


def api_browser_fallback(request):
    """HTML when the SPA build is not present (e.g. backend-only deploy)."""
    accept = request.headers.get('Accept', '')
    if 'text/html' in accept:
        body = (
            '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width, initial-scale=1">'
            '<title>Cridora API</title></head>'
            '<body style="font-family:system-ui,sans-serif;padding:2rem;max-width:36rem;line-height:1.5">'
            '<h1 style="font-size:1.25rem">Cridora API</h1>'
            '<p>No web UI is bundled on this host. Build the frontend into '
            '<code>frontend_dist</code> (see repo-root <code>Dockerfile</code>) or deploy the '
            '<strong>frontend</strong> service separately and set <code>CRIDORA_API_ORIGIN</code> there.</p>'
            '<p>Health check: <a href="/healthz/">/healthz/</a></p>'
            '</body></html>'
        )
        return HttpResponse(body, content_type='text/html; charset=utf-8')
    return HttpResponse('ok', content_type='text/plain')
