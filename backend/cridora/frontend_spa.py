import mimetypes
import re
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404
from django.views.decorators.http import require_GET


def _dist() -> Path | None:
    return getattr(settings, 'FRONTEND_DIST_DIR', None)


def _require_dist() -> Path:
    d = _dist()
    if not d or not d.is_dir():
        raise Http404('Frontend not built')
    return d


@require_GET
def serve_frontend_asset(request, path):
    base = (_require_dist() / 'assets').resolve()
    target = (base / path).resolve()
    try:
        target.relative_to(base)
    except ValueError:
        raise Http404()
    if not target.is_file():
        raise Http404()
    content_type, _ = mimetypes.guess_type(str(target))
    return FileResponse(
        open(target, 'rb'),
        content_type=content_type or 'application/octet-stream',
    )


@require_GET
def serve_frontend_demo(request, path):
    """Serve Vite dist/demos/* (standalone HTML landings) — not the SPA shell."""
    base = (_require_dist() / 'demos').resolve()
    target = (base / path).resolve()
    try:
        target.relative_to(base)
    except ValueError:
        raise Http404()
    if not target.is_file():
        raise Http404()
    content_type, _ = mimetypes.guess_type(str(target))
    if path.endswith('.html'):
        content_type = 'text/html; charset=utf-8'
    resp = FileResponse(
        open(target, 'rb'),
        content_type=content_type or 'application/octet-stream',
    )
    resp['Cache-Control'] = 'no-cache, must-revalidate'
    return resp


_SAFE_DIST_ROOT_NAME = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._-]*\Z')

# Explicit routes for SEO/PWA root files (also matched by the SPA catch-all).
DIST_ROOT_FILES = (
    'sitemap.xml',
    'robots.txt',
    'llms.txt',
    'overview.txt',
    'marketplace.txt',
    'how-it-works.txt',
    'vendors.txt',
    'terms.txt',
    'uae-gold-comparison.txt',
    'openapi-public-v1.yaml',
    'manifest.webmanifest',
    'sw.js',
    'favicon.svg',
    'config.runtime.js',
    'apple-touch-icon-seal.png',
    'pwa-192-seal.png',
    'pwa-512-seal.png',
    'pwa-badge-96.png',
    'apple-touch-icon-black.png',
    'pwa-192-black.png',
    'pwa-512-black.png',
    'apple-touch-icon.png',
    'pwa-192.png',
    'pwa-512.png',
)


def _content_type_for_dist_root(raw: str) -> str:
    content_type, _ = mimetypes.guess_type(raw)
    if not content_type:
        content_type = 'application/octet-stream'
    if raw.endswith('.webmanifest'):
        content_type = 'application/manifest+json'
    elif raw.endswith('.xml'):
        content_type = 'application/xml; charset=utf-8'
    elif raw == 'sw.js' or raw.endswith('sw.js'):
        content_type = 'application/javascript; charset=utf-8'
    elif raw.endswith('.js'):
        content_type = 'application/javascript; charset=utf-8'
    elif raw.endswith('.txt'):
        content_type = 'text/plain; charset=utf-8'
    elif raw.endswith('.yaml') or raw.endswith('.yml'):
        content_type = 'application/yaml; charset=utf-8'
    elif raw.endswith('.png'):
        content_type = 'image/png'
    return content_type


_AGENT_ROOT_DOCS = frozenset(
    {
        'sitemap.xml',
        'robots.txt',
        'llms.txt',
        'overview.txt',
        'marketplace.txt',
        'how-it-works.txt',
        'vendors.txt',
        'terms.txt',
        'uae-gold-comparison.txt',
        'openapi-public-v1.yaml',
    }
)


def _cache_control_for_dist_root(raw: str) -> str | None:
    if raw == 'sw.js' or raw.endswith('sw.js'):
        return 'no-cache, no-store, must-revalidate'
    if raw.startswith('workbox-') and raw.endswith('.js'):
        return 'public, max-age=31536000, immutable'
    if raw.endswith('.webmanifest'):
        return 'no-cache, must-revalidate'
    if raw in _AGENT_ROOT_DOCS:
        return 'public, max-age=3600'
    # Versioned icon *paths* (…-seal.png) can be cached hard; legacy names must
    # revalidate so Cloudflare/Android don't keep serving a year-old tile.
    if raw.endswith('-seal.png') or raw == 'pwa-badge-96.png':
        return 'public, max-age=31536000, immutable'
    if raw in (
        'apple-touch-icon.png',
        'apple-touch-icon-black.png',
        'pwa-192.png',
        'pwa-192-black.png',
        'pwa-512.png',
        'pwa-512-black.png',
    ):
        return 'public, max-age=0, must-revalidate'
    return None


def _try_serve_dist_root_file(raw: str) -> FileResponse | None:
    if not raw or '/' in raw or not _SAFE_DIST_ROOT_NAME.match(raw):
        return None
    d = _dist()
    if not d or not d.is_dir():
        return None
    base = d.resolve()
    target = (base / raw).resolve()
    try:
        target.relative_to(base)
    except ValueError:
        return None
    if not target.is_file():
        return None
    resp = FileResponse(open(target, 'rb'), content_type=_content_type_for_dist_root(raw))
    cache_control = _cache_control_for_dist_root(raw)
    if cache_control:
        resp['Cache-Control'] = cache_control
    return resp


@require_GET
def serve_dist_root_file(request, filename):
    """Serve a named file from the Vite dist root (sitemap.xml, robots.txt, etc.)."""
    resp = _try_serve_dist_root_file(filename)
    if resp is None:
        raise Http404()
    return resp


@require_GET
def serve_spa_or_dist_root_file(request):
    """
    Serve single-segment root files from the Vite dist folder (PWA sw.js, manifest,
    precache, favicon, config.runtime.js). Multi-segment paths fall through to SPA shell.
    """
    raw = request.path_info.lstrip('/')
    resp = _try_serve_dist_root_file(raw)
    if resp is not None:
        return resp
    return spa_index(request)


@require_GET
def spa_index(request):
    d = _dist()
    if not d or not d.is_dir() or not (d / 'index.html').is_file():
        from .health import api_browser_fallback

        return api_browser_fallback(request)
    index = d / 'index.html'
    resp = FileResponse(open(index, 'rb'), content_type='text/html; charset=utf-8')
    # SPA shell must revalidate so new builds are visible; Workbox updates still require SW activation.
    resp['Cache-Control'] = 'no-cache, must-revalidate'
    return resp
