"""Shared browser login for the Pi APIs, with explicit app access grants."""
import base64
from contextlib import closing
import hashlib
import hmac
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
from http.cookies import SimpleCookie
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

LAUNCHER_APPS = (
    ("scale", "Scale", "HEALTH", "Your weight, impedance, and longer-term trends.", "/scale/", "kg", "mint"),
    ("calories", "Calories", "NUTRITION", "Meals, goals, and the progress you are making.", "https://personal.miguelnogales.com/calories/", "C", "amber"),
    ("italian", "Italian", "LEARNING", "A little practice today goes a long way.", "https://personal.miguelnogales.com/italian/", "IT", "lilac"),
    ("office", "Office calendar", "PLANNING", "Your office days and the shared team view.", "https://personal.miguelnogales.com/apps/office-scheduler/", "O", "blue"),
    ("personal", "Personal dashboard", "OVERVIEW", "A home for your private tools and shortcuts.", "https://personal.miguelnogales.com/personal/dashboard", "P", "coral"),
    ("chat", "Chat Lab", "CREATIVE", "Think through ideas, draft, and explore.", "https://personal.miguelnogales.com/apps/chat-lab/", "✦", "rose"),
    ("nightwatch", "Nightwatch", "SYSTEMS", "Follow jobs, reminders, and what is running.", "/nightwatch/", "N", "steel"),
)

LAUNCHER_CSS = """
:root{color-scheme:dark;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;min-height:100vh;color:#eaf5f1;background:#071516;line-height:1.5}
body:before{content:"";position:fixed;inset:0;pointer-events:none;background:radial-gradient(circle at 12% 4%,#1b3a37 0,transparent 34%),radial-gradient(circle at 95% 45%,#182b34 0,transparent 32%);opacity:.9}
a{color:inherit;text-decoration:none}button{font:inherit}.shell{position:relative;max-width:1110px;margin:auto;padding:28px 30px 56px}
.topbar,.brand,.account,.user-pill,.section-heading,.hero-meta,.card-top,.footer{display:flex;align-items:center}.topbar,.section-heading,.card-top,.footer{justify-content:space-between}
.topbar{gap:18px}.brand{gap:12px;min-width:0}.brand-mark{display:grid;place-items:center;width:44px;height:44px;border-radius:14px;background:#b8e9d7;color:#0a2626;font-size:1rem;font-weight:900;letter-spacing:-.12em;padding-right:.12em;box-shadow:0 10px 30px #050e0d70}
.brand-name{font-size:.92rem;font-weight:750;letter-spacing:.02em;white-space:nowrap}.brand-name small{display:block;margin-top:1px;color:#9bb0ae;font-size:.7rem;font-weight:500;letter-spacing:.08em;text-transform:uppercase}
.account{gap:16px}.user-pill{gap:9px;color:#c9d8d3;font-size:.87rem}.avatar{display:grid;place-items:center;width:32px;height:32px;border:1px solid #47625c;border-radius:50%;background:#1b3232;color:#b5efda;font-weight:750;text-transform:uppercase}
.signout button{padding:9px 14px;border:1px solid #3b5350;border-radius:999px;background:#ffffff0b;color:#dceae4;cursor:pointer;font-size:.82rem;font-weight:650;transition:background .2s,border-color .2s}
.signout button:hover{background:#ffffff16;border-color:#8fbeb0}.signout button:focus-visible,a:focus-visible{outline:2px solid #b8e9d7;outline-offset:3px}
.hero{position:relative;overflow:hidden;margin:61px 0 59px;padding:48px 52px 38px;border:1px solid #385953;border-radius:28px;background:linear-gradient(110deg,#183d39 0%,#102d2e 55%,#102327 100%);box-shadow:0 30px 90px #020b0d78}
.hero:after{content:"";position:absolute;width:410px;height:410px;right:-88px;top:-139px;border:1px solid #a7e8d548;border-radius:50%;box-shadow:0 0 0 62px #a7e8d50d,0 0 0 126px #a7e8d508;pointer-events:none}
.hero-content{position:relative;z-index:1}.eyebrow,.section-index,.card-category{font-size:.68rem;font-weight:800;letter-spacing:.19em;text-transform:uppercase}.eyebrow{display:inline-flex;align-items:center;gap:9px;color:#b5ead4}.eyebrow:before{content:"";width:7px;height:7px;border-radius:50%;background:#a8efcc;box-shadow:0 0 0 5px #a8efcc25}
h1,h2,p{margin:0}.hero h1{max-width:720px;margin:23px 0 18px;font-size:clamp(2.7rem,6vw,4.65rem);line-height:1.03;letter-spacing:-.065em;font-weight:760}.hero h1 em{font-style:normal;color:#b4e9d1}.hero p{max-width:530px;color:#bad0c9;font-size:1.03rem}
.hero-meta{gap:20px;margin-top:50px;padding-top:22px;border-top:1px solid #9de1ca38;color:#c6ddd4;font-size:.83rem}.app-count{display:flex;align-items:baseline;gap:9px}.app-count strong{color:#c1f0d8;font-size:1.65rem;line-height:1}.privacy-note{color:#9fbab2}
.section-heading{align-items:end;gap:20px;margin-bottom:20px}.section-index{color:#98cbb8}.section-heading h2{margin-top:7px;font-size:clamp(1.4rem,3vw,1.85rem);font-weight:700;letter-spacing:-.04em}
.cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.card{--glow:#21413c;--icon:#bbe8d7;--icon-bg:#285047;position:relative;display:flex;flex-direction:column;overflow:hidden;min-height:222px;padding:24px 26px;border:1px solid #29423f;border-radius:22px;background:linear-gradient(145deg,#142a2a,#102123);transition:transform .2s,border-color .2s,box-shadow .2s}
.card:before{content:"";position:absolute;width:190px;height:190px;right:-87px;top:-92px;border-radius:50%;background:var(--glow);filter:blur(23px);opacity:.62;pointer-events:none}.card:hover{transform:translateY(-4px);border-color:#6c9b8d;box-shadow:0 18px 34px #020c0d88}
.card-top,.card-body{position:relative;z-index:1}.icon{display:grid;place-items:center;width:47px;height:47px;border-radius:14px;background:var(--icon-bg);color:var(--icon);font-size:1.04rem;font-weight:850;letter-spacing:-.04em}.arrow{display:grid;place-items:center;width:31px;height:31px;border:1px solid #6d8b8159;border-radius:50%;color:#d6ece2;font-size:1rem;line-height:1;transition:transform .2s}.card:hover .arrow{transform:translate(2px,-2px)}
.card-body{margin-top:auto;padding-top:25px}.card-category{color:#93bbae}.card h3{margin:6px 0 5px;font-size:1.45rem;line-height:1.18;letter-spacing:-.045em}.card p{max-width:340px;color:#abc3bc;font-size:.89rem;line-height:1.5}
.card--featured{grid-column:span 2;min-height:244px;background:linear-gradient(110deg,#bcebd6,#96dac3);border-color:#d4f5e7;color:#102f2a}.card--featured:before{width:290px;height:290px;right:72px;top:-82px;border:28px solid #17463d2b;background:none;box-shadow:0 0 0 44px #17463d0d;filter:none;opacity:1}
.card--featured .icon{background:#1b514566;color:#163b34}.card--featured .arrow{border-color:#23574d56;color:#164135}.card--featured .card-category,.card--featured p{color:#36685b}.card--featured h3{font-size:2rem}.card--featured .card-body{padding-top:19px}.card--featured p{max-width:410px}.card--featured:hover{border-color:#eafff5;box-shadow:0 20px 40px #020c0d90}
.tone-amber{--glow:#745a2c;--icon:#ffd992;--icon-bg:#584321}.tone-lilac{--glow:#54427c;--icon:#d9c5ff;--icon-bg:#3f315d}.tone-blue{--glow:#2d567a;--icon:#addcff;--icon-bg:#25465c}.tone-coral{--glow:#775044;--icon:#ffc7ad;--icon-bg:#604032}.tone-rose{--glow:#744869;--icon:#ffc6e7;--icon-bg:#593450}.tone-steel{--glow:#405d67;--icon:#c9e4eb;--icon-bg:#31505a}
.empty{padding:30px;border:1px dashed #45635b;border-radius:18px;color:#b6cbc3}.footer{gap:20px;margin-top:42px;padding-top:21px;border-top:1px solid #28413b;color:#819f94;font-size:.75rem}.footer span:last-child{color:#a6c6b9}
@media(max-width:700px){.shell{padding:20px 18px 42px}.brand-name{font-size:.8rem}.brand-name small{font-size:.61rem}.account{gap:9px}.user-pill{font-size:0}.avatar{font-size:.8rem}.signout button{padding:8px 11px}.hero{margin:40px 0 43px;padding:35px 26px 28px;border-radius:23px}.hero:after{width:280px;height:280px;right:-164px;top:-95px}.hero h1{font-size:clamp(2.55rem,10vw,3.8rem)}.hero-meta{margin-top:39px;align-items:start;flex-direction:column;gap:8px}.section-heading{align-items:start;flex-direction:column;gap:2px}.cards{grid-template-columns:1fr}.card,.card--featured{grid-column:auto;min-height:216px}.card--featured h3{font-size:1.65rem}.card--featured:before{right:-110px}.footer{align-items:start;flex-direction:column;gap:5px}}
@media(max-width:480px){.brand-name{display:none}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.card,.arrow,.signout button{transition:none}.card:hover{transform:none}}
"""


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

    def same_origin_login(self):
        # A browser form may omit the CSRF cookie, but a real same-origin
        # Origin header cannot be supplied by a cross-origin form.
        target = "https://api.miguelnogales.com" if self.public_https() else "http://" + self.headers.get("Host", "")
        return self.headers.get("Origin") == target

    def redirect(self, location, cookie=None):
        self.send_response(303)
        self.send_header("Location", location)
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def html(self, markup, status=200, cookie=None, referrer_policy="no-referrer"):
        data = markup.encode()
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", referrer_policy)
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
        csrf, cookie = self.new_form_token()
        markup = f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in · Your apps</title><style>body{{font:16px system-ui;background:#101827;color:#eef4fa;min-height:100vh;display:grid;place-items:center;margin:0}}main{{width:min(390px,calc(100% - 40px));background:#1b2a3a;padding:32px;border:1px solid #3b536a;border-radius:20px;box-shadow:0 22px 75px #050b14}}h1{{font-size:2rem;margin:.2em 0}}p{{color:#b9cbd8}}label{{display:block;margin:16px 0 6px}}input{{box-sizing:border-box;width:100%;padding:13px;border-radius:9px;border:1px solid #60788c;background:#0c1723;color:white;font:inherit}}button{{margin-top:24px;width:100%;padding:14px;border:0;border-radius:9px;background:#7ce1ce;color:#10231d;font-weight:800;font:inherit;cursor:pointer}}.error{{color:#ffb0ad}}</style><main><p>One account for your apps</p><h1>Sign in</h1>{alert}<form method="post" action="/auth/login"><input type="hidden" name="next" value="{html.escape(next_url, quote=True)}"><input type="hidden" name="csrf" value="{csrf}"><label for="username">Username</label><input id="username" name="username" autocomplete="username" required maxlength="60" autofocus><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256"><button type="submit">Continue</button></form></main></html>'''
        return self.html(markup, status, cookie, referrer_policy="same-origin")

    def new_form_token(self):
        csrf = secrets.token_urlsafe(32)
        secure = self.public_https()
        cookie_name = "__Host-personalweb_csrf" if secure else "personalweb_csrf"
        cookie = f"{cookie_name}={csrf}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600{'; Secure' if secure else ''}"
        return csrf, cookie

    def valid_form_token(self, submitted):
        if not submitted or len(submitted) > 128 or not submitted.isascii():
            return False
        cookie_name = "__Host-personalweb_csrf" if self.public_https() else "personalweb_csrf"
        try:
            stored = SimpleCookie(self.headers.get("Cookie", ""))[cookie_name].value
        except (KeyError, ValueError):
            return False
        return hmac.compare_digest(submitted, stored)

    def launcher_page(self, user):
        granted = [app for app in LAUNCHER_APPS if app[0] in user["grants"]]
        cards = []
        for index, (_, title, category, description, url, icon, tone) in enumerate(granted):
            featured = " card--featured" if index == 0 and len(granted) != 2 else ""
            cards.append(f'<a class="card tone-{tone}{featured}" href="{html.escape(url, quote=True)}"><span class="card-top"><span class="icon" aria-hidden="true">{html.escape(icon)}</span><span class="arrow" aria-hidden="true">↗</span></span><div class="card-body"><span class="card-category">{html.escape(category)}</span><h3>{html.escape(title)}</h3><p>{html.escape(description)}</p></div></a>')
        app_count = len(granted)
        count_label = "app" if app_count == 1 else "apps"
        username = html.escape(user["username"])
        avatar = html.escape(user["username"][:1].upper() or "U")
        csrf, cookie = self.new_form_token()
        markup = f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#071516"><title>Your apps · Miguel Nogales</title><style>{LAUNCHER_CSS}</style><div class="shell"><header class="topbar"><a class="brand" href="/auth/" aria-label="Your apps home"><span class="brand-mark" aria-hidden="true">mn</span><span class="brand-name">miguelnogales.com<small>Your space</small></span></a><div class="account"><span class="user-pill"><span class="avatar" aria-hidden="true">{avatar}</span><span>{username}</span></span><form class="signout" method="post" action="/auth/logout"><input type="hidden" name="csrf" value="{csrf}"><button type="submit">Sign out</button></form></div></header><main><section class="hero" aria-labelledby="welcome"><div class="hero-content"><span class="eyebrow">YOUR SPACE</span><h1 id="welcome">Everything you need,<br><em>right here.</em></h1><p>Hi, {username}. Pick up where you left off in any of your apps.</p><div class="hero-meta"><span class="app-count"><strong>{app_count}</strong> {count_label} in your space</span><span class="privacy-note">Only apps available to your account appear here.</span></div></div></section><section aria-labelledby="apps-title"><div class="section-heading"><div><span class="section-index">01 / YOUR APPS</span><h2 id="apps-title">Where to next?</h2></div></div><div class="cards">{''.join(cards) if cards else '<p class="empty">No apps have been added to this account yet.</p>'}</div></section></main><footer class="footer"><span>One account across your apps.</span><span>Made for your everyday.</span></footer></div></html>'''
        return self.html(markup, cookie=cookie)

    def auth_route(self, path):
        user = auth.identity(self.headers)
        query = parse_qs(urlsplit(self.path).query)
        if path in ("/auth", "/auth/") and self.command == "GET":
            if not user:
                return self.redirect("/auth/login")
            return self.launcher_page(user)
        if path == "/auth/session" and self.command == "GET":
            return self.send_json(200, {"user": {"id": user["id"], "name": user["username"]}, "apps": sorted(user["grants"])}) if user else self.send_json(401, {"error": "Sign in required"})
        if path == "/auth/login" and self.command == "GET":
            next_url = self.safe_next(query.get("next", ["/auth/"])[0])
            return self.redirect(next_url) if user else self.login_page(next_url)
        if path == "/auth/login" and self.command == "POST":
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
            if self.headers.get("Sec-Fetch-Site") == "cross-site" or not (self.valid_form_token(form.get("csrf", [""])[0]) or self.same_origin_login()):
                return self.login_page(next_url, "Please reload this page and try again", 403)
            username, password = form.get("username", [""])[0], form.get("password", [""])[0]
            if len(username) > 60 or len(password) > 256:
                return self.login_page(next_url, "Invalid username or password", 401)
            matched, error = auth.authenticate(username, password, self.headers.get("CF-Connecting-IP", self.client_address[0]))
            if not matched:
                return self.login_page(next_url, "Too many attempts; try later" if error == "rate_limited" else "Invalid username or password", 429 if error == "rate_limited" else 401)
            return self.redirect(next_url, auth.cookie(auth.issue_session(matched["id"]), self.public_https()))
        if path == "/auth/logout" and self.command == "POST":
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                return self.send_json(400, {"error": "Invalid request"})
            if not 0 <= length <= 4096:
                return self.send_json(413, {"error": "Form too large"})
            body = self.rfile.read(length)
            try:
                form = parse_qs(body.decode(), keep_blank_values=True) if self.headers.get("Content-Type", "").startswith("application/x-www-form-urlencoded") else {}
            except UnicodeDecodeError:
                return self.send_json(400, {"error": "Invalid request"})
            if self.headers.get("Sec-Fetch-Site") == "cross-site" or not (self.valid_origin() or self.valid_form_token(form.get("csrf", [""])[0])):
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
        if path == "/nightwatch/health" and self.command == "GET":
            return self.proxy(8788, self.path, {}, 0, 5)
        if path == "/auth" or path.startswith("/auth/"):
            return self.auth_route(path)
        if path in ("/calories/", "/calories/index.html") and self.command == "GET":
            return self.redirect("https://personal.miguelnogales.com/calories/")
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
