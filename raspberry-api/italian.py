"""Authenticated Italian progress storage. SQLite transactions protect concurrent writes."""
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
from pathlib import Path

DATA = Path(os.environ.get('ITALIAN_DATA_DIR', str(Path.home() / '.local/share/personalweb-italian')))
EMPTY = {'forms': {}, 'currentStreak': 0, 'bestStreak': 0, 'practicedDays': [], 'attemptHistory': []}


class APIError(Exception):
    def __init__(self, status, message):
        self.status, self.message = status, message


def connect():
    DATA.mkdir(parents=True, exist_ok=True, mode=0o700)
    db = sqlite3.connect(DATA / 'progress.sqlite3', timeout=15)
    (DATA / 'progress.sqlite3').chmod(0o600)
    db.row_factory = sqlite3.Row
    db.executescript('''
        CREATE TABLE IF NOT EXISTS accounts (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, name_key TEXT UNIQUE NOT NULL,
            salt TEXT NOT NULL, password TEXT NOT NULL, created TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, account TEXT NOT NULL, expires INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS progress (account TEXT PRIMARY KEY, revision INTEGER NOT NULL, body TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS mutations (account TEXT NOT NULL, id TEXT NOT NULL, result TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY(account, id));
        CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, started INTEGER NOT NULL, count INTEGER NOT NULL);
    ''')
    return db


def password_hash(password, salt):
    return hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()


def snapshot(db, account):
    row = db.execute('SELECT revision, body FROM progress WHERE account=?', (account,)).fetchone()
    return {'revision': row['revision'], 'progress': json.loads(row['body'])} if row else {'revision': 0, 'progress': EMPTY}


def validate_progress(value):
    if not isinstance(value, dict) or not isinstance(value.get('forms'), dict):
        raise APIError(400, 'Invalid progress')
    if len(value['forms']) > 20000:
        raise APIError(413, 'Too many forms')
    for key, form in value['forms'].items():
        if len(key) > 300 or not isinstance(form, dict):
            raise APIError(400, 'Invalid form')
        for field in ('attempts', 'correct', 'mastery', 'streak', 'intervalDays'):
            n = form.get(field)
            if type(n) not in (int, float) or not 0 <= n <= 100000000:
                raise APIError(400, 'Invalid form counts')
        if form['correct'] > form['attempts']:
            raise APIError(400, 'Invalid correct count')
        for field in ('dueAt', 'lastPracticed'):
            if form.get(field) is not None and (not isinstance(form[field], str) or len(form[field]) > 50):
                raise APIError(400, 'Invalid date')
    for field, limit in (('practicedDays', 50000), ('attemptHistory', 1000)):
        if not isinstance(value.get(field), list) or len(value[field]) > limit:
            raise APIError(400, 'Invalid history')
    if any(not isinstance(day, str) or len(day) != 10 for day in value['practicedDays']):
        raise APIError(400, 'Invalid practice day')
    for attempt in value['attemptHistory']:
        if not isinstance(attempt, dict) or any(not isinstance(attempt.get(k), str) or len(attempt[k]) > 300
            for k in ('itemId', 'verbId', 'lemma', 'tense', 'person', 'answer', 'expected', 'mode', 'attemptedAt')):
            raise APIError(400, 'Invalid attempt')
        if type(attempt.get('correct')) is not bool or type(attempt.get('irregular')) is not bool:
            raise APIError(400, 'Invalid attempt')
    for field in ('currentStreak', 'bestStreak'):
        if type(value.get(field)) is not int or not 0 <= value[field] <= 100000:
            raise APIError(400, 'Invalid streak')
    return {key: value[key] for key in EMPTY}


def handle(method, path, headers, body):
    db = connect()
    try:
        return dispatch(db, method, path, headers, body)
    finally:
        db.close()


def dispatch(db, method, path, headers, body):
    now = int(time.time())
    if path in ('/italian/auth/login', '/italian/auth/register') and method == 'POST':
        name = ' '.join(str(body.get('name', '')).split())
        password = body.get('password', '')
        if not 1 <= len(name) <= 60 or not isinstance(password, str) or not 10 <= len(password) <= 256:
            raise APIError(400, 'Use a name and a password of 10–256 characters')
        # Connector is loopback-only. CF-Connecting-IP is set by Cloudflare.
        key = 'auth:' + headers.get('CF-Connecting-IP', 'local')
        with db:
            db.execute('DELETE FROM rate_limits WHERE started < ?', (now - 600,))
            db.execute('INSERT INTO rate_limits VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET count=count+1', (key, now))
            count = db.execute('SELECT count FROM rate_limits WHERE key=?', (key,)).fetchone()[0]
        if count > 20:
            raise APIError(429, 'Too many attempts. Try again in 10 minutes.')
        row = db.execute('SELECT * FROM accounts WHERE name_key=?', (name.casefold(),)).fetchone()
        if path.endswith('/register'):
            if row:
                raise APIError(409, 'That name is already registered. Sign in instead.')
            salt = secrets.token_hex(16)
            digest = password_hash(password, salt)
            account = secrets.token_hex(16)
            created = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            try:
                with db:
                    db.execute('INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?)', (account, name, name.casefold(), salt, digest, created))
            except sqlite3.IntegrityError:
                raise APIError(409, 'That name is already registered. Sign in instead.')
            row = db.execute('SELECT * FROM accounts WHERE id=?', (account,)).fetchone()
        else:
            digest = password_hash(password, row['salt'] if row else '00' * 16)
            if not row or not hmac.compare_digest(digest, row['password']):
                raise APIError(401, 'Incorrect name or password')
        token = secrets.token_urlsafe(32)
        with db:
            db.execute('DELETE FROM sessions WHERE expires < ?', (now,))
            db.execute('INSERT INTO sessions VALUES (?, ?, ?)', (hashlib.sha256(token.encode()).hexdigest(), row['id'], now + 30 * 86400))
        return 200, {'token': token, 'user': {'id': row['id'], 'name': row['name'], 'createdAt': row['created'], 'lastSeenAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}}

    token = headers.get('Authorization', '').removeprefix('Bearer ')
    digest = hashlib.sha256(token.encode()).hexdigest()
    session = db.execute('SELECT account FROM sessions WHERE token_hash=? AND expires>?', (digest, now)).fetchone()
    if not session:
        raise APIError(401, 'Session expired. Sign in again; your offline progress is saved.')
    account = session['account']
    if path == '/italian/auth/logout' and method == 'POST':
        with db:
            db.execute('DELETE FROM sessions WHERE token_hash=?', (digest,))
        return 200, {'ok': True}
    if path == '/italian/progress' and method == 'GET':
        return 200, snapshot(db, account)
    if path == '/italian/progress' and method == 'PUT':
        progress = validate_progress(body.get('progress'))
        if type(body.get('revision')) is not int or body['revision'] < 0:
            raise APIError(400, 'Invalid revision')
        mutation = body.get('mutationId')
        if not isinstance(mutation, str) or not 1 <= len(mutation) <= 100:
            raise APIError(400, 'Invalid mutation ID')
        with db:
            db.execute('BEGIN IMMEDIATE')
            prior = db.execute('SELECT result FROM mutations WHERE account=? AND id=?', (account, mutation)).fetchone()
            if prior:
                return 200, snapshot(db, account)
            current = snapshot(db, account)
            if current['revision'] != body['revision']:
                return 409, current
            revision = current['revision'] + 1
            db.execute('INSERT INTO progress VALUES (?, ?, ?) ON CONFLICT(account) DO UPDATE SET revision=excluded.revision, body=excluded.body',
                       (account, revision, json.dumps(progress, allow_nan=False)))
            result = {'revision': revision, 'progress': progress}
            db.execute('INSERT INTO mutations VALUES (?, ?, ?, ?)', (account, mutation, str(revision), now))
        return 200, result
    return 404, {'error': 'Not found'}
