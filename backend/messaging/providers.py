"""SMS vendor adapters. OTP calls messaging.sms only — never these directly."""
from __future__ import annotations

import json
import logging
import urllib.error
import urllib.parse
import urllib.request
from base64 import b64encode

logger = logging.getLogger(__name__)

HTTPSMS_DEFAULT_URL = 'https://api.httpsms.com/v1/messages/send'
TWILIO_DEFAULT_URL = 'https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json'
GENERIC_DEFAULT_BODY = '{"to": "{to}", "from": "{from}", "content": "{content}"}'


def _http_json(url: str, payload: dict, headers: dict, timeout: int = 15) -> bool:
    data = json.dumps(payload).encode('utf-8')
    hdrs = {'Content-Type': 'application/json', **headers}
    return _http_raw(url, data, hdrs, timeout)


def _http_form(url: str, fields: dict, headers: dict, timeout: int = 15) -> bool:
    data = urllib.parse.urlencode(fields).encode('utf-8')
    hdrs = {'Content-Type': 'application/x-www-form-urlencoded', **headers}
    return _http_raw(url, data, hdrs, timeout)


def _http_raw(url: str, data: bytes, headers: dict, timeout: int) -> bool:
    req = urllib.request.Request(url, data=data, method='POST', headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return 200 <= resp.status < 300
    except urllib.error.HTTPError as exc:
        logger.warning('SMS provider HTTP error %s', exc.code)
        return False
    except urllib.error.URLError:
        logger.warning('SMS provider network error')
        return False


def send_httpsms(*, api_key: str, from_number: str, to: str, content: str, api_url: str = '') -> bool:
    url = (api_url or HTTPSMS_DEFAULT_URL).strip() or HTTPSMS_DEFAULT_URL
    return _http_json(
        url,
        {'content': content, 'from': from_number, 'to': to},
        {'x-api-key': api_key},
    )


def send_twilio(*, account_sid: str, auth_token: str, from_number: str, to: str, content: str, api_url: str = '') -> bool:
    url = (api_url or '').strip() or TWILIO_DEFAULT_URL.format(sid=account_sid)
    token = b64encode(f'{account_sid}:{auth_token}'.encode('utf-8')).decode('ascii')
    return _http_form(
        url,
        {'From': from_number, 'To': to, 'Body': content},
        {'Authorization': f'Basic {token}'},
    )


def send_generic(
    *,
    api_url: str,
    api_key: str,
    from_number: str,
    to: str,
    content: str,
    auth_header: str = 'x-api-key',
    body_template: str = '',
    extra_headers: dict | None = None,
) -> bool:
    url = (api_url or '').strip()
    if not url:
        logger.warning('Generic SMS provider missing api_url')
        return False
    template = (body_template or '').strip() or GENERIC_DEFAULT_BODY
    try:
        rendered = template.replace('{to}', to).replace('{from}', from_number).replace('{content}', content)
        payload = json.loads(rendered)
    except (json.JSONDecodeError, TypeError, ValueError):
        logger.warning('Generic SMS body_template is not valid JSON')
        return False
    if not isinstance(payload, dict):
        logger.warning('Generic SMS body must be a JSON object')
        return False
    headers = {}
    name = (auth_header or 'x-api-key').strip() or 'x-api-key'
    if api_key:
        if name.lower() == 'authorization' and not api_key.lower().startswith(('bearer ', 'basic ')):
            headers[name] = f'Bearer {api_key}'
        else:
            headers[name] = api_key
    if extra_headers and isinstance(extra_headers, dict):
        for k, v in extra_headers.items():
            if k and v is not None:
                headers[str(k)] = str(v)
    return _http_json(url, payload, headers)
