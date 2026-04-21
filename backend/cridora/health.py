"""Liveness/readiness — no DB access (safe while Postgres warms up)."""
from django.http import HttpResponse


def healthz(_request):
    return HttpResponse('ok', content_type='text/plain')


def root(request):
    """Browsers opening the API host see a hint; probes and curl get plain ok."""
    accept = request.headers.get('Accept', '')
    if 'text/html' in accept:
        body = (
            '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width, initial-scale=1">'
            '<title>Cridora API</title></head>'
            '<body style="font-family:system-ui,sans-serif;padding:2rem;max-width:36rem;line-height:1.5">'
            '<h1 style="font-size:1.25rem">Cridora API</h1>'
            '<p>This URL is the <strong>backend API</strong>, not the website. '
            'In Railway, open the <strong>frontend</strong> service’s public URL to use the app.</p>'
            '<p>On the frontend service, set <code>CRIDORA_API_ORIGIN</code> to this API’s HTTPS URL '
            '(no trailing slash) if the app cannot reach the API.</p>'
            '<p>Health check: <a href="/healthz/">/healthz/</a></p>'
            '</body></html>'
        )
        return HttpResponse(body, content_type='text/html; charset=utf-8')
    return HttpResponse('ok', content_type='text/plain')
