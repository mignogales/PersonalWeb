"""Isolated security checks against a real local HTTP gateway and temporary DBs."""
import http.client
import json
import os
from pathlib import Path
import re
import tempfile
import threading
from urllib.parse import urlencode

with tempfile.TemporaryDirectory(prefix="sso-test-") as root:
    os.environ["PERSONALWEB_AUTH_DIR"] = str(Path(root) / "auth")
    os.environ["ITALIAN_DATA_DIR"] = str(Path(root) / "italian")
    os.environ["OFFICE_DATA_DIR"] = str(Path(root) / "office")
    import shared_auth as auth
    from sso_gateway import Gateway, ThreadingHTTPServer

    alice_id = auth.create_user("alice", "synthetic-alice-password", ["italian"])
    auth.create_user("bob", "synthetic-bob-password", ["italian", "office"])
    auth.create_user("charlie", "synthetic-charlie-password", ["office"])
    scale_id = auth.create_user("scale_tester", "synthetic-scale-password")
    with auth.connect() as db:
        db.execute("INSERT INTO settings VALUES ('owner_user_id',?)", (scale_id,))
    for app in auth.APPS:
        auth.grant(scale_id, app)
    try:
        auth.grant(alice_id, "scale")
        raise AssertionError("Non-owner received Scale grant")
    except ValueError:
        pass
    server = ThreadingHTTPServer(("127.0.0.1", 0), Gateway)
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    port = server.server_address[1]

    def request(method, path, cookie="", body=b"", content_type=None, expected=None, origin=None, fetch_site=None, host=None):
        conn = http.client.HTTPConnection("127.0.0.1", port, timeout=10)
        headers = {"Host": host or f"127.0.0.1:{port}"}
        if origin is None:
            origin = f"http://127.0.0.1:{port}"
        if origin:
            headers["Origin"] = origin
        if fetch_site:
            headers["Sec-Fetch-Site"] = fetch_site
        if cookie:
            headers["Cookie"] = cookie
        if content_type:
            headers["Content-Type"] = content_type
        if expected:
            headers["X-Expected-User"] = expected
        conn.request(method, path, body=body, headers=headers)
        result = conn.getresponse()
        answer = (result.status, dict(result.getheaders()), result.read())
        conn.close()
        return answer

    def login_form(host=None):
        status, headers, page = request("GET", "/auth/login", host=host)
        assert status == 200
        assert headers["Referrer-Policy"] == "same-origin"
        token = re.search(rb'name="csrf" value="([A-Za-z0-9_-]+)"', page).group(1).decode()
        return headers["Set-Cookie"].split(";", 1)[0], token

    def login(username, password):
        csrf_cookie, csrf = login_form()
        body = urlencode({"username": username, "password": password, "next": "/auth/", "csrf": csrf}).encode()
        status, headers, _ = request("POST", "/auth/login", cookie=csrf_cookie, body=body, content_type="application/x-www-form-urlencoded")
        assert status == 303, status
        return headers["Set-Cookie"].split(";", 1)[0]

    try:
        assert request("GET", "/health")[0] == 200
        original_proxy = Gateway.proxy
        def health_proxy(self, port, path, headers, limit, timeout):
            assert (port, path, headers, limit, timeout) == (8788, "/nightwatch/health", {}, 0, 5)
            return self.send_json(200, {"ok": True, "service": "nightwatch"})
        Gateway.proxy = health_proxy
        try:
            assert json.loads(request("GET", "/nightwatch/health")[2]) == {"ok": True, "service": "nightwatch"}
        finally:
            Gateway.proxy = original_proxy
        for route in ("/scale/api/measurements", "/calories/api/logs", "/nightwatch/api/state", "/italian/progress", "/office/schedule"):
            assert request("GET", route)[0] == 401, route
        for route in ("/calories/", "/calories/index.html"):
            status, headers, _ = request("GET", route)
            assert status == 303 and headers["Location"] == "https://personal.miguelnogales.com/calories/"
        alice = login("alice", "synthetic-alice-password")
        csrf_cookie, csrf = login_form(host="api.miguelnogales.com")
        browser_form = urlencode({"username": "alice", "password": "synthetic-alice-password", "next": "/auth/", "csrf": csrf}).encode()
        status, headers, _ = request("POST", "/auth/login", cookie=csrf_cookie, body=browser_form, content_type="application/x-www-form-urlencoded", origin="", fetch_site="same-origin", host="api.miguelnogales.com")
        assert status == 303 and "Set-Cookie" in headers
        status, headers, _ = request("POST", "/auth/login", body=browser_form, content_type="application/x-www-form-urlencoded", origin="https://api.miguelnogales.com", fetch_site="same-origin", host="api.miguelnogales.com")
        assert status == 303
        firefox_session = headers["Set-Cookie"].split(";", 1)[0]
        assert json.loads(request("GET", "/auth/session", firefox_session)[2])["user"]["name"] == "alice"
        assert request("POST", "/auth/login", cookie=csrf_cookie, body=browser_form, content_type="application/x-www-form-urlencoded", origin="", fetch_site="cross-site", host="api.miguelnogales.com")[0] == 403
        assert request("POST", "/auth/login", body=browser_form, content_type="application/x-www-form-urlencoded", origin="https://api.miguelnogales.com", fetch_site="cross-site", host="api.miguelnogales.com")[0] == 403
        assert request("POST", "/auth/login", body=browser_form, content_type="application/x-www-form-urlencoded", origin="", host="api.miguelnogales.com")[0] == 403
        assert request("POST", "/auth/login", body=browser_form, content_type="application/x-www-form-urlencoded", origin="null", host="api.miguelnogales.com")[0] == 403
        assert request("POST", "/auth/login", body=browser_form, content_type="application/x-www-form-urlencoded", origin="https://personal.miguelnogales.com", host="api.miguelnogales.com")[0] == 403
        assert request("POST", "/auth/login", cookie=csrf_cookie, body=browser_form, content_type="application/x-www-form-urlencoded", origin="null", host="api.miguelnogales.com")[0] == 303
        personal_home = "https://personal.miguelnogales.com/italian/"
        csrf_cookie, csrf = login_form()
        personal_login = urlencode({"username": "alice", "password": "synthetic-alice-password", "next": personal_home, "csrf": csrf}).encode()
        status, headers, _ = request("POST", "/auth/login", cookie=csrf_cookie, body=personal_login, content_type="application/x-www-form-urlencoded", origin="https://personal.miguelnogales.com")
        assert status == 303 and headers["Location"] == personal_home
        personal_cookie = headers["Set-Cookie"].split(";", 1)[0]
        assert request("POST", "/auth/logout", personal_cookie, origin="https://personal.miguelnogales.com")[0] == 303
        bob = login("bob", "synthetic-bob-password")
        charlie = login("charlie", "synthetic-charlie-password")
        scale_tester = login("scale_tester", "synthetic-scale-password")
        status, _, alice_launcher = request("GET", "/auth/", alice)
        assert status == 200 and b"<h3>Italian</h3>" in alice_launcher
        assert b"<h3>Scale</h3>" not in alice_launcher and b"<h3>Calories</h3>" not in alice_launcher
        status, _, owner_launcher = request("GET", "/auth/", scale_tester)
        assert status == 200 and owner_launcher.count(b'class="card tone-') == len(auth.APPS)
        if os.environ.get("LAUNCHER_PREVIEW_PATH"):
            Path(os.environ["LAUNCHER_PREVIEW_PATH"]).write_bytes(owner_launcher)
        csrf_cookie, csrf = login_form()
        assert request("POST", "/auth/login", cookie=csrf_cookie, body=urlencode({"username": "alice", "password": "wrong", "csrf": csrf}).encode(), content_type="application/x-www-form-urlencoded")[0] == 401
        for route in ("/scale/api/measurements", "/calories/api/logs", "/nightwatch/api/state", "/office/schedule"):
            assert request("GET", route, alice)[0] == 403, route
        assert request("GET", "/office/schedule", bob)[0] == 200
        assert request("GET", "/scale/", scale_tester)[0] == 200
        assert request("GET", "/italian/progress", alice)[0] == 200
        assert request("GET", "/italian/progress", bob)[0] == 200
        progress = {"forms": {}, "currentStreak": 1, "bestStreak": 1, "practicedDays": ["2026-09-17"], "attemptHistory": []}
        payload = json.dumps({"revision": 0, "progress": progress, "mutationId": "test-one"}).encode()
        assert request("PUT", "/italian/progress", alice, payload, "application/json")[0] == 200
        assert json.loads(request("GET", "/italian/progress", alice)[2])["revision"] == 1
        assert json.loads(request("GET", "/italian/progress", bob)[2])["revision"] == 0
        assert request("PUT", "/italian/progress", bob, payload, "application/json", expected="alice")[0] == 409
        assert json.loads(request("GET", "/italian/progress", bob)[2])["revision"] == 0
        day = json.dumps({"changes": {"2026-09-17": True}}).encode()
        assert request("PUT", "/office/schedule/me", bob, day, "application/json")[0] == 200
        day = json.dumps({"changes": {"2026-09-17": False}}).encode()
        assert request("PUT", "/office/schedule/me", charlie, day, "application/json")[0] == 200
        assert json.loads(request("GET", "/office/schedule", bob)[2])["schedule"]["dates"]["2026-09-17"] == ["bob"]
        profile = json.loads(request("GET", "/auth/session", alice)[2])
        assert profile["apps"] == ["italian"]
        status, headers, launcher = request("GET", "/auth/", alice, origin="", host="api.miguelnogales.com")
        assert status == 200
        csrf = re.search(rb'name="csrf" value="([A-Za-z0-9_-]+)"', launcher).group(1).decode()
        csrf_cookie = headers["Set-Cookie"].split(";", 1)[0]
        logout_form = urlencode({"csrf": csrf}).encode()
        assert request("POST", "/auth/logout", f"{alice}; {csrf_cookie}", logout_form, "application/x-www-form-urlencoded", origin="", host="api.miguelnogales.com")[0] == 303
        assert request("GET", "/italian/progress", alice)[0] == 401
        alice = login("alice", "synthetic-alice-password")
        auth.reset_password("alice", "synthetic-alice-new-password")
        assert request("GET", "/italian/progress", alice)[0] == 401
        csrf_cookie, csrf = login_form()
        old = urlencode({"username": "alice", "password": "synthetic-alice-password", "csrf": csrf}).encode()
        assert request("POST", "/auth/login", cookie=csrf_cookie, body=old, content_type="application/x-www-form-urlencoded")[0] == 401
        assert login("alice", "synthetic-alice-new-password")
        assert request("GET", "//evil.example/scale/", bob)[0] == 404
        print("PASS: shared login, session revocation, app grants, private route denial, legacy health")
    finally:
        server.shutdown()
        worker.join()
