"""Temporary read-only diagnostic: why are the admin KYC/KYB queues empty?
Safe to delete after use — does not modify any data.
"""
from collections import Counter

from django.core.management.base import BaseCommand

from users.compliance import customer_compliance_verification, vendor_compliance_verification
from users.models import KYCDocument, User
from users.views import _admin_dashboard_data


class Command(BaseCommand):
    help = "Read-only diagnostic for the admin KYC/KYB queue emptiness report."

    def handle(self, *args, **options):
        self.stdout.write("--- CALLING _admin_dashboard_data() DIRECTLY ---")
        try:
            data = _admin_dashboard_data()
            self.stdout.write(f"kyc_queue len: {len(data.get('kyc_queue', []))}")
            self.stdout.write(f"kyc_queue: {data.get('kyc_queue')}")
            self.stdout.write(f"kyb_queue len: {len(data.get('kyb_queue', []))}")
            self.stdout.write(f"kyb_queue: {data.get('kyb_queue')}")
            self.stdout.write(f"verification_directory len: {len(data.get('verification_directory', []))}")
        except Exception as e:
            import traceback
            self.stdout.write(f"EXCEPTION: {e!r}")
            self.stdout.write(traceback.format_exc())
        self.stdout.write("--- END _admin_dashboard_data() ---\n")

        users = list(User.objects.all())
        self.stdout.write(f"TOTAL USERS: {len(users)}")
        self.stdout.write(f"BY TYPE/STATUS: {dict(Counter((u.user_type, u.kyc_status) for u in users))}")

        docs = list(KYCDocument.objects.all())
        self.stdout.write(f"TOTAL DOCS: {len(docs)}")
        self.stdout.write(f"DOC TYPES: {dict(Counter(d.doc_type for d in docs))}")
        self.stdout.write(f"DOC STATUSES: {dict(Counter(d.status for d in docs))}")

        self.stdout.write("\n--- CUSTOMERS ---")
        for u in [x for x in users if x.user_type == User.CUSTOMER]:
            comp = customer_compliance_verification(u)
            self.stdout.write(
                f"id={u.id} email={u.email} kyc_status={u.kyc_status} "
                f"trading_allowed={comp['trading_allowed']} pending={comp['pending_items']}"
            )

        self.stdout.write("\n--- VENDORS ---")
        for u in [x for x in users if x.user_type == User.VENDOR]:
            comp = vendor_compliance_verification(u)
            self.stdout.write(
                f"id={u.id} email={u.email} kyc_status={u.kyc_status} "
                f"trading_allowed={comp['trading_allowed']} pending={comp['pending_items']}"
            )
