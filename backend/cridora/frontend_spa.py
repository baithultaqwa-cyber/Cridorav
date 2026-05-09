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


_SAFE_DIST_ROOT_NAME = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._-]*\Z')


@require_GET
def serve_spa_or_dist_root_file(request):
    """
    Serve single-segment root files from the Vite dist folder (PWA sw.js, manifest,
    precache, favicon, config.runtime.js). Multi-segment paths fall through to SPA shell.
    """
    raw = request.path_info.lstrip('/')
    if raw and '/' not in raw and _SAFE_DIST_ROOT_NAME.match(raw):
        d = _dist()
        if d and d.is_dir():
            base = d.resolve()
            target = (base / raw).resolve()
            try:
                target.relative_to(base)
            except ValueError:
                pass
            else:
                if target.is_file():
                    content_type, _ = mimetypes.guess_type(str(target))
                    if not content_type:
                        content_type = 'application/octet-stream'
                    if raw.endswith('.webmanifest'):
                        content_type = 'application/manifest+json'
                    elif raw == 'sw.js' or raw.endswith('sw.js'):
                        content_type = 'application/javascript; charset=utf-8'
                    elif raw.endswith('.js'):
                        content_type = 'application/javascript; charset=utf-8'
                    resp = FileResponse(open(target, 'rb'), content_type=content_type)
                    if raw == 'sw.js' or raw.endswith('sw.js'):
                        resp['Cache-Control'] = 'no-cache, no-store, must-revalidate'
                    elif raw.startswith('workbox-') and raw.endswith('.js'):
                        resp['Cache-Control'] = 'public, max-age=31536000, immutable'
                    elif raw.endswith('.webmanifest'):
                        resp['Cache-Control'] = 'public, max-age=3600'
                    return resp
    return spa_index(request)


@require_GET
def spa_index(request):
    d = _dist()
    if not d or not d.is_dir() or not (d / 'index.html').is_file():
        from .health import api_browser_fallback

        return api_browser_fallback(request)
    index = d / 'index.html'
    return FileResponse(open(index, 'rb'), content_type='text/html; charset=utf-8')
