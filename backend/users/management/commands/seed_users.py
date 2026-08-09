import os

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

User = get_user_model()

# Dev-only demo passwords. These are well-known and must NEVER be usable in production, which is
# why this command refuses to run unless DEBUG is on (or --force is passed for a throwaway staging
# DB). Each can be overridden via env so even staging never has to use a published default.
SEED_USERS = [
    {
        'username': 'platform_admin',
        'email': 'admin@cridora.com',
        'password_env': 'SEED_ADMIN_PASSWORD',
        'password_default': 'Admin@1234',
        'first_name': 'Platform',
        'last_name': 'Admin',
        'user_type': User.ADMIN,
        'is_staff': True,
        'is_superuser': True,
        'kyc_status': User.KYC_VERIFIED,
    },
    {
        'username': 'emirates_vendor',
        'email': 'vendor@emiratesgold.com',
        'password_env': 'SEED_VENDOR_PASSWORD',
        'password_default': 'Vendor@1234',
        'first_name': 'Ahmed',
        'last_name': 'Al Rashid',
        'user_type': User.VENDOR,
        'vendor_company': 'Emirates Gold Dubai',
        'kyc_status': User.KYC_VERIFIED,
        'country': 'United Arab Emirates',
    },
    {
        'username': 'customer_demo',
        'email': 'customer@example.com',
        'password_env': 'SEED_CUSTOMER_PASSWORD',
        'password_default': 'Customer@1234',
        'first_name': 'Arjun',
        'last_name': 'Mehta',
        'user_type': User.CUSTOMER,
        'kyc_status': User.KYC_VERIFIED,
        'country': 'India',
    },
]


class Command(BaseCommand):
    help = 'Seed demo users (admin, vendor, customer) for local development only.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Allow running when DEBUG is off (staging only — never against real production data).',
        )

    def handle(self, *args, **options):
        if not settings.DEBUG and not options['force']:
            raise CommandError(
                'seed_users is disabled in production (DJANGO_DEBUG=false). It creates accounts '
                'with well-known demo passwords. Use --force only against a throwaway/staging DB, '
                'and override SEED_ADMIN_PASSWORD / SEED_VENDOR_PASSWORD / SEED_CUSTOMER_PASSWORD.'
            )

        for data in SEED_USERS:
            email = data['email']
            if User.objects.filter(email=email).exists():
                self.stdout.write(f'  [skip] Already exists: {email}')
                continue

            password = (os.environ.get(data['password_env'], '') or '').strip() or data['password_default']

            user = User(
                username=data['username'],
                email=email,
                first_name=data['first_name'],
                last_name=data['last_name'],
                user_type=data['user_type'],
                is_staff=data.get('is_staff', False),
                is_superuser=data.get('is_superuser', False),
                kyc_status=data.get('kyc_status', User.KYC_PENDING),
                country=data.get('country', ''),
                vendor_company=data.get('vendor_company', ''),
            )
            user.set_password(password)
            user.save()
            self.stdout.write(self.style.SUCCESS(f'  [ok] Created {data["user_type"]}: {email}'))

        self.stdout.write(self.style.SUCCESS('\nSeed complete (demo accounts created for local development).'))
