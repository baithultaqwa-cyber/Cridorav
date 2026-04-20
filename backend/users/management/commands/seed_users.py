from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()

SEED_USERS = [
    {
        'username': 'platform_admin',
        'email': 'admin@cridora.com',
        'password': 'Admin@1234',
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
        'password': 'Vendor@1234',
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
        'password': 'Customer@1234',
        'first_name': 'Arjun',
        'last_name': 'Mehta',
        'user_type': User.CUSTOMER,
        'kyc_status': User.KYC_VERIFIED,
        'country': 'India',
    },
]


class Command(BaseCommand):
    help = 'Seed test users: admin, vendor, customer'

    def handle(self, *args, **options):
        for data in SEED_USERS:
            email = data['email']
            if User.objects.filter(email=email).exists():
                self.stdout.write(f'  [skip] Already exists: {email}')
                continue

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
            user.set_password(data['password'])
            user.save()
            self.stdout.write(self.style.SUCCESS(f'  [ok] Created {data["user_type"]}: {email}'))

        self.stdout.write(self.style.SUCCESS('\nSeed complete. Test accounts:'))
        self.stdout.write('  admin@cridora.com        / Admin@1234    -> Admin Dashboard')
        self.stdout.write('  vendor@emiratesgold.com  / Vendor@1234   -> Vendor Dashboard')
        self.stdout.write('  customer@example.com     / Customer@1234 -> Customer Dashboard')
