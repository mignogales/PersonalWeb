"""Production owner adapter smoke test; prints statuses only, never user data."""
import http.client
import json
import threading

import shared_auth as auth
from sso_gateway import Gateway, ThreadingHTTPServer

with auth.connect() as db:
    owner = db.execute("SELECT id FROM users WHERE username_key='miguel'").fetchone()
assert owner, "Owner must be bootstrapped"
token = auth.issue_session(owner["id"])
cookie = f"{auth.COOKIE}={token}"
server = ThreadingHTTPServer(("127.0.0.1", 0), Gateway)
worker = threading.Thread(target=server.serve_forever, daemon=True)
worker.start()
port = server.server_address[1]


def request(method, path, signed=True):
    conn = http.client.HTTPConnection("127.0.0.1", port, timeout=15)
    headers = {"Host": "api.miguelnogales.com", "Origin": "https://api.miguelnogales.com", "Content-Type": "application/json"}
    if signed:
        headers["Cookie"] = cookie
    conn.request(method, path, body=b"{}" if method == "POST" else None, headers=headers)
    response = conn.getresponse()
    status = response.status
    payload = response.read()
    conn.close()
    return status, payload


try:
    assert request("GET", "/auth/session")[0] == 200
    assert request("GET", "/scale/")[0] == 200
    status, payload = request("GET", "/calories/api/me")
    assert status == 200 and json.loads(payload)["user"]["username"] == "miguel"
    assert request("GET", "/italian/auth/me")[0] == 200
    assert request("POST", "/office/login")[0] == 200
    assert request("GET", "/nightwatch/api/state")[0] == 200
    print("PASS: owner can reach Scale, Calories, Italian, Office, and Nightwatch through one session")
finally:
    auth.revoke_session({"Cookie": cookie})
    assert request("GET", "/scale/")[0] == 401
    server.shutdown()
    worker.join()
