"""Stream FileField content for local disk or remote (S3) storage."""
import os

from django.http import FileResponse, Http404


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
    resp = FileResponse(fh, as_attachment=as_attachment, filename=base)
    if content_type:
        resp["Content-Type"] = content_type
    return resp
