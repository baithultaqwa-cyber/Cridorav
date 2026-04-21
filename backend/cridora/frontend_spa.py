import mimetypes
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
def serve_frontend_root_file(request, name):
    allowed = {'config.runtime.js', 'favicon.ico', 'vite.svg'}
    if name not in allowed:
        raise Http404()
    d = _require_dist().resolve()
    target = (d / name).resolve()
    if target.parent != d:
        raise Http404()
    if not target.is_file():
        raise Http404()
    content_type, _ = mimetypes.guess_type(str(target))
    return FileResponse(
        open(target, 'rb'),
        content_type=content_type or 'application/octet-stream',
    )


@require_GET
def spa_index(request):
    d = _dist()
    if not d or not d.is_dir() or not (d / 'index.html').is_file():
        from .health import api_browser_fallback

        return api_browser_fallback(request)
    index = d / 'index.html'
    return FileResponse(open(index, 'rb'), content_type='text/html; charset=utf-8')
