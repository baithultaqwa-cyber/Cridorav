from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from users.models import User

from .services import hash_otp, codes_match, normalize_uae_phone


class PhoneNormalizeTests(TestCase):
    def test_uae_formats(self):
        self.assertEqual(normalize_uae_phone('0501234567'), '+971501234567')
        self.assertEqual(normalize_uae_phone('+971 50 123 4567'), '+971501234567')
        self.assertEqual(normalize_uae_phone('971501234567'), '+971501234567')
        self.assertIsNone(normalize_uae_phone('12345'))
        self.assertIsNone(normalize_uae_phone('+441234567890'))


class OtpHashTests(TestCase):
    def test_roundtrip(self):
        h = hash_otp('123456')
        self.assertTrue(codes_match('123456', h))
        self.assertFalse(codes_match('000000', h))


@override_settings(DEBUG=True, HTTPSMS_API_KEY='', HTTPSMS_FROM_NUMBER='')
class PhoneOtpApiTests(TestCase):
    def test_send_and_verify_creates_customer(self):
        client = APIClient()
        send = client.post('/api/auth/otp/phone/send/', {'phone': '0501234567'}, format='json')
        self.assertEqual(send.status_code, 200)
        code = send.data.get('debug_code')
        self.assertTrue(code)
        verify = client.post(
            '/api/auth/otp/phone/verify/',
            {'phone': '0501234567', 'code': code},
            format='json',
        )
        self.assertEqual(verify.status_code, 200)
        self.assertTrue(verify.data.get('access'))
        self.assertTrue(verify.data.get('needs_password'))
        self.assertEqual(verify.data.get('user_type'), 'customer')


@override_settings(DEBUG=True, HTTPSMS_API_KEY='', HTTPSMS_FROM_NUMBER='')
class AdminOtpMonitorTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='otp-admin@test.local',
            email='otp-admin@test.local',
            password='x',
            user_type=User.ADMIN,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_lists_live_otp_without_exposing_code(self):
        anon = APIClient()
        send = anon.post('/api/auth/otp/phone/send/', {'phone': '0501234567'}, format='json')
        self.assertEqual(send.status_code, 200)
        self.assertTrue(send.data.get('debug_code'))
        res = self.client.get('/api/auth/otp/admin/challenges/')
        self.assertEqual(res.status_code, 200)
        self.assertGreaterEqual(res.data['live_count'], 1)
        item = res.data['items'][0]
        self.assertEqual(item['status'], 'live')
        self.assertEqual(item['destination'], '+971501234567')
        self.assertNotIn('code', item)
        self.assertNotIn('code_hash', item)
        self.assertNotIn('debug_code', str(res.data))

    def test_status_verified_after_consume(self):
        anon = APIClient()
        send = anon.post('/api/auth/otp/phone/send/', {'phone': '0509876543'}, format='json')
        code = send.data.get('debug_code')
        self.assertTrue(code)
        verify = anon.post(
            '/api/auth/otp/phone/verify/',
            {'phone': '0509876543', 'code': code},
            format='json',
        )
        self.assertEqual(verify.status_code, 200)
        res = self.client.get('/api/auth/otp/admin/challenges/?status=verified')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(any(i['status'] == 'verified' and i['destination'] == '+971509876543' for i in res.data['items']))

    def test_non_admin_forbidden(self):
        customer = User.objects.create_user(
            username='otp-cust@test.local',
            email='otp-cust@test.local',
            password='x',
            user_type=User.CUSTOMER,
        )
        c = APIClient()
        c.force_authenticate(customer)
        res = c.get('/api/auth/otp/admin/challenges/')
        self.assertEqual(res.status_code, 403)
