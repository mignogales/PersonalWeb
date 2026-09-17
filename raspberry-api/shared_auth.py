"""Small shared identity store for the personal website and Pi apps.

App grants are explicit. The scale and Nightwatch never acquire users through
registration or an app's own legacy login endpoint.
"""
import hashlib
import hmac
import os
from contextlib import contextmanager, closing
from pathlib import Path
import re
import secrets
import sqlite3
import time
from http.cookies import SimpleCookie

DATA = Path(os.environ.get("PERSONALWEB_AUTH_DIR", str(Path.home() / ".local/share/personalweb-auth")))
COOKIE = "personalweb_session"
APPS = frozenset({"calories", "italian", "office", "scale", "nightwatch", "personal", "chat"})
OWNER_ONLY = frozenset({"scale", "nightwatch", "personal"})
SESSION_AGE = 7 * 86400


@contextmanager
def connect():
    DATA.mkdir(parents=True, exist_ok=True, mode=0o700)
    db = sqlite3.connect(DATA / "auth.sqlite3", timeout=15)
    (DATA / "auth.sqlite3").chmod(0o600)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, username TEXT NOT NULL, username_key TEXT NOT NULL UNIQUE,
            salt TEXT NOT NULL, password_hash TEXT NOT NULL, created INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS grants (
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            app TEXT NOT NULL, PRIMARY KEY(user_id, app));
        CREATE TABLE IF NOT EXISTS sessions (
            token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            expires INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS app_accounts (
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            app TEXT NOT NULL, account_id TEXT NOT NULL, token TEXT,
            PRIMARY KEY(user_id, app), UNIQUE(app, account_id));
        CREATE TABLE IF NOT EXISTS attempts (
            source TEXT PRIMARY KEY, started INTEGER NOT NULL, count INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY, value TEXT NOT NULL);
    """)
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def password_hash(password, salt):
    return hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 200_000).hex()


def create_user(username, password, apps=()):
    username = " ".join(username.split())
    if not 2 <= len(username) <= 60 or not re.fullmatch(r"[\w .@+-]+", username, re.UNICODE):
        raise ValueError("Invalid username")
    if not 12 <= len(password) <= 256:
        raise ValueError("Password must have 12–256 characters")
    if not set(apps) <= APPS:
        raise ValueError("Unknown app grant")
    if set(apps) & OWNER_ONLY:
        raise ValueError("Private apps are reserved for the owner")
    user_id, salt = secrets.token_hex(16), secrets.token_hex(16)
    with connect() as db:
        db.execute("INSERT INTO users VALUES (?,?,?,?,?,?)", (user_id, username, username.casefold(), salt, password_hash(password, salt), int(time.time())))
        db.executemany("INSERT INTO grants VALUES (?,?)", ((user_id, app) for app in apps))
    return user_id


def authenticate(username, password, source):
    now = int(time.time())
    source = source[:120]
    with connect() as db:
        with db:
            db.execute("DELETE FROM attempts WHERE started<?", (now - 900,))
            row = db.execute("SELECT started,count FROM attempts WHERE source=?", (source,)).fetchone()
            if row and row["count"] >= 12:
                return None, "rate_limited"
            if row:
                db.execute("UPDATE attempts SET count=count+1 WHERE source=?", (source,))
            else:
                db.execute("INSERT INTO attempts VALUES (?,?,1)", (source, now))
        user = db.execute("SELECT * FROM users WHERE username_key=?", (username.strip().casefold(),)).fetchone()
        salt = user["salt"] if user else "00" * 16
        candidate = password_hash(password, salt)
        if not user or not hmac.compare_digest(candidate, user["password_hash"]):
            return None, "invalid"
        db.execute("DELETE FROM attempts WHERE source=?", (source,))
        return dict(user), None


def issue_session(user_id):
    token = secrets.token_urlsafe(32)
    now = int(time.time())
    with connect() as db:
        with db:
            db.execute("DELETE FROM sessions WHERE expires<?", (now,))
            db.execute("INSERT INTO sessions VALUES (?,?,?)", (hashlib.sha256(token.encode()).hexdigest(), user_id, now + SESSION_AGE))
    return token


def session_token(headers):
    try:
        return SimpleCookie(headers.get("Cookie", ""))[COOKIE].value
    except (KeyError, ValueError):
        return None


def identity(headers):
    token = session_token(headers)
    if not token:
        return None
    with connect() as db:
        row = db.execute("""SELECT users.id, users.username FROM sessions JOIN users ON users.id=sessions.user_id
            WHERE sessions.token_hash=? AND sessions.expires>?""", (hashlib.sha256(token.encode()).hexdigest(), int(time.time()))).fetchone()
        if not row:
            return None
        result = dict(row)
        result["grants"] = {r[0] for r in db.execute("SELECT app FROM grants WHERE user_id=?", (row["id"],))}
        return result


def revoke_session(headers):
    token = session_token(headers)
    if token:
        with connect() as db:
            db.execute("DELETE FROM sessions WHERE token_hash=?", (hashlib.sha256(token.encode()).hexdigest(),))


def cookie(value, secure=True, max_age=SESSION_AGE):
    # Domain scope lets the website Worker and the API share one browser session.
    domain = "; Domain=miguelnogales.com" if secure else ""
    return f"{COOKIE}={value}; Path=/; HttpOnly; SameSite=Lax; Max-Age={max_age}{'; Secure' if secure else ''}{domain}"


def grant(user_id, app):
    if app not in APPS:
        raise ValueError("Unknown app")
    with connect() as db:
        if app in OWNER_ONLY:
            owner = db.execute("SELECT value FROM settings WHERE key='owner_user_id'").fetchone()
            if not owner or owner["value"] != user_id:
                raise ValueError("Private app grant is owner-only")
        db.execute("INSERT OR IGNORE INTO grants VALUES (?,?)", (user_id, app))


def reset_password(username, password):
    if not 12 <= len(password) <= 256:
        raise ValueError("Password must have 12–256 characters")
    salt = secrets.token_hex(16)
    digest = password_hash(password, salt)
    with connect() as db:
        row = db.execute("SELECT id FROM users WHERE username_key=?", (username.casefold(),)).fetchone()
        if not row:
            raise ValueError("User not found")
        db.execute("UPDATE users SET salt=?, password_hash=? WHERE id=?", (salt, digest, row["id"]))
        db.execute("DELETE FROM sessions WHERE user_id=?", (row["id"],))


def account(user_id, app):
    with connect() as db:
        row = db.execute("SELECT account_id,token FROM app_accounts WHERE user_id=? AND app=?", (user_id, app)).fetchone()
        return dict(row) if row else None


def set_account(user_id, app, account_id, token=None):
    with connect() as db:
        db.execute("""INSERT INTO app_accounts VALUES (?,?,?,?) ON CONFLICT(user_id,app)
            DO UPDATE SET account_id=excluded.account_id,token=excluded.token""", (user_id, app, str(account_id), token))


def bootstrap_calorie_owner(username="miguel"):
    """Copy only the existing password verifier; never print it or rotate it."""
    calorie_path = Path.home() / "CalorieTracking/data/calorie_tracker.sqlite3"
    with closing(sqlite3.connect(calorie_path)) as calorie:
        calorie.row_factory = sqlite3.Row
        row = calorie.execute("SELECT id,username,token,password_salt,password_hash FROM users WHERE username=?", (username,)).fetchone()
    if not row or not row["password_salt"] or not row["password_hash"]:
        raise ValueError("Existing calorie account is missing or has no password")
    with connect() as db:
        existing = db.execute("SELECT id FROM users WHERE username_key=?", (username.casefold(),)).fetchone()
        if existing:
            linked = db.execute("SELECT account_id FROM app_accounts WHERE user_id=? AND app='calories'", (existing["id"],)).fetchone()
            if not linked or linked["account_id"] != str(row["id"]):
                raise ValueError("Existing shared account is not linked to this Calories account")
            db.execute("INSERT OR REPLACE INTO settings VALUES ('owner_user_id',?)", (existing["id"],))
            db.executemany("INSERT OR IGNORE INTO grants VALUES (?,?)", ((existing["id"], app) for app in APPS))
            return existing["id"]
        user_id = secrets.token_hex(16)
        with db:
            db.execute("INSERT INTO users VALUES (?,?,?,?,?,?)", (user_id, username, username.casefold(), row["password_salt"], row["password_hash"], int(time.time())))
            db.executemany("INSERT INTO grants VALUES (?,?)", ((user_id, app) for app in APPS))
            db.execute("INSERT INTO app_accounts VALUES (?,?,?,?)", (user_id, "calories", str(row["id"]), row["token"]))
            db.execute("INSERT INTO settings VALUES ('owner_user_id',?)", (user_id,))
    return user_id


if __name__ == "__main__":
    import argparse
    import getpass
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="action", required=True)
    sub.add_parser("bootstrap-owner")
    add = sub.add_parser("add-user")
    add.add_argument("username")
    add.add_argument("--app", action="append", choices=sorted(APPS), default=[])
    give = sub.add_parser("grant")
    give.add_argument("username")
    give.add_argument("app", choices=sorted(APPS))
    reset = sub.add_parser("reset-password")
    reset.add_argument("username")
    args = parser.parse_args()
    if args.action == "bootstrap-owner":
        bootstrap_calorie_owner()
        print("Owner account linked to existing Calories login")
    elif args.action == "add-user":
        password = getpass.getpass("New shared password: ")
        if password != getpass.getpass("Repeat password: "):
            parser.error("Passwords do not match")
        create_user(args.username, password, args.app)
        print("User created")
    elif args.action == "reset-password":
        password = getpass.getpass("New shared password: ")
        if password != getpass.getpass("Repeat password: "):
            parser.error("Passwords do not match")
        reset_password(args.username, password)
        print("Shared password changed; all sessions revoked")
    else:
        with connect() as db:
            row = db.execute("SELECT id FROM users WHERE username_key=?", (args.username.casefold(),)).fetchone()
        if not row:
            parser.error("User not found")
        grant(row["id"], args.app)
        print("Grant added")
