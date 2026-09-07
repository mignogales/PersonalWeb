# Italian progress sync

## Deployment

The backend runs on a Raspberry Pi with Python 3 and systemd.
The `personalweb-api` user service serves `/health` and `/italian/*` on
`127.0.0.1:8090`. The existing tunnel publishes `api.miguelnogales.com`.
No extra port, tunnel, or DNS record is needed.

The frontend uses `/api/italian/*` on its own origin. `src/italian.js` proxies only
the authentication/progress routes to the Pi. Optional Worker variable
`ITALIAN_API_BASE` overrides `https://api.miguelnogales.com`.
Wrangler must bind assets as `ASSETS` and run the Worker before `/api/italian/*`.
The frontend files are built into `italian/` and published via GitHub deployment.

## First use

1. Open `/italian/` and choose **New here? Create account**.
2. Use your previous local profile name to import this browser's existing progress.
3. Choose a password of at least 10 characters and save it in your password manager.
4. Sign in with that same account on another device.

Local profiles are not automatically published or claimed. Create an account
first. Names on the login page come only from that browser. The old Node backend
is not used by this setup. Email verification and self-service password reset
are not included.

## Sync behavior

- Each answer is saved locally before a network request.
- Sync retries every 15 seconds while visible, and on focus/reconnection.
- Offline practice continues for a previously signed-in account.
- Password hashes use scrypt; random bearer sessions expire after 30 days.
- Online sign-out revokes the session; offline sign-out removes it locally only.
- SQLite transactions and revision checks protect against concurrent overwrites.
- A persisted outbox and server mutation IDs make interrupted writes retryable.
- Local counters since the last sync are added to the latest server counters.
  Review scheduling metadata uses the latest practice timestamp.
- Initial legacy import takes maximum counters per form, as old data lacks
  unique identities for all historical answers. New activity merges as deltas.
- Recent attempt history is deduplicated and capped at 1,000 entries.
- API responses bypass the service-worker cache and use `Cache-Control: no-store`.

## Pi operations

```sh
ssh USER@PI_HOST
systemctl --user status personalweb-api
systemctl --user status personalweb-italian-backup.timer
curl --fail http://127.0.0.1:8090/health
```

Database: `~/.local/share/personalweb-italian/progress.sqlite3`.
Daily backups: `~/.local/share/personalweb-italian/backups/` (last seven days saved).
These are on the same Pi; copy backups off-device for hardware-loss recovery.
Database files contain account hashes and private progress; keep them private.

Previous health script: `~/personalweb-api/backups/server-health-only.py`.
For updates, copy `server.py`, `italian.py`, and `backup_italian.py` to
`~/personalweb-api/`, then `systemctl --user restart personalweb-api`.
Never replace the data directory during a code update.

## Verification and build

```sh
python3 -m unittest discover -s raspberry-api -p 'test_*.py'
node Italian_submodule/tests/sync.test.mjs
cd Italian_submodule
node node_modules/typescript/bin/tsc -b
VITE_BASE_PATH=/italian/ node node_modules/vite/bin/vite.js build
```

Use a Python build with OpenSSL/scrypt, as supplied on the Pi.
Copy the generated `dist/` files into the repository's `italian/` directory.
Keep older hashed assets for already-open browser tabs.
