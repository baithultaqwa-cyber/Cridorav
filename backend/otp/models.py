from django.db import models


class OtpChallenge(models.Model):
    CHANNEL_SMS = 'sms'
    CHANNEL_EMAIL = 'email'
    CHANNEL_CHOICES = (
        (CHANNEL_SMS, 'SMS'),
        (CHANNEL_EMAIL, 'Email'),
    )

    PURPOSE_LOGIN = 'login'
    PURPOSE_PASSWORD_RESET = 'password_reset'
    PURPOSE_CHOICES = (
        (PURPOSE_LOGIN, 'Login / signup'),
        (PURPOSE_PASSWORD_RESET, 'Password reset'),
    )

    channel = models.CharField(max_length=12, choices=CHANNEL_CHOICES)
    purpose = models.CharField(max_length=24, choices=PURPOSE_CHOICES)
    destination = models.CharField(max_length=254, db_index=True)
    code_hash = models.CharField(max_length=64)
    attempts = models.PositiveSmallIntegerField(default=0)
    max_attempts = models.PositiveSmallIntegerField(default=5)
    expires_at = models.DateTimeField(db_index=True)
    consumed_at = models.DateTimeField(null=True, blank=True)
    sent_ok = models.BooleanField(null=True, blank=True)
    outcome = models.CharField(max_length=16, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['channel', 'purpose', 'destination', '-created_at']),
        ]

    def __str__(self):
        return f'{self.channel}:{self.purpose}:{self.destination}'
