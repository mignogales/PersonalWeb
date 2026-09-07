"""Private shared office calendar; only Pi administrators can create accounts."""
import hashlib
import os
import sqlite3
import time
from datetime import date
from pathlib import Path
from italian import APIError, dispatch as auth_dispatch

DATA = Path(os.environ.get("OFFICE_DATA_DIR", str(Path.home() / ".local/share/personalweb-office")))


def connect():
    DATA.mkdir(parents=True, exist_ok=True, mode=0o700)
    db = sqlite3.connect(DATA / "office.sqlite3", timeout=15)
    (DATA / "office.sqlite3").chmod(0o600)
    db.row_factory = sqlite3.Row
    db.executescript("""
        CREATE TABLE IF NOT EXISTS accounts (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, name_key TEXT UNIQUE NOT NULL,
            salt TEXT NOT NULL, password TEXT NOT NULL, created TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, account TEXT NOT NULL, expires INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, started INTEGER NOT NULL, count INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS attendance (account TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY(account, day));
    """)
    return db


def snapshot(db):
    dates = {}
    for row in db.execute("SELECT day, name FROM attendance JOIN accounts ON accounts.id=attendance.account ORDER BY day, name COLLATE NOCASE"):
        dates.setdefault(row["day"], []).append(row["name"])
    return {"schedule": {"dates": dates}}


def handle(method, path, headers, body):
    db = connect()
    try:
        if method == "POST" and path == "/office/login":
            status, result = auth_dispatch(db, "POST", "/italian/auth/login", headers, body)
            result["expiresAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + 30 * 86400))
            result.update(snapshot(db))
            return status, result
        if method == "POST" and path == "/office/logout":
            return auth_dispatch(db, "POST", "/italian/auth/logout", headers, body)
        token = headers.get("Authorization", "").removeprefix("Bearer ")
        session = db.execute("SELECT account FROM sessions WHERE token_hash=? AND expires>?", (hashlib.sha256(token.encode()).hexdigest(), int(time.time()))).fetchone()
        if not session:
            raise APIError(401, "Session expired. Sign in again.")
        if method == "GET" and path == "/office/schedule":
            return 200, snapshot(db)
        if method == "PUT" and path == "/office/schedule/me":
            changes = body.get("changes")
            if not isinstance(changes, dict) or len(changes) > 1000:
                raise APIError(400, "Provide up to 1,000 date changes")
            for day, going in changes.items():
                try:
                    valid = date.fromisoformat(day).isoformat() == day
                except (ValueError, TypeError):
                    valid = False
                if not valid or type(going) is not bool:
                    raise APIError(400, "Invalid calendar date or attendance")
            with db:
                db.execute("BEGIN IMMEDIATE")
                for day, going in changes.items():
                    if going:
                        db.execute("INSERT OR IGNORE INTO attendance VALUES (?, ?)", (session["account"], day))
                    else:
                        db.execute("DELETE FROM attendance WHERE account=? AND day=?", (session["account"], day))
                result = snapshot(db)
            return 200, result
        return 404, {"error": "Not found"}
    finally:
        db.close()


if __name__ == "__main__":
    import argparse
    import getpass
    parser = argparse.ArgumentParser(description="Create a private Office Scheduler account")
    parser.add_argument("name")
    args = parser.parse_args()
    password = getpass.getpass("New password (10–256 characters): ")
    if password != getpass.getpass("Repeat password: "):
        parser.error("Passwords do not match")
    db = connect()
    try:
        auth_dispatch(db, "POST", "/italian/auth/register", {}, {"name": args.name, "password": password})
        print("Account created.")
    except APIError as error:
        parser.error(error.message)
    finally:
        db.close()
