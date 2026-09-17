"""Shared browser login for the Pi APIs, with explicit app access grants."""
import base64
from contextlib import closing
import hashlib
import html
import http.client
import json
import os
from pathlib import Path
import secrets
import sqlite3
import sys
import threading
import time
from urllib.parse import parse_qs, quote, urlsplit

sys.path.insert(0, str(Path.home() / "personalweb-api"))
sys.path.insert(0, str(Path.home() / "CalorieTracking/deploy"))
from italian import APIError, connect as italian_connect, handle as italian_handle
from office import connect as office_connect, handle as office_handle, snapshot as office_snapshot
from pi_gateway import Gateway as BaseGateway, ThreadingHTTPServer
import shared_auth as auth

CALORIE_DB = Path.home() / "CalorieTracking/data/calorie_tracker.sqlite3"
NIGHTWATCH_DB = Path.home() / ".local/share/nightwatch/nightwatch.sqlite3"
SCALE_PASSWORD = Path.home() / ".config/scale-dashboard/password"
APP_LOCK = threading.Lock()


def app_token(user, app):
    with APP_LOCK:
        return _app_token(user, app)


def _app_token(user, app):
    linked = auth.account(user["id"], app)
    if app == "calories":
        if linked:
            return linked["token"]
        token = secrets.token_urlsafe(32)
        with closing(sqlite3.connect(CALORIE_DB, timeout=15)) as db:
            with db:
                db.execute("BEGIN IMMEDIATE")
                if db.execute("SELECT 1 FROM users WHERE username=?", (user["username"],)).fetchone():
                    raise RuntimeError("Calories username requires manual mapping")
                row = db.execute("INSERT INTO users (username,token,password_salt,password_hash) VALUES (?,?,?,?)",
                                 (user["username"], token, secrets.token_hex(16), secrets.token_hex(32)))
                account_id = str(row.lastrowid)
        auth.set_account(user["id"], app, account_id, token)
        return token
    if app in ("italian", "office"):
        connector = italian_connect if app == "italian" else office_connect
        account_id = linked["account_id"] if linked else user["id"]
        token = linked["token"] if linked else secrets.token_urlsafe(32)
        with closing(connector()) as db:
            with db:
                if not linked:
                    db.execute("INSERT INTO accounts VALUES (?,?,?,?,?,?)", (account_id, user["username"], user["username"].casefold(), secrets.token_hex(16), secrets.token_hex(32), time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())))
                db.execute("INSERT OR REPLACE INTO sessions VALUES (?,?,?)", (hashlib.sha256(token.encode()).hexdigest(), account_id, int(time.time()) + auth.SESSION_AGE))
        if not linked:
            auth.set_account(user["id"], app, account_id, token)
        return token
    if app == "nightwatch":
        token = linked["token"] if linked else secrets.token_urlsafe(32)
        with closing(sqlite3.connect(NIGHTWATCH_DB, timeout=15)) as db:
            with db:
                db.execute("INSERT OR REPLACE INTO sessions VALUES (?,?)", (hashlib.sha256(token.encode()).hexdigest(), time.time() + auth.SESSION_AGE))
        if not linked:
            auth.set_account(user["id"], app, user["id"], token)
        return token
    raise ValueError("Unknown app")


class Gateway(BaseGateway):
    def public_https(self):
        return self.headers.get("Host", "").split(":")[0] == "api.miguelnogales.com" or bool(self.headers.get("CF-Ray"))

    def valid_origin(self):
        origin = self.headers.get("Origin", "")
        if origin:
            parsed = urlsplit(origin)
            local_target = self.headers.get("Host", "").split(":")[0] in ("127.0.0.1", "localhost")
            return (parsed.scheme == "https" and parsed.netloc in ("miguelnogales.com", "personal.miguelnogales.com", "api.miguelnogales.com")) or (local_target and parsed.scheme == "http" and parsed.hostname in ("127.0.0.1", "localhost"))
        fetch_site = self.headers.get("Sec-Fetch-Site")
        if fetch_site == "same-origin":
            return True
        return not self.public_https() and fetch_site not in ("cross-site", "same-site")

    def redirect(self, location, cookie=None):
        self.send_response(303)
        self.send_header("Location", location)
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def html(self, markup, status=200):
        data = markup.encode()
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.end_headers()
        self.wfile.write(data)

    @staticmethod
    def safe_next(value):
        if any(char in value for char in "\r\n\\"):
            return "/auth/"
        if value.startswith("/") and not value.startswith("//"):
            return value
        parsed = urlsplit(value)
        if parsed.scheme == "https" and parsed.netloc in ("miguelnogales.com", "personal.miguelnogales.com", "api.miguelnogales.com"):
            return value
        return "/auth/"

    def login_page(self, next_url, message="", status=200):
        alert = f'<p class="error" role="alert">{html.escape(message)}</p>' if message else ""
        markup = f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in · Your apps</title><style>body{{font:16px system-ui;background:#101827;color:#eef4fa;min-height:100vh;display:grid;place-items:center;margin:0}}main{{width:min(390px,calc(100% - 40px));background:#1b2a3a;padding:32px;border:1px solid #3b536a;border-radius:20px;box-shadow:0 22px 75px #050b14}}h1{{font-size:2rem;margin:.2em 0}}p{{color:#b9cbd8}}label{{display:block;margin:16px 0 6px}}input{{box-sizing:border-box;width:100%;padding:13px;border-radius:9px;border:1px solid #60788c;background:#0c1723;color:white;font:inherit}}button{{margin-top:24px;width:100%;padding:14px;border:0;border-radius:9px;background:#7ce1ce;color:#10231d;font-weight:800;font:inherit;cursor:pointer}}.error{{color:#ffb0ad}}</style><main><p>One account for your apps</p><h1>Sign in</h1>{alert}<form method="post" action="/auth/login"><input type="hidden" name="next" value="{html.escape(next_url, quote=True)}"><label for="username">Username</label><input id="username" name="username" autocomplete="username" required maxlength="60" autofocus><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256"><button type="submit">Continue</button></form></main></html>'''
        return self.html(markup, status)

    def auth_route(self, path):
        user = auth.identity(self.headers)
        query = parse_qs(urlsplit(self.path).query)
        if path in ("/auth", "/auth/") and self.command == "GET":
            if not user:
                return self.redirect("/auth/login")
            links = {"calories": "https://personal.miguelnogales.com/calories/", "italian": "https://personal.miguelnogales.com/italian/", "office": "https://personal.miguelnogales.com/apps/office-scheduler/", "scale": "/scale/", "nightwatch": "/nightwatch/", "personal": "https://personal.miguelnogales.com/personal/dashboard", "chat": "https://personal.miguelnogales.com/apps/chat-lab/"}
            items = "".join(f'<li><a href="{html.escape(links[app], quote=True)}">{html.escape(app.title())}</a></li>' for app in sorted(user["grants"]))
            return self.html(f'<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your apps</title><style>body{{font:18px system-ui;max-width:40rem;margin:4rem auto;padding:0 1rem;background:#101827;color:white}}a{{color:#7ce1ce}}li{{margin:1em 0}}button{{padding:.6em}}</style><h1>Hi, {html.escape(user["username"])}</h1><p>Your apps</p><ul>{items}</ul><form method="post" action="/auth/logout"><button>Sign out</button></form></html>')
        if path == "/auth/session" and self.command == "GET":
            return self.send_json(200, {"user": {"id": user["id"], "name": user["username"]}, "apps": sorted(user["grants"])}) if user else self.send_json(401, {"error": "Sign in required"})
        if path == "/auth/login" and self.command == "GET":
            next_url = self.safe_next(query.get("next", ["/auth/"])[0])
            return self.redirect(next_url) if user else self.login_page(next_url)
        if path == "/auth/login" and self.command == "POST":
            if not self.valid_origin():
                return self.send_json(403, {"error": "Invalid origin"})
            if not self.headers.get("Content-Type", "").startswith("application/x-www-form-urlencoded"):
                return self.send_json(415, {"error": "Expected form data"})
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                return self.send_json(400, {"error": "Invalid request"})
            if not 0 < length <= 4096:
                return self.send_json(413, {"error": "Form too large"})
            form = parse_qs(self.rfile.read(length).decode(), keep_blank_values=True)
            next_url = self.safe_next(form.get("next", ["/auth/"])[0])
            username, password = form.get("username", [""])[0], form.get("password", [""])[0]
            if len(username) > 60 or len(password) > 256:
                return self.login_page(next_url, "Invalid username or password", 401)
            matched, error = auth.authenticate(username, password, self.headers.get("CF-Connecting-IP", self.client_address[0]))
            if not matched:
                return self.login_page(next_url, "Too many attempts; try later" if error == "rate_limited" else "Invalid username or password", 429 if error == "rate_limited" else 401)
            return self.redirect(next_url, auth.cookie(auth.issue_session(matched["id"]), self.public_https()))
        if path == "/auth/logout" and self.command == "POST":
            if not self.valid_origin():
                return self.send_json(403, {"error": "Invalid origin"})
            auth.revoke_session(self.headers)
            return self.redirect("/auth/login", auth.cookie("", self.public_https(), 0))
        return self.send_json(404, {"error": "Not found"})

    def require(self, app):
        user = auth.identity(self.headers)
        if user and app in user["grants"]:
            expected = self.headers.get("X-Expected-User")
            if expected and expected != user["username"]:
                self.send_json(409, {"error": "Account changed; reload this app"})
                return None
            if self.command not in ("GET", "HEAD") and not self.valid_origin():
                self.send_json(403, {"error": "Invalid origin"})
                return None
            return user
        if user:
            self.send_json(403, {"error": "No access to this app"})
        elif self.command == "GET" and "text/html" in self.headers.get("Accept", ""):
            self.redirect("/auth/login?next=" + quote("https://api.miguelnogales.com" + self.path, safe=""))
        else:
            self.send_json(401, {"error": "Sign in required"})
        return None

    def dispatch(self):
        path = urlsplit(self.path).path
        if path == "/health" and self.command == "GET":
            return super().dispatch()
        if path == "/auth" or path.startswith("/auth/"):
            return self.auth_route(path)
        if path in ("/scale", "/calories", "/nightwatch"):
            return self.redirect(path + "/")
        if path.startswith("/calories/"):
            user = self.require("calories")
            return self.calories(user) if user else None
        if path.startswith("/scale/"):
            user = self.require("scale")
            return self.scale(user) if user else None
        if path == "/nightwatch" or path.startswith("/nightwatch/"):
            user = auth.identity(self.headers)
            if user and "nightwatch" in user["grants"]:
                if self.command not in ("GET", "HEAD") and not self.valid_origin():
                    return self.send_json(403, {"error": "Invalid origin"})
                return self.nightwatch(app_token(user, "nightwatch"))
            if path.startswith("/nightwatch/api/") and self.headers.get("Authorization", "").startswith("Bearer "):
                return self.nightwatch(None, True)
            return self.require("nightwatch")
        if path.startswith("/italian/") or path.startswith("/office/"):
            app = "italian" if path.startswith("/italian/") else "office"
            user = self.require(app)
            return self.app_request(app, user) if user else None
        return self.send_json(404, {"error": "Not found"})

    def read_body(self, limit):
        length = int(self.headers.get("Content-Length", "0"))
        if not 0 <= length <= limit:
            raise APIError(413, "Request too large")
        return self.rfile.read(length)

    def proxy(self, port, path, headers, limit, timeout):
        upstream = http.client.HTTPConnection("127.0.0.1", port, timeout=timeout)
        try:
            upstream.request(self.command, path, self.read_body(limit), headers)
            response = upstream.getresponse()
            data = response.read()
            self.send_response(response.status)
            allowed = {"content-type", "cache-control", "location", "content-disposition", "content-security-policy", "x-content-type-options", "x-frame-options", "referrer-policy"}
            for key, value in response.getheaders():
                if key.lower() in allowed:
                    self.send_header(key, value)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)
        except APIError as error:
            self.send_json(error.status, {"error": error.message})
        except (OSError, http.client.HTTPException, ValueError):
            self.send_json(502, {"error": "App temporarily unavailable"})
        finally:
            upstream.close()

    def calories(self, user):
        path = self.path[len("/calories"):]
        if path in ("/api/users", "/api/login", "/api/password"):
            return self.send_json(410, {"error": "Use the shared account"})
        headers = {"X-Access-Token": app_token(user, "calories")}
        if self.headers.get("Content-Type"):
            headers["Content-Type"] = self.headers["Content-Type"]
        return self.proxy(8000, path, headers, 20_000_000, 110)

    def scale(self, user):
        password = SCALE_PASSWORD.read_text().strip()
        credentials = base64.b64encode(("miguel:" + password).encode()).decode()
        headers = {"Authorization": "Basic " + credentials}
        if self.headers.get("Content-Type"):
            headers["Content-Type"] = self.headers["Content-Type"]
        return self.proxy(8765, self.path, headers, 4096, 15)

    def nightwatch(self, token, machine=False):
        headers = {key: self.headers[key] for key in ("Host", "Content-Type", "Origin", "Sec-Fetch-Site", "X-Forwarded-Proto") if self.headers.get(key)}
        if machine:
            headers["Authorization"] = self.headers["Authorization"]
        else:
            headers["Cookie"] = "nightwatch_session=" + token
        return self.proxy(8788, self.path, headers, 16000, 20)

    def app_request(self, app, user):
        path = urlsplit(self.path).path
        if path in ("/italian/auth/logout", "/office/logout") and self.command == "POST":
            auth.revoke_session(self.headers)
            return self.send_json(200, {"ok": True})
        token = app_token(user, app)
        connector = italian_connect if app == "italian" else office_connect
        if path in ("/italian/auth/login", "/italian/auth/register", "/italian/auth/me", "/office/login"):
            with closing(connector()) as db:
                row = db.execute("SELECT id,name,created FROM accounts WHERE id=?", (user["id"],)).fetchone()
                profile = {"id": row["id"], "name": row["name"], "createdAt": row["created"], "lastSeenAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
                result = {"token": "shared-session", "user": profile}
                if app == "office":
                    result["expiresAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + auth.SESSION_AGE))
                    result.update(office_snapshot(db))
                return self.send_json(200, result)
        try:
            body = json.loads(self.read_body(4_000_000) or b"{}")
            if not isinstance(body, dict):
                raise APIError(400, "Invalid JSON object")
            status, result = (italian_handle if app == "italian" else office_handle)(self.command, path, {"Authorization": "Bearer " + token}, body)
            return self.send_json(status, result)
        except APIError as error:
            return self.send_json(error.status, {"error": error.message})
        except (ValueError, UnicodeDecodeError):
            return self.send_json(400, {"error": "Invalid request"})

    do_GET = do_POST = do_PUT = do_PATCH = do_DELETE = do_OPTIONS = dispatch


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", int(os.environ.get("PORT", "8090"))), Gateway).serve_forever()
