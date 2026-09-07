# Raspberry Pi API

The Pi runs both Italian progress sync and the private shared Office Scheduler.
See [Office Scheduler setup](../apps/office-scheduler/RASPBERRY_PI_SETUP.md) for accounts, storage, and backups.


The Pi now also runs authenticated Italian progress sync on the same port. See
[Italian sync operations](ITALIAN_SYNC.md) for the current production setup.
The instructions below describe the initial health-check installation.

A separate backend probe for the existing Cloudflare-hosted frontend. Uses only
Python 3's standard library. No dependencies, credentials, or database needed.
Only `GET /health` is provided; other paths return JSON with HTTP 404.
This is a small connectivity probe, not a general production application server.

## 1. Copy and install on the Pi

From this repository on your laptop, replace `USER@PI_HOST` with your SSH address:

```sh
scp -r raspberry-api USER@PI_HOST:~/personalweb-api
ssh USER@PI_HOST
cd ~/personalweb-api
sudo sh install.sh
curl --fail http://127.0.0.1:8090/health
```

Requires Raspberry Pi OS (or another Linux with Python 3 and systemd).
The installer installs files under `/opt/personalweb-api` and enables a restricted
systemd service that starts at boot. Running the installer again updates it.
The API binds to loopback; install cloudflared directly on the same Pi.

Expected response (timestamp and uptime vary):

```json
{"ok": true, "service": "personalweb-pi", "timestamp": "2026-09-07T12:00:00+00:00", "uptime_seconds": 10}
```

## 2. Create the Cloudflare Tunnel

You need your own domain active in Cloudflare DNS for a stable public hostname.
A `pages.dev` or `workers.dev` address alone cannot be used as this tunnel hostname.

1. In Cloudflare, open **Networking → Tunnels → Create Tunnel**. Some accounts
   show tunnels in **Zero Trust → Networks → Connectors**.
2. Name the tunnel `personalweb-pi`.
3. Select Linux and the Pi OS architecture (`uname -m`: `aarch64` means ARM64;
   `armv7l` means 32-bit ARM).
4. Run Cloudflare's displayed install-and-run commands on the Pi. Choose a
   native service installation, not Docker, for this loopback configuration.
   Keep the tunnel token private; do not commit it or paste it into chat.
5. Wait for the connector to become **Healthy**.
6. Add a **Published application** route:
   - Hostname: `api.YOUR_DOMAIN`
   - Service type: `HTTP`
   - Service URL: `127.0.0.1:8090` (or `http://127.0.0.1:8090` if a single URL field)
7. Save. Cloudflare creates the DNS route. No router port forwarding is needed.

Official guide: https://developers.cloudflare.com/tunnel/setup/

## 3. Verify from outside your home network

From your laptop or a phone on mobile data:

```sh
curl --fail https://api.YOUR_DOMAIN/health
```

Or open that address in a browser. It should show `ok: true` and
`service: personalweb-pi`. Reload and check that the timestamp changes.
The response uses `Cache-Control: no-store`; do not add a Cloudflare cache rule
that overrides this for the API hostname.

This probe is deliberately public and exposes no secrets or machine details.
Future private dashboards should get separate hostnames protected with
Cloudflare Access. Future application APIs need their own authentication.
The frontend has not been changed: this first step tests the backend directly.
Cross-origin JavaScript integration will need explicit CORS or a Worker proxy.

## Troubleshooting

```sh
sudo systemctl status personalweb-api --no-pager
sudo journalctl -u personalweb-api -n 50 --no-pager
sudo systemctl status cloudflared --no-pager
curl --fail http://127.0.0.1:8090/health
```

- Local curl fails: check the API service and whether port 8090 is already used.
- Local works, public fails: check the tunnel is Healthy and the route uses HTTP
  with port 8090. cloudflared must run on the Pi host to reach its loopback API.
- JSON 404 at `/`: expected; use `/health`.
- Pi is offline: backend requests fail, while the frontend stays hosted on Cloudflare.

## Local development

```sh
python3 raspberry-api/server.py
# In another terminal:
curl --fail http://127.0.0.1:8090/health
```

Override the local port with `PORT=8091 python3 raspberry-api/server.py` if needed.
