from django.core.cache import cache
from django.http import JsonResponse
from django.test import RequestFactory, TestCase, override_settings
from rest_framework.test import APIClient

from .middleware import RequestSizeLimitMiddleware

from users.models import User

from .lockout import clear_failures, is_locked, record_failure
from .validation import (
    dob_adult_error,
    email_error,
    emirates_id_error,
    iban_or_account_error,
    password_error,
    person_name_error,
)


class ValidationTests(TestCase):
    def test_email(self):
        self.assertTrue(email_error(''))
        self.assertTrue(email_error('not-an-email'))
        self.assertFalse(email_error('a@b.co'))

    def test_name_rejects_html(self):
        self.assertTrue(person_name_error('<script>x</script>'))
        self.assertFalse(person_name_error("O'Neil Smith"))

    def test_password_min(self):
        self.assertTrue(password_error('short'))
        self.assertTrue(password_error('12345678'))

    def test_eid_and_iban(self):
        self.assertTrue(emirates_id_error('123'))
        self.assertFalse(emirates_id_error('784123456789012'))
        self.assertFalse(iban_or_account_error('AE070331234567890123456'))
        self.assertTrue(iban_or_account_error('xx'))

    def test_dob_adult(self):
        self.assertTrue(dob_adult_error('2015-01-01'))
        self.assertFalse(dob_adult_error('1990-06-15'))


class LockoutTests(TestCase):
    def setUp(self):
        cache.clear()
        self.factory = RequestFactory()

    def test_locks_after_threshold(self):
        req = self.factory.post('/api/auth/login/')
        email = 'victim@example.com'
        with override_settings(LOGIN_LOCKOUT_ATTEMPTS=3, LOGIN_LOCKOUT_SECONDS=120):
            self.assertFalse(is_locked(email, req))
            self.assertFalse(record_failure(email, req))
            self.assertFalse(record_failure(email, req))
            self.assertTrue(record_failure(email, req))
            self.assertTrue(is_locked(email, req))
            clear_failures(email, req)
            self.assertFalse(is_locked(email, req))


class SecurityHeadersAndAuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_api_sets_security_headers(self):
        res = self.client.get('/api/auth/platform-fees/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get('X-Content-Type-Options'), 'nosniff')
        self.assertIn('no-store', (res.get('Cache-Control') or '').lower())

    def test_protected_endpoint_requires_auth(self):
        res = self.client.get('/api/auth/dashboard/admin/')
        self.assertEqual(res.status_code, 401)

    def test_oversized_json_rejected(self):
        factory = RequestFactory()
        request = factory.post(
            '/api/auth/login/',
            data='{}',
            content_type='application/json',
            CONTENT_LENGTH='700000',
        )
        mw = RequestSizeLimitMiddleware(lambda r: JsonResponse({'ok': True}))
        res = mw(request)
        self.assertEqual(res.status_code, 413)

    def test_login_lockout_api(self):
        User.objects.create_user(
            username='lock@test.local', email='lock@test.local', password='CorrectHorse1',
            user_type=User.CUSTOMER,
        )
        with override_settings(LOGIN_LOCKOUT_ATTEMPTS=3, LOGIN_LOCKOUT_SECONDS=120):
            for _ in range(3):
                self.client.post(
                    '/api/auth/login/',
                    {'email': 'lock@test.local', 'password': 'wrong-password'},
                    format='json',
                )
            res = self.client.post(
                '/api/auth/login/',
                {'email': 'lock@test.local', 'password': 'CorrectHorse1'},
                format='json',
            )
            self.assertEqual(res.status_code, 400)
