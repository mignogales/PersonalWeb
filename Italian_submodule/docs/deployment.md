# Deploying Italian Verb Sprint

This project is now split into:

- A static Vite/React frontend that can be served by Cloudflare Pages.
- A small Node backend for user and progress storage, intended to run on your Raspberry Pi behind Cloudflare Tunnel.

The app still works without the backend by falling back to browser `localStorage`.

## 1. Raspberry Pi backend

The Pi only needs the backend server file and an environment file. It does not need the React source, `node_modules`, `dist`, or the top-level static `italian/` folder.

Copy these files to the Pi:

```text
/home/pi/italian-verb-sprint/
  server.mjs
  .env
```

Install Node.js 20 or newer on the Pi. There are no npm dependencies for the backend.

Create an environment file on the Pi:

```sh
nano /home/pi/italian-verb-sprint/.env
```

Use your real frontend origins:

```sh
PORT=8787
DATA_DIR=/home/pi/italian-verb-sprint-data
API_ALLOWED_ORIGINS=https://your-site.pages.dev,https://your-domain.com
```

Start the API:

```sh
set -a
. /home/pi/italian-verb-sprint/.env
set +a
node /home/pi/italian-verb-sprint/server.mjs
```

Check it locally on the Pi:

```sh
curl -s http://127.0.0.1:8787/health
```

Expected response:

```json
{"ok":true}
```

## 2. Keep the backend running with systemd

Create `/etc/systemd/system/italian-verb-sprint.service`:

```ini
[Unit]
Description=Italian Verb Sprint API
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/pi/italian-verb-sprint
EnvironmentFile=/home/pi/italian-verb-sprint/.env
ExecStart=/usr/bin/node /home/pi/italian-verb-sprint/server.mjs
Restart=always
RestartSec=5
User=pi

[Install]
WantedBy=multi-user.target
```

Enable it:

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now italian-verb-sprint
sudo systemctl status italian-verb-sprint
```

## 3. Expose the API through Cloudflare Tunnel

On the Pi:

```sh
cloudflared tunnel login
cloudflared tunnel create italian-verb-sprint
cloudflared tunnel route dns italian-verb-sprint italian-api.your-domain.com
```

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: italian-verb-sprint
credentials-file: /home/pi/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: italian-api.your-domain.com
    service: http://127.0.0.1:8787
  - service: http_status:404
```

Run it:

```sh
cloudflared tunnel run italian-verb-sprint
```

Then install it as a service:

```sh
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

For real access control, put the API hostname behind Cloudflare Access and allow only your account. The optional `ITALIAN_SPRINT_API_TOKEN` is useful as a light guard, but any `VITE_API_TOKEN` value is visible in the static frontend.

## 4. Build for Cloudflare Pages

Create `.env.production` locally:

```sh
VITE_BASE_PATH=/italian/
VITE_API_BASE_URL=https://italian-api.your-domain.com
```

Use `/` instead of `/italian/` if this app gets its own Pages project.

Build:

```sh
pnpm install
pnpm build
```

The static output is `dist/`.

## 5. Add it to your personal web

Option A, standalone Pages project:

- Cloudflare Pages build command: `pnpm build`
- Build output directory: `dist`
- Environment variables:
  - `VITE_BASE_PATH=/`
  - `VITE_API_BASE_URL=https://italian-api.your-domain.com`

Option B, inside an existing static personal site:

1. Set `VITE_BASE_PATH=/italian/`.
2. Run `pnpm build`.
3. Copy the contents of `dist/` into the existing site at its `italian/` folder.
4. Deploy the personal site normally through Cloudflare Pages.

Then visit:

```text
https://your-domain.com/italian/
```

## 6. Backup

The backend stores data as JSON under `DATA_DIR`.

Back up this folder from the Pi:

```sh
tar -czf italian-verb-sprint-data.tgz /home/pi/italian-verb-sprint-data
```
