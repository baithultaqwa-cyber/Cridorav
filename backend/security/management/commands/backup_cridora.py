"""Dump Postgres (or dumpdata fallback), gzip, rotate, optionally upload to S3.

Usage:
  python manage.py backup_cridora
  python manage.py backup_cridora --loop   # every BACKUP_INTERVAL_HOURS (default 24)
"""
from __future__ import annotations

import logging
import os
import time

from django.core.management.base import BaseCommand

from security.backup import run_backup

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Create an encrypted-at-rest (gzip + S3 SSE) database backup.'

    def add_arguments(self, parser):
        parser.add_argument('--no-upload', action='store_true', help='Skip S3 upload')
        parser.add_argument('--keep', type=int, default=14, help='Local backups to retain')
        parser.add_argument('--loop', action='store_true', help='Repeat on an interval (Railway worker)')

    def handle(self, *args, **options):
        upload = not options['no_upload']
        keep = max(1, int(options['keep'] or 14))
        loop = bool(options['loop'])
        try:
            hours = float(os.environ.get('BACKUP_INTERVAL_HOURS', '24') or 24)
        except ValueError:
            hours = 24.0
        seconds = max(3600.0, hours * 3600.0)

        while True:
            result = run_backup(upload=upload, keep=keep)
            self.stdout.write(
                self.style.SUCCESS(
                    f"backup ok kind={result['kind']} bytes={result['bytes']} "
                    f"remote={result['remote'] or 'local-only'}"
                )
            )
            if not loop:
                return
            logger.info('Next backup in %.0f hours', hours)
            time.sleep(seconds)
