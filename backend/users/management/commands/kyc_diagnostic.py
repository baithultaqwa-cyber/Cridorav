"""Temporary read-only diagnostic: why are the admin KYC/KYB queues empty?
Safe to delete after use — does not modify any data.
"""
from collections import Counter

from django.core.management.base import BaseCommand

from users.compliance import customer_compliance_verification, vendor_compliance_verification
from users.models import KYCDocument, User


class Command(BaseCommand):
    help = "Read-only diagnostic for the admin KYC/KYB queue emptiness report."

    def handle(self, *args, **options):
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
