# Office Scheduler Raspberry Pi Setup

Architecture:

```text
Cloudflare Pages/custom domain
  -> static app at /apps/office-scheduler/
  -> reads /apps/office-scheduler/config.json
  -> config points to a Cloudflare Tunnel hostname
  -> tunnel forwards to Raspberry Pi localhost:8789
  -> Python API stores users and calendar JSON locally
```

## 1. Copy the backend to the Raspberry Pi

From your laptop, copy the ignored backend folder to the Pi:

```bash
scp -r backend_secrets/office_scheduler pi@RASPBERRY_PI_IP:/home/pi/office_scheduler
```

On the Pi:

```bash
cd /home/pi/office_scheduler
python3 --version
python3 server.py
```

The API should print:

```text
Office Scheduler API listening on http://0.0.0.0:8789
Dummy login: demo / office123
```

In another Pi terminal:

```bash
curl http://127.0.0.1:8789/health
```

Expected:

```json
{"ok": true, "app": "office-scheduler"}
```

## 2. Add real users

Still on the Pi:

```bash
cd /home/pi/office_scheduler
python3 manage_users.py add "Miguel" "choose-a-password"
python3 manage_users.py list
```

The demo user remains available until you remove it:

```bash
python3 manage_users.py remove "demo"
```

## 3. Run it as a service

Copy the service file:

```bash
sudo cp /home/pi/office_scheduler/systemd/office-scheduler.service.example /etc/systemd/system/office-scheduler.service
sudo systemctl daemon-reload
sudo systemctl enable --now office-scheduler
sudo systemctl status office-scheduler
```

Check logs:

```bash
journalctl -u office-scheduler -f
```

## 4. Install and authenticate cloudflared

Install `cloudflared` for your Raspberry Pi OS/architecture from Cloudflare's
official package instructions or dashboard connector setup.

Then authenticate:

```bash
cloudflared tunnel login
```

Create a tunnel:

```bash
cloudflared tunnel create office-scheduler
```

Create `/home/pi/.cloudflared/config.yml`:

```yaml
tunnel: office-scheduler
credentials-file: /home/pi/.cloudflared/TUNNEL_ID.json

ingress:
  - hostname: office-api.your-domain.com
    service: http://127.0.0.1:8789
  - service: http_status:404
```

Replace `TUNNEL_ID` with the JSON filename created by `cloudflared tunnel create`.

Route the hostname:

```bash
cloudflared tunnel route dns office-scheduler office-api.your-domain.com
```

Run once to test:

```bash
cloudflared tunnel run office-scheduler
```

From your laptop:

```bash
curl https://office-api.your-domain.com/health
```

## 5. Run cloudflared as a service

On the Pi:

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared
```

## 6. Configure Cloudflare Pages/Workers

Set this environment variable for the site:

```text
OFFICE_SCHEDULER_API_BASE=https://office-api.your-domain.com
```

Redeploy the site.

The static app reads the value from:

```text
/apps/office-scheduler/config.json
```

The repo has both deployment shapes prepared:

- `src/worker.js` for Wrangler Workers with static assets.
- `functions/apps/office-scheduler/config.json.js` for Cloudflare Pages Functions.

## 7. Final test

Open:

```text
https://your-domain.com/apps/office-scheduler/
```

Login:

```text
demo / office123
```

Then replace the demo user with real users.
