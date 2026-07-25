"""
One-time (but safely re-runnable) migration: copy any documents still sitting on local
disk / the Railway volume into Google Drive, under the exact same file path/name.

Why this matters: once GOOGLE_DRIVE_* env vars are set, STORAGES['default'] switches to
Google Drive for *new* saves, but documents uploaded *before* the switch still physically
live on local disk. Without this migration, KYCDocumentFileView etc. would look for those
older files in Drive, not find them, and "View" would break for every pre-switch document
-- exactly the kind of silent breakage we want to avoid for existing vendors/customers.

Safe to run multiple times: it skips anything already present in Drive, and skips (with a
warning, not a crash) anything genuinely missing from local disk. Run it once right after
setting GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET / GOOGLE_DRIVE_REFRESH_TOKEN,
before removing the Railway volume (if you ever choose to).

Usage (Railway -> Cridorav service -> Shell, or `railway ssh -s Cridorav`):
    python manage.py migrate_media_to_gdrive              # do the migration
    python manage.py migrate_media_to_gdrive --dry-run     # preview only, no uploads
"""
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import FileSystemStorage
from django.core.management.base import BaseCommand, CommandError

from cridora.gdrive_storage import GoogleDriveStorage
from users.models import (
    AdminVendorPayout,
    EodVendorLedger,
    KYCDocument,
    KYCDocumentSupersededSnapshot,
    VendorToAdminRepayment,
)

# (model, file field name, human label) -- every FileField that rides on STORAGES['default'].
TARGETS = [
    (KYCDocument, 'file', 'KYC/KYB document'),
    (KYCDocumentSupersededSnapshot, 'file', 'superseded KYC snapshot'),
    (AdminVendorPayout, 'proof_file', 'vendor payout proof'),
    (VendorToAdminRepayment, 'proof_file', 'vendor repayment proof'),
    (EodVendorLedger, 'pdf_file', 'EOD ledger PDF'),
]


class Command(BaseCommand):
    help = 'Copy documents still on local disk/volume into Google Drive, preserving their path.'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Preview only, upload nothing.')

    def handle(self, *args, **options):
        if not settings.GOOGLE_DRIVE_STORAGE_ENABLED:
            raise CommandError(
                'GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET / GOOGLE_DRIVE_REFRESH_TOKEN '
                'are not all set. Set them first, then re-run this command.'
            )
        dry_run = options['dry_run']
        local = FileSystemStorage(location=str(settings.MEDIA_ROOT))
        drive = GoogleDriveStorage()

        migrated = skipped_already_on_drive = skipped_missing_locally = failed = 0

        for model, field_name, label in TARGETS:
            queryset = model.objects.exclude(**{field_name: ''}).exclude(**{f'{field_name}__isnull': True})
            for obj in queryset.iterator():
                field_file = getattr(obj, field_name)
                name = field_file.name
                if not name:
                    continue

                try:
                    already_on_drive = drive.exists(name)
                except Exception as exc:  # noqa: BLE001
                    self.stderr.write(self.style.ERROR(f'[{label}] Drive check failed for {name}: {exc}'))
                    failed += 1
                    continue
                if already_on_drive:
                    skipped_already_on_drive += 1
                    continue

                if not local.exists(name):
                    self.stderr.write(self.style.WARNING(
                        f'[{label}] MISSING on local disk, cannot migrate: {name} (id={obj.pk})'
                    ))
                    skipped_missing_locally += 1
                    continue

                if dry_run:
                    self.stdout.write(f'[{label}] would migrate: {name}')
                    migrated += 1
                    continue

                try:
                    with local.open(name, 'rb') as fh:
                        raw = fh.read()
                    drive._save(name, ContentFile(raw))
                    self.stdout.write(self.style.SUCCESS(f'[{label}] migrated: {name}'))
                    migrated += 1
                except Exception as exc:  # noqa: BLE001
                    self.stderr.write(self.style.ERROR(f'[{label}] FAILED to migrate {name}: {exc}'))
                    failed += 1

        verb = 'Would migrate' if dry_run else 'Migrated'
        self.stdout.write(self.style.SUCCESS(
            f'\n{verb}: {migrated}. Already on Drive: {skipped_already_on_drive}. '
            f'Missing locally (skipped): {skipped_missing_locally}. Failed: {failed}.'
        ))
        if skipped_missing_locally:
            self.stdout.write(self.style.WARNING(
                'Files missing locally were already lost before this migration ran (e.g. wiped by an '
                'earlier redeploy) -- migrating cannot recover those; the uploader must re-submit them.'
            ))
