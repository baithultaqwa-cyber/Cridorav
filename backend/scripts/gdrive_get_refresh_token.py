"""
One-time helper: run this LOCALLY (on your own computer, not on Railway) to authorize
Cridora to store documents in your Google Drive and print a refresh token.

You alone see the output. Do not paste the refresh token into chat, tickets, or commits --
copy it straight into the Railway "Cridorav" service Variables tab as GOOGLE_DRIVE_REFRESH_TOKEN.

Setup (one time, in Google Cloud Console, same project as your Firebase service account
is fine, e.g. "cridoraindia"):
  1. https://console.cloud.google.com/apis/library/drive.googleapis.com -> Enable "Google Drive API".
  2. https://console.cloud.google.com/apis/credentials/consent
     -> Configure the OAuth consent screen (External is fine; you don't need to publish it,
        "Testing" mode works as long as your own Google account is added as a test user).
  3. https://console.cloud.google.com/apis/credentials
     -> Create Credentials -> OAuth client ID -> Application type: "Desktop app".
     -> Copy the generated Client ID and Client Secret.
  4. Run this script:
       pip install requests
       python gdrive_get_refresh_token.py
     It will ask for the Client ID / Client Secret, open your browser to sign in with the
     Google account you want documents stored in, and print a refresh token.
  5. In Railway -> Cridorav service -> Variables, set:
       GOOGLE_DRIVE_CLIENT_ID       = <the client id>
       GOOGLE_DRIVE_CLIENT_SECRET   = <the client secret>
       GOOGLE_DRIVE_REFRESH_TOKEN   = <the refresh token this script prints>
     (Optional) GOOGLE_DRIVE_ROOT_FOLDER_NAME to change the Drive folder name from the
     default "Cridora-Documents".
"""
import http.server
import json
import threading
import urllib.parse
import webbrowser

import requests

REDIRECT_PORT = 8765
REDIRECT_URI = f'http://localhost:{REDIRECT_PORT}/oauth2callback'
AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
TOKEN_URL = 'https://oauth2.googleapis.com/token'
SCOPE = 'https://www.googleapis.com/auth/drive.file'

_result = {}


class _CallbackHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        query = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(query)
        _result['code'] = params.get('code', [None])[0]
        _result['error'] = params.get('error', [None])[0]
        self.send_response(200)
        self.send_header('Content-Type', 'text/html')
        self.end_headers()
        msg = 'Authorized. You can close this tab and return to the terminal.' if _result.get('code') \
            else f"Authorization failed: {_result.get('error')}"
        self.wfile.write(f'<html><body><h2>{msg}</h2></body></html>'.encode())

    def log_message(self, *args):
        pass  # silence default request logging


def main():
    client_id = input('Google OAuth Client ID: ').strip()
    client_secret = input('Google OAuth Client Secret: ').strip()

    server = http.server.HTTPServer(('localhost', REDIRECT_PORT), _CallbackHandler)
    thread = threading.Thread(target=server.handle_request, daemon=True)
    thread.start()

    auth_params = {
        'client_id': client_id,
        'redirect_uri': REDIRECT_URI,
        'response_type': 'code',
        'scope': SCOPE,
        'access_type': 'offline',
        'prompt': 'consent',  # forces a refresh_token even if you've authorized before
    }
    url = f'{AUTH_URL}?{urllib.parse.urlencode(auth_params)}'
    print('\nOpening your browser to sign in to the Google account that should store the documents...')
    print(f'If it does not open automatically, visit:\n{url}\n')
    webbrowser.open(url)

    thread.join(timeout=180)
    if not _result.get('code'):
        print(f"\nNo authorization code received (error: {_result.get('error')}). Aborting.")
        return

    resp = requests.post(TOKEN_URL, data={
        'client_id': client_id,
        'client_secret': client_secret,
        'code': _result['code'],
        'grant_type': 'authorization_code',
        'redirect_uri': REDIRECT_URI,
    }, timeout=20)
    if not resp.ok:
        print(f'\nToken exchange failed: {resp.status_code} {resp.text}')
        return

    data = resp.json()
    refresh_token = data.get('refresh_token')
    if not refresh_token:
        print(
            '\nNo refresh_token in the response. This usually means you already authorized this '
            'app before without revoking access. Go to https://myaccount.google.com/permissions, '
            'remove access for this app, then run this script again.'
        )
        print(json.dumps(data, indent=2))
        return

    print('\nSuccess. Set these in Railway -> Cridorav service -> Variables:\n')
    print(f'GOOGLE_DRIVE_CLIENT_ID={client_id}')
    print(f'GOOGLE_DRIVE_CLIENT_SECRET={client_secret}')
    print(f'GOOGLE_DRIVE_REFRESH_TOKEN={refresh_token}')
    print('\nKeep this terminal output private -- do not share or commit it.')


if __name__ == '__main__':
    main()
