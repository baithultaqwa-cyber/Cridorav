from rest_framework import serializers
from django.contrib.auth import get_user_model

from security.lockout import (
    GENERIC_LOGIN_ERROR,
    LOCKED_MESSAGE,
    clear_failures,
    is_locked,
    record_failure,
)
from security.validation import email_error, password_error, person_name_error, strip_text, uae_mobile_error

from .auth_session import session_payload

User = get_user_model()


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, max_length=128)

    def validate(self, attrs):
        email = attrs.get('email', '').lower().strip()
        password = attrs.get('password', '')
        request = self.context.get('request')

        if email_error(email):
            raise serializers.ValidationError({'non_field_errors': [GENERIC_LOGIN_ERROR]})
        if is_locked(email, request):
            raise serializers.ValidationError({'non_field_errors': [LOCKED_MESSAGE]})

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            record_failure(email, request)
            raise serializers.ValidationError({'non_field_errors': [GENERIC_LOGIN_ERROR]})

        if not user.check_password(password):
            record_failure(email, request)
            raise serializers.ValidationError({'non_field_errors': [GENERIC_LOGIN_ERROR]})

        # is_active=False is for admin freeze only — KYC/KYB pending does not block login.
        if not user.is_active:
            raise serializers.ValidationError({'non_field_errors': ['Account is disabled.']})

        clear_failures(email, request)
        return session_payload(user)


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8, max_length=128)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    country = serializers.CharField(max_length=100, required=False, default='')
    phone = serializers.CharField(max_length=20, required=False, default='')

    def validate_email(self, value):
        err = email_error(value)
        if err:
            raise serializers.ValidationError(err)
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return value.lower().strip()

    def validate_first_name(self, value):
        err = person_name_error(value, 'First name')
        if err:
            raise serializers.ValidationError(err)
        return strip_text(value, 150)

    def validate_last_name(self, value):
        err = person_name_error(value, 'Last name')
        if err:
            raise serializers.ValidationError(err)
        return strip_text(value, 150)

    def validate_phone(self, value):
        err = uae_mobile_error(value, required=False)
        if err:
            raise serializers.ValidationError(err)
        return strip_text(value, 20)

    def validate_password(self, value):
        err = password_error(value)
        if err:
            raise serializers.ValidationError(err)
        return value

    def validate_country(self, value):
        return strip_text(value, 100)

    def create(self, validated_data):
        email = validated_data['email']
        user = User.objects.create_user(
            username=email,
            email=email,
            password=validated_data['password'],
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
            country=validated_data.get('country', ''),
            phone=validated_data.get('phone', ''),
            user_type=User.CUSTOMER,
        )
        return user


class UserProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    vendor_logo_url = serializers.SerializerMethodField()
    has_usable_password = serializers.SerializerMethodField()

    def get_has_usable_password(self, obj):
        return obj.has_usable_password()

    class Meta:
        model = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 'full_name',
            'user_type', 'phone', 'phone_verified', 'country', 'vendor_company', 'vendor_description',
            'vendor_logo_url',
            'kyc_status', 'is_active', 'has_usable_password',
        ]
        read_only_fields = ['id', 'email', 'user_type', 'kyc_status', 'phone_verified', 'has_usable_password']

    def get_vendor_logo_url(self, obj):
        if not obj.vendor_logo:
            return None
        return obj.vendor_logo.url
