from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from users.models import User

from .models import SmsProviderConfig
from .sms import send_sms, sms_configured, public_status


class SmsProviderFacadeTests(TestCase):
    def test_httpsms_env_fallback_marks_configured(self):
        with override_settings(HTTPSMS_API_KEY='k' * 12, HTTPSMS_FROM_NUMBER='+971501234567', DEBUG=False):
            self.assertTrue(sms_configured())
            status = public_status()
            self.assertEqual(status['provider'], 'httpsms')
            self.assertTrue(status['api_key_configured'])
            self.assertNotIn('k' * 12, status['api_key_hint'])

    @override_settings(HTTPSMS_API_KEY='', HTTPSMS_FROM_NUMBER='', DEBUG=False)
    def test_admin_can_switch_to_generic_without_breaking_facade(self):
        cfg = SmsProviderConfig.get()
        cfg.provider = SmsProviderConfig.PROVIDER_GENERIC
        cfg.api_url = 'https://sms.example.com/send'
        cfg.api_key = 'secret-token'
        cfg.from_number = '+971501111111'
        cfg.body_template = '{"destination": "{to}", "text": "{content}"}'
        cfg.save()
        self.assertTrue(sms_configured())
        with patch('messaging.providers._http_raw', return_value=True) as mock_http:
            ok = send_sms('+971502222222', 'Your Cridora code is 123456.')
        self.assertTrue(ok)
        self.assertTrue(mock_http.called)

    @override_settings(HTTPSMS_API_KEY='', HTTPSMS_FROM_NUMBER='', DEBUG=True)
    def test_unconfigured_debug_still_allows_otp_skip(self):
        SmsProviderConfig.get()
        self.assertFalse(sms_configured())
        self.assertTrue(send_sms('+971501234567', 'code'))


class AdminSmsGatewayApiTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='admin@test.local', email='admin@test.local', password='x',
            user_type=User.ADMIN,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_admin_can_switch_provider(self):
        res = self.client.patch(
            '/api/messaging/admin/sms-gateway/',
            {'provider': 'twilio', 'api_key': 'ACxxxxxxxx', 'api_secret': 'tok', 'from_number': '+15005550006'},
            format='json',
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['provider'], 'twilio')
        self.assertTrue(res.data['api_key_configured'])
        self.assertTrue(res.data['api_secret_configured'])
        self.assertNotIn('api_key', res.data)
        self.assertNotIn('api_secret', res.data)

    def test_empty_api_key_does_not_wipe_existing(self):
        cfg = SmsProviderConfig.get()
        cfg.api_key = 'keep-me'
        cfg.save()
        res = self.client.patch(
            '/api/messaging/admin/sms-gateway/',
            {'provider': 'httpsms', 'api_key': '', 'from_number': '+971501234567'},
            format='json',
        )
        self.assertEqual(res.status_code, 200)
        cfg.refresh_from_db()
        self.assertEqual(cfg.api_key, 'keep-me')
