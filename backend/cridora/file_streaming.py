"""Stream FileField content for local disk or remote (S3) storage."""
import mimetypes
import os

from django.http import FileResponse, Http404


def _content_type_from_bytes(head: bytes) -> str | None:
    """Detect MIME from magic bytes (S3 often stores application/octet-stream)."""
    if head.startswith(b"%PDF"):
        return "application/pdf"
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if len(head) >= 12 and head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp"
    return None


def _resolve_content_type(file_handle, basename: str, explicit: str | None) -> str:
    if explicit:
        return explicit
    pos = file_handle.tell()
    try:
        head = file_handle.read(32)
    finally:
        file_handle.seek(pos)
    sniffed = _content_type_from_bytes(head)
    if sniffed:
        return sniffed
    guessed, _ = mimetypes.guess_type(basename)
    if guessed:
        return guessed
    return "application/octet-stream"


def filefield_file_response(file_field, *, as_attachment=False, filename=None, content_type=None):
    if not file_field or not file_field.name:
        raise Http404()
    base = filename or os.path.basename(file_field.name)
    local_path = None
    try:
        local_path = file_field.path
    except (NotImplementedError, ValueError, AttributeError):
        pass
    if local_path and os.path.isfile(local_path):
        fh = open(local_path, "rb")
    else:
        try:
            fh = file_field.open("rb")
        except OSError:
            raise Http404()
    resolved = _resolve_content_type(fh, base, content_type)
    resp = FileResponse(fh, as_attachment=as_attachment, filename=base)
    resp["Content-Type"] = resolved
    return resp
