"""Foundation: declarative role permissions."""
from django.contrib.auth import get_user_model
from django.test import RequestFactory, TestCase
from rest_framework.views import APIView

from security.permissions import IsAdmin, IsCustomer, IsVendor

User = get_user_model()


class _Probe(APIView):
    pass


class RolePermissionTests(TestCase):
    def setUp(self):
        self.rf = RequestFactory()
        self.view = _Probe()

    def _user(self, user_type, email):
        return User.objects.create_user(
            username=email.split('@')[0],
            email=email,
            password='TestPass123!',
            user_type=user_type,
        )

    def test_is_admin(self):
        admin = self._user(User.ADMIN, 'a@test.local')
        cust = self._user(User.CUSTOMER, 'c@test.local')
        req = self.rf.get('/')
        req.user = admin
        self.assertTrue(IsAdmin().has_permission(req, self.view))
        req.user = cust
        self.assertFalse(IsAdmin().has_permission(req, self.view))

    def test_is_vendor_and_customer(self):
        vendor = self._user(User.VENDOR, 'v@test.local')
        cust = self._user(User.CUSTOMER, 'c2@test.local')
        req = self.rf.get('/')
        req.user = vendor
        self.assertTrue(IsVendor().has_permission(req, self.view))
        self.assertFalse(IsCustomer().has_permission(req, self.view))
        req.user = cust
        self.assertTrue(IsCustomer().has_permission(req, self.view))
        self.assertFalse(IsVendor().has_permission(req, self.view))
