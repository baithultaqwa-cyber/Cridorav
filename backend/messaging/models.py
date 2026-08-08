from django.db import models


class SmsProviderConfig(models.Model):
    """Singleton — active SMS API. OTP never talks to a vendor directly."""

    PROVIDER_HTTPSMS = 'httpsms'
    PROVIDER_TWILIO = 'twilio'
    PROVIDER_GENERIC = 'generic'

    PROVIDER_CHOICES = (
        (PROVIDER_HTTPSMS, 'httpSMS'),
        (PROVIDER_TWILIO, 'Twilio'),
        (PROVIDER_GENERIC, 'Custom HTTP API'),
    )

    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES, default=PROVIDER_HTTPSMS)
    enabled = models.BooleanField(default=True)
    api_url = models.CharField(max_length=500, blank=True, default='')
    api_key = models.CharField(max_length=500, blank=True, default='')
    api_secret = models.CharField(max_length=500, blank=True, default='')
    from_number = models.CharField(max_length=32, blank=True, default='')
    auth_header = models.CharField(max_length=80, blank=True, default='x-api-key')
    body_template = models.TextField(
        blank=True,
        default='',
        help_text='JSON body for generic provider. Placeholders: {to} {from} {content}',
    )
    extra_headers = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'SMS provider config'

    def __str__(self):
        return f'SMS ({self.provider})'

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(id=1)
        return obj
