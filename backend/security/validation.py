"""Shared input validators. Return error strings (empty = ok). Never echo raw attacker input."""
from __future__ import annotations

import re
from datetime import date

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.dateparse import parse_date

_HTML = re.compile(r'[<>]')
_EMAIL = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]{2,}$')
_EID_DIGITS = re.compile(r'^784\d{12}$')
_PASSPORT = re.compile(r'^[A-Za-z0-9]{5,12}$')
_IBAN = re.compile(r'^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$')
_ACCOUNT = re.compile(r'^\d{8,18}$')
_SWIFT = re.compile(r'^[A-Z0-9]{8}([A-Z0-9]{3})?$')
_IFSC = re.compile(r'^[A-Z]{4}0[A-Z0-9]{6}$')
_NAME = re.compile(r"^[\w\s.'.\-]{1,150}$", re.UNICODE)


def strip_text(value, max_len: int = 200) -> str:
    return _HTML.sub('', str(value or '')).strip()[:max_len]


def email_error(value) -> str:
    v = str(value or '').strip().lower()
    if not v:
        return 'Enter your email.'
    if len(v) > 254 or not _EMAIL.match(v):
        return 'Enter a valid email address.'
    return ''


def uae_mobile_error(value, *, required=False) -> str:
    from otp.services import normalize_uae_phone
    raw = str(value or '').strip()
    if not raw:
        return 'Enter a UAE mobile number.' if required else ''
    if not normalize_uae_phone(raw):
        return 'Enter a valid UAE mobile (e.g. 05X XXX XXXX).'
    return ''


def person_name_error(value, label='Name') -> str:
    v = strip_text(value, 150)
    if not v:
        return f'Enter {label.lower()}.'
    if not _NAME.match(v):
        return f'{label} contains invalid characters.'
    return ''


def password_error(password, user=None) -> str:
    p = str(password or '')
    if len(p) < 8:
        return 'Password must be at least 8 characters.'
    if len(p) > 128:
        return 'Password is too long.'
    try:
        validate_password(p, user=user)
    except DjangoValidationError as exc:
        return exc.messages[0] if exc.messages else 'Password is too weak.'
    return ''


def emirates_id_error(value, *, required=False) -> str:
    digits = re.sub(r'\D', '', str(value or ''))
    if not digits:
        return 'Enter Emirates ID number.' if required else ''
    if not _EID_DIGITS.match(digits):
        return 'Emirates ID should be 15 digits starting with 784.'
    return ''


def passport_error(value, *, required=False) -> str:
    v = str(value or '').strip().upper()
    if not v:
        return 'Enter passport number.' if required else ''
    if not _PASSPORT.match(v):
        return 'Passport number looks invalid.'
    return ''


def dob_adult_error(value) -> str:
    raw = str(value or '').strip()
    if not raw:
        return 'Enter date of birth.'
    d = parse_date(raw)
    if not d:
        return 'Enter a valid date of birth.'
    today = date.today()
    age = today.year - d.year - ((today.month, today.day) < (d.month, d.day))
    if age < 18:
        return 'You must be at least 18.'
    if age > 120 or d > today:
        return 'Enter a valid date of birth.'
    return ''


def iban_or_account_error(value) -> str:
    s = re.sub(r'\s+', '', str(value or '')).upper()
    if not s:
        return 'Enter account number or IBAN.'
    if _IBAN.match(s) or _ACCOUNT.match(s):
        return ''
    return 'Enter a valid IBAN or account number.'


def swift_or_ifsc_error(value, *, required=False) -> str:
    s = re.sub(r'\s+', '', str(value or '')).upper()
    if not s:
        return 'Enter SWIFT or IFSC.' if required else ''
    if _SWIFT.match(s) or _IFSC.match(s):
        return ''
    return 'Enter a valid SWIFT (8 or 11 chars) or IFSC code.'


def validate_kyc_profile(data: dict) -> dict:
    errors = {}
    if 'full_name' in data:
        e = person_name_error(data.get('full_name'), 'Full name')
        if e:
            errors['full_name'] = e
    if 'date_of_birth' in data and str(data.get('date_of_birth') or '').strip():
        e = dob_adult_error(data.get('date_of_birth'))
        if e:
            errors['date_of_birth'] = e
    if 'emirates_id_number' in data and str(data.get('emirates_id_number') or '').strip():
        e = emirates_id_error(data.get('emirates_id_number'))
        if e:
            errors['emirates_id_number'] = e
    if 'passport_number' in data and str(data.get('passport_number') or '').strip():
        e = passport_error(data.get('passport_number'))
        if e:
            errors['passport_number'] = e
    eid = str(data.get('emirates_id_number') or '').strip()
    pp = str(data.get('passport_number') or '').strip()
    if not eid and not pp and ('emirates_id_number' in data or 'passport_number' in data):
        errors['emirates_id_number'] = 'Enter Emirates ID or passport number.'
    return errors


def validate_bank_payload(data: dict) -> dict:
    errors = {}
    e = person_name_error(data.get('account_name'), 'Account name')
    if e:
        errors['account_name'] = e
    bank = strip_text(data.get('bank_name'), 120)
    if not bank:
        errors['bank_name'] = 'Enter bank name.'
    e = iban_or_account_error(data.get('account_number'))
    if e:
        errors['account_number'] = e
    if str(data.get('ifsc') or '').strip():
        e = swift_or_ifsc_error(data.get('ifsc'))
        if e:
            errors['ifsc'] = e
    return errors
