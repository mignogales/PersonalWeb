#!/usr/bin/env python3
"""Small, dependency-free probe for the Raspberry Pi Cloudflare Tunnel."""
import json
import os
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit
from italian import handle, APIError

STARTED = time.monotonic()


class Handler(BaseHTTPRequestHandler):
    server_version = "PersonalWebHealth/1.0"
    sys_version = ""

    def do_POST(self):
        self.api()

    def do_PUT(self):
        self.api()

    def api(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 <= length <= 4_000_000:
                raise APIError(413, "Request too large")
            if self.command in ("POST", "PUT") and not self.headers.get("Content-Type", "").startswith("application/json"):
                raise APIError(415, "Use application/json")
            body = json.loads(self.rfile.read(length) or b"{}")
            if not isinstance(body, dict):
                raise APIError(400, "Invalid JSON object")
            status, payload = handle(self.command, urlsplit(self.path).path, self.headers, body)
        except APIError as error:
            status, payload = error.status, {"error": error.message}
        except (ValueError, UnicodeDecodeError):
            status, payload = 400, {"error": "Invalid request"}
        except Exception:
            import traceback
            traceback.print_exc()
            status, payload = 500, {"error": "Server error"}
        self.send_json(status, payload)

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if urlsplit(self.path).path.startswith("/italian/"):
            return self.api()
        healthy = urlsplit(self.path).path == "/health"
        payload = {
            "ok": True,
            "service": "personalweb-pi",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "uptime_seconds": int(time.monotonic() - STARTED),
        } if healthy else {"ok": False, "error": "not_found"}
        self.send_json(200 if healthy else 404, payload)


if __name__ == "__main__":
    # cloudflared runs on this same machine; no LAN/public listener needed.
    port = int(os.environ.get("PORT", "8090"))
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Health API listening on http://127.0.0.1:{port}/health", flush=True)
    server.serve_forever()
