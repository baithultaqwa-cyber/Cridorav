from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model

User = get_user_model()


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs.get('email', '').lower().strip()
        password = attrs.get('password', '')

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            raise serializers.ValidationError({'email': 'Invalid email or password.'})

        if not user.check_password(password):
            raise serializers.ValidationError({'password': 'Invalid email or password.'})

        # is_active=False is for admin freeze only — KYC/KYB pending does not block login.
        if not user.is_active:
            raise serializers.ValidationError({'email': 'Account is disabled.'})

        refresh = RefreshToken.for_user(user)
        return {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user_type': user.user_type,
            'user_id': user.id,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'kyc_status': user.kyc_status,
            'vendor_company': user.vendor_company,
        }


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    country = serializers.CharField(max_length=100, required=False, default='')
    phone = serializers.CharField(max_length=20, required=False, default='')

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return value.lower().strip()

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

    class Meta:
        model = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 'full_name',
            'user_type', 'phone', 'country', 'vendor_company',
            'kyc_status', 'is_active',
        ]
        read_only_fields = ['id', 'email', 'user_type', 'kyc_status']
