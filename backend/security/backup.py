"""Create a gzipped Postgres dump (or Django dumpdata fallback) and optionally upload to S3."""
from __future__ import annotations

import gzip
import hashlib
import logging
import os
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from django.conf import settings

logger = logging.getLogger(__name__)


def _db_url() -> str:
    return (getattr(settings, 'DATABASE_URL', None) or os.environ.get('DATABASE_URL') or '').strip()


def _backup_dir() -> Path:
    raw = os.environ.get('BACKUP_DIR', '').strip()
    if raw:
        return Path(raw)
    return Path(getattr(settings, 'BASE_DIR', Path('.'))) / 'backups'


def write_dump(dest_gz: Path) -> str:
    """Write backup file. Returns 'pg_dump' or 'dumpdata'."""
    dest_gz.parent.mkdir(parents=True, exist_ok=True)
    db_url = _db_url()
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        if db_url and shutil.which('pg_dump'):
            raw = tmp_path / f'cridora-{stamp}.dump'
            env = os.environ.copy()
            cmd = [
                'pg_dump',
                '--no-owner',
                '--no-acl',
                '--format=custom',
                f'--dbname={db_url}',
                f'--file={raw}',
            ]
            try:
                subprocess.run(cmd, check=True, env=env, capture_output=True, timeout=600)
                with open(raw, 'rb') as src, gzip.open(dest_gz, 'wb') as out:
                    shutil.copyfileobj(src, out)
                return 'pg_dump'
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError) as exc:
                logger.warning('pg_dump failed, falling back to dumpdata: %s', exc)

        from django.core.management import call_command
        json_path = tmp_path / f'cridora-{stamp}.json'
        with open(json_path, 'w', encoding='utf-8') as fh:
            call_command(
                'dumpdata',
                '--natural-foreign',
                '--natural-primary',
                '-e', 'contenttypes',
                '-e', 'auth.Permission',
                '-e', 'sessions',
                '-e', 'admin.LogEntry',
                '-e', 'token_blacklist',
                stdout=fh,
            )
        with open(json_path, 'rb') as src, gzip.open(dest_gz, 'wb') as out:
            shutil.copyfileobj(src, out)
        return 'dumpdata'


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def rotate_local(directory: Path, keep: int = 14) -> None:
    files = sorted(directory.glob('cridora-backup-*.gz'), key=lambda p: p.stat().st_mtime, reverse=True)
    for old in files[keep:]:
        try:
            old.unlink()
        except OSError:
            logger.warning('Could not delete old backup %s', old.name)


def upload_to_s3(path: Path) -> str | None:
    bucket = (
        os.environ.get('BACKUP_S3_BUCKET', '').strip()
        or os.environ.get('CATALOG_MEDIA_S3_BUCKET', '').strip()
    )
    if not bucket:
        return None
    try:
        import boto3
    except ImportError:
        logger.warning('boto3 not available; skip S3 backup upload')
        return None
    key_prefix = os.environ.get('BACKUP_S3_PREFIX', 'cridora-backups').strip().strip('/')
    key = f'{key_prefix}/{path.name}'
    extra = {}
    endpoint = os.environ.get('CATALOG_MEDIA_S3_ENDPOINT_URL', '').strip()
    region = os.environ.get('CATALOG_MEDIA_S3_REGION', 'us-east-1').strip() or 'us-east-1'
    access = (
        os.environ.get('BACKUP_S3_ACCESS_KEY_ID', '').strip()
        or os.environ.get('CATALOG_MEDIA_S3_ACCESS_KEY_ID', '').strip()
        or os.environ.get('AWS_ACCESS_KEY_ID', '').strip()
    )
    secret = (
        os.environ.get('BACKUP_S3_SECRET_ACCESS_KEY', '').strip()
        or os.environ.get('CATALOG_MEDIA_S3_SECRET_ACCESS_KEY', '').strip()
        or os.environ.get('AWS_SECRET_ACCESS_KEY', '').strip()
    )
    client_kw = {'region_name': region}
    if endpoint:
        client_kw['endpoint_url'] = endpoint
    if access and secret:
        client_kw['aws_access_key_id'] = access
        client_kw['aws_secret_access_key'] = secret
    extra['ServerSideEncryption'] = 'AES256'
    client = boto3.client('s3', **client_kw)
    client.upload_file(str(path), bucket, key, ExtraArgs=extra)
    return f's3://{bucket}/{key}'


def run_backup(*, upload: bool = True, keep: int = 14) -> dict:
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    directory = _backup_dir()
    dest = directory / f'cridora-backup-{stamp}.gz'
    kind = write_dump(dest)
    digest = sha256_file(dest)
    sidecar = dest.with_suffix(dest.suffix + '.sha256')
    sidecar.write_text(f'{digest}  {dest.name}\n', encoding='utf-8')
    rotate_local(directory, keep=keep)
    remote = None
    if upload:
        try:
            remote = upload_to_s3(dest)
        except Exception:
            logger.exception('Backup S3 upload failed')
    logger.info('Backup complete kind=%s bytes=%s remote=%s', kind, dest.stat().st_size, remote or '-')
    return {
        'kind': kind,
        'path': str(dest),
        'sha256': digest,
        'bytes': dest.stat().st_size,
        'remote': remote,
    }
