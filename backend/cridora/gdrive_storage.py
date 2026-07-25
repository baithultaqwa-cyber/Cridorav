"""
Google Drive-backed Django Storage for KYC/KYB documents, payout proofs, vendor
repayment proofs, and EOD ledger PDFs (everything on STORAGES['default']).

Why OAuth (not a service account): Drive service accounts get 0 bytes of storage
quota unless the project is on a paid Google Workspace domain with Shared Drives.
A plain personal/free Google account has no such option, so this backend
authenticates as a real Google account via a one-time OAuth consent (see
backend/scripts/gdrive_get_refresh_token.py) and stores files against that
account's own Drive quota. Files are private to that account by default.

Deletes move files to Drive Trash (not permanent delete) so there's a ~30-day
recovery window in Drive itself, in addition to Drive's own infrastructure
redundancy -- this is the "backup" layer for documents stored here.

Required settings (see cridora/settings.py):
    GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_REFRESH_TOKEN
Optional:
    GOOGLE_DRIVE_ROOT_FOLDER_NAME (default "Cridora-Documents")
"""
import json
import logging
import mimetypes
import threading
import time

import requests
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import Storage

logger = logging.getLogger(__name__)

TOKEN_URL = 'https://oauth2.googleapis.com/token'
API_FILES = 'https://www.googleapis.com/drive/v3/files'
UPLOAD_FILES = 'https://www.googleapis.com/upload/drive/v3/files'
FOLDER_MIME = 'application/vnd.google-apps.folder'


class GoogleDriveStorage(Storage):
    """Minimal Drive v3 storage: create/find nested folders by name, save/open/
    delete/size files by (folder, basename). Uses plain REST calls (requests)
    rather than the heavy google-api-python-client, matching this codebase's
    existing lightweight-dependency style."""

    def __init__(self):
        self._client_id = settings.GOOGLE_DRIVE_CLIENT_ID
        self._client_secret = settings.GOOGLE_DRIVE_CLIENT_SECRET
        self._refresh_token = settings.GOOGLE_DRIVE_REFRESH_TOKEN
        self._root_folder_name = getattr(
            settings, 'GOOGLE_DRIVE_ROOT_FOLDER_NAME', 'Cridora-Documents'
        )
        self._lock = threading.Lock()
        self._access_token = None
        self._access_token_expiry = 0
        self._root_folder_id = None
        self._folder_cache = {}
        self._file_id_cache = {}

    # ── Auth ─────────────────────────────────────────────────────────
    def _get_access_token(self):
        with self._lock:
            if self._access_token and time.time() < self._access_token_expiry - 30:
                return self._access_token
            resp = requests.post(TOKEN_URL, data={
                'client_id': self._client_id,
                'client_secret': self._client_secret,
                'refresh_token': self._refresh_token,
                'grant_type': 'refresh_token',
            }, timeout=20)
            if not resp.ok:
                raise RuntimeError(f'Google Drive token refresh failed: {resp.status_code} {resp.text[:300]}')
            data = resp.json()
            self._access_token = data['access_token']
            self._access_token_expiry = time.time() + int(data.get('expires_in', 3600))
            return self._access_token

    def _headers(self, extra=None):
        h = {'Authorization': f'Bearer {self._get_access_token()}'}
        if extra:
            h.update(extra)
        return h

    # ── Folder resolution ───────────────────────────────────────────
    def _root_id(self):
        if self._root_folder_id:
            return self._root_folder_id
        found = self._find_child('root', self._root_folder_name, FOLDER_MIME)
        self._root_folder_id = found or self._create_folder('root', self._root_folder_name)
        return self._root_folder_id

    def _find_child(self, parent_id, name, mime_type=None):
        safe_name = name.replace("'", "\\'")
        q = f"name = '{safe_name}' and '{parent_id}' in parents and trashed = false"
        if mime_type:
            q += f" and mimeType = '{mime_type}'"
        resp = requests.get(API_FILES, headers=self._headers(), params={
            'q': q, 'fields': 'files(id,name)', 'pageSize': 1,
        }, timeout=20)
        if not resp.ok:
            raise RuntimeError(f'Google Drive list failed: {resp.status_code} {resp.text[:300]}')
        files = resp.json().get('files', [])
        return files[0]['id'] if files else None

    def _create_folder(self, parent_id, name):
        resp = requests.post(API_FILES, headers=self._headers({'Content-Type': 'application/json'}),
                              data=json.dumps({'name': name, 'mimeType': FOLDER_MIME, 'parents': [parent_id]}),
                              params={'fields': 'id'}, timeout=20)
        if not resp.ok:
            raise RuntimeError(f'Google Drive create folder failed: {resp.status_code} {resp.text[:300]}')
        return resp.json()['id']

    def _resolve_folder(self, rel_dir, create):
        rel_dir = (rel_dir or '').strip('/')
        cache_key = rel_dir
        if cache_key in self._folder_cache:
            return self._folder_cache[cache_key]
        parent_id = self._root_id()
        if rel_dir:
            for segment in rel_dir.split('/'):
                found = self._find_child(parent_id, segment, FOLDER_MIME)
                if found is None:
                    if not create:
                        return None
                    found = self._create_folder(parent_id, segment)
                parent_id = found
        self._folder_cache[cache_key] = parent_id
        return parent_id

    def _split(self, name):
        name = name.replace('\\', '/')
        if '/' in name:
            rel_dir, basename = name.rsplit('/', 1)
        else:
            rel_dir, basename = '', name
        return rel_dir, basename

    def _find_file_id(self, name):
        if name in self._file_id_cache:
            return self._file_id_cache[name]
        rel_dir, basename = self._split(name)
        folder_id = self._resolve_folder(rel_dir, create=False)
        if folder_id is None:
            return None
        file_id = self._find_child(folder_id, basename)
        if file_id:
            self._file_id_cache[name] = file_id
        return file_id

    # ── Storage API ──────────────────────────────────────────────────
    def _open(self, name, mode='rb'):
        file_id = self._find_file_id(name)
        if file_id is None:
            raise FileNotFoundError(f'{name} not found in Google Drive storage')
        resp = requests.get(f'{API_FILES}/{file_id}', headers=self._headers(),
                             params={'alt': 'media'}, timeout=60)
        if not resp.ok:
            raise FileNotFoundError(f'Google Drive download failed for {name}: {resp.status_code}')
        return ContentFile(resp.content, name=name)

    def _save(self, name, content):
        # Resumable upload (not multipart): multipart/related is capped at 5MB by the Drive
        # API, and KYC scans routinely exceed that. Resumable has no size cap and survives
        # transient network hiccups better (single PUT of the whole body still works fine
        # for our typical few-MB documents; Drive just doesn't reject it for being large).
        rel_dir, basename = self._split(name)
        folder_id = self._resolve_folder(rel_dir, create=True)
        content.seek(0)
        raw = content.read()
        mime_type = mimetypes.guess_type(basename)[0] or 'application/octet-stream'
        metadata = {'name': basename, 'parents': [folder_id]}

        init_resp = requests.post(
            UPLOAD_FILES,
            headers=self._headers({'Content-Type': 'application/json; charset=UTF-8'}),
            params={'uploadType': 'resumable', 'fields': 'id'},
            data=json.dumps(metadata),
            timeout=30,
        )
        if not init_resp.ok:
            raise RuntimeError(
                f'Google Drive upload session init failed for {name}: '
                f'{init_resp.status_code} {init_resp.text[:300]}'
            )
        session_uri = init_resp.headers.get('Location')
        if not session_uri:
            raise RuntimeError(f'Google Drive upload session had no Location header for {name}')

        upload_resp = requests.put(
            session_uri,
            headers={'Content-Type': mime_type, 'Content-Length': str(len(raw))},
            data=raw,
            timeout=180,
        )
        if not upload_resp.ok:
            raise RuntimeError(
                f'Google Drive upload failed for {name}: {upload_resp.status_code} {upload_resp.text[:300]}'
            )
        self._file_id_cache[name] = upload_resp.json()['id']
        return name

    def exists(self, name):
        try:
            return self._find_file_id(name) is not None
        except Exception:
            logger.exception('Google Drive exists() check failed for %s', name)
            return False

    def delete(self, name):
        file_id = self._find_file_id(name)
        if file_id is None:
            return
        # Soft delete (trash, ~30-day Drive recovery window) instead of permanent delete.
        requests.patch(f'{API_FILES}/{file_id}', headers=self._headers({'Content-Type': 'application/json'}),
                        data=json.dumps({'trashed': True}), timeout=20)
        self._file_id_cache.pop(name, None)

    def size(self, name):
        file_id = self._find_file_id(name)
        if file_id is None:
            raise FileNotFoundError(name)
        resp = requests.get(f'{API_FILES}/{file_id}', headers=self._headers(),
                             params={'fields': 'size'}, timeout=20)
        resp.raise_for_status()
        return int(resp.json().get('size') or 0)

    def url(self, name):
        raise NotImplementedError(
            'GoogleDriveStorage files are private; serve them through an authenticated '
            'proxy view (see KYCDocumentFileView) instead of calling .url directly.'
        )

    def get_accessed_time(self, name):
        raise NotImplementedError

    def get_created_time(self, name):
        raise NotImplementedError
