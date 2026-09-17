"""Isolated security checks against a real local HTTP gateway and temporary DBs."""
import http.client
import json
import os
from pathlib import Path
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
    auth.grant(scale_id, "scale")
    try:
        auth.grant(alice_id, "scale")
        raise AssertionError("Non-owner received Scale grant")
    except ValueError:
        pass
    server = ThreadingHTTPServer(("127.0.0.1", 0), Gateway)
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    port = server.server_address[1]

    def request(method, path, cookie="", body=b"", content_type=None, expected=None, origin=None):
        conn = http.client.HTTPConnection("127.0.0.1", port, timeout=10)
        headers = {"Host": f"127.0.0.1:{port}", "Origin": origin or f"http://127.0.0.1:{port}"}
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

    def login(username, password):
        body = urlencode({"username": username, "password": password, "next": "/auth/"}).encode()
        status, headers, _ = request("POST", "/auth/login", body=body, content_type="application/x-www-form-urlencoded")
        assert status == 303, status
        return headers["Set-Cookie"].split(";", 1)[0]

    try:
        assert request("GET", "/health")[0] == 200
        for route in ("/scale/api/measurements", "/calories/api/logs", "/nightwatch/api/state", "/italian/progress", "/office/schedule"):
            assert request("GET", route)[0] == 401, route
        alice = login("alice", "synthetic-alice-password")
        personal_home = "https://personal.miguelnogales.com/italian/"
        personal_login = urlencode({"username": "alice", "password": "synthetic-alice-password", "next": personal_home}).encode()
        status, headers, _ = request("POST", "/auth/login", body=personal_login, content_type="application/x-www-form-urlencoded", origin="https://personal.miguelnogales.com")
        assert status == 303 and headers["Location"] == personal_home
        personal_cookie = headers["Set-Cookie"].split(";", 1)[0]
        assert request("POST", "/auth/logout", personal_cookie, origin="https://personal.miguelnogales.com")[0] == 303
        bob = login("bob", "synthetic-bob-password")
        charlie = login("charlie", "synthetic-charlie-password")
        scale_tester = login("scale_tester", "synthetic-scale-password")
        assert request("POST", "/auth/login", body=urlencode({"username": "alice", "password": "wrong"}).encode(), content_type="application/x-www-form-urlencoded")[0] == 401
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
        assert request("POST", "/auth/logout", alice)[0] == 303
        assert request("GET", "/italian/progress", alice)[0] == 401
        alice = login("alice", "synthetic-alice-password")
        auth.reset_password("alice", "synthetic-alice-new-password")
        assert request("GET", "/italian/progress", alice)[0] == 401
        old = urlencode({"username": "alice", "password": "synthetic-alice-password"}).encode()
        assert request("POST", "/auth/login", body=old, content_type="application/x-www-form-urlencoded")[0] == 401
        assert login("alice", "synthetic-alice-new-password")
        assert request("GET", "//evil.example/scale/", bob)[0] == 404
        print("PASS: shared login, session revocation, app grants, private route denial, legacy health")
    finally:
        server.shutdown()
        worker.join()
