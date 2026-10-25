# Rosa GPU and queue monitor

The private `/personal/rosa` dashboard displays scheduler GPU allocations,
node users/job IDs, partitions, running jobs and pending reasons. It retains
last-known colors during an outage, with explicit historical-data labels.
GPU utilization and VRAM are unavailable from this scheduler interface.

## Data flow

Every five minutes a systemd timer on Titan starts a short CPU-only process:

1. Use a dedicated SSH key to run the fixed read-only Rosa login-node probe.
2. Send its JSON snapshot over HTTPS to `/rosa/agent/report` on the existing Pi API.
3. Exit. There is no new listening port or command interface on Titan.

The browser reads `/api/personal/rosa` through the existing Worker and private
`personal` sign-in grant. The Pi checks that grant independently. **Reload
snapshot** fetches the latest received snapshot; it never triggers collection.
The visible browser checks for new received data once per minute. Reports are
scheduled every five minutes, independently of the browser or this Mac.

## Security boundaries

- The Rosa authorized key has `restrict,command=...` and cannot provide an
  interactive shell, forwarding or arbitrary commands. Host checking stays on;
  the installer pins a Rosa host key obtained through an already trusted SSH connection.
- The upload token is generated on Titan and stored in an owner-only directory
  and file. Only its SHA-256 verifier is stored on the Pi. The token is never
  placed in browser code, a URL, source control or process arguments.
- HTTPS redirects are refused by the agent. The receiver accepts authenticated
  POST reports only, rejects browser-origin requests, and limits request size,
  body-read time, field types/ranges, collection sizes and report age.
- Reports must have increasing observation timestamps; replayed reports are
  rejected. Valid uploads are limited to one per 30 seconds. The normal schedule
  is one every five minutes.
- The credential cannot authenticate the viewer or other apps. A compromised
  upload token could forge displayed monitoring data; it cannot run cluster
  commands or read the other private services. Revoke it by replacing the
  token on Titan and its verifier on the Pi.
- No university password is stored on the website. No compute-node SSH, GPU
  workloads, jobs or Slurm job steps are launched for monitoring.

## Installation and operations

`install-push.py` uses the SSH aliases `titan`, `rosa`, `raspberry`, and `diana`.
It installs only these monitoring files, preserving existing keys and gateway
code. Run it only with authorization for service/key/API changes.

Titan files live in `~/personalweb-rosa/`. The units are:

- `personalweb-rosa-push.service`: one snapshot and outbound upload.
- `personalweb-rosa-push.timer`: `OnCalendar=*:0/5`, persistent across restarts.

User lingering must be enabled for reboot/logout persistence. The installer
performs the normal current-user `loginctl enable-linger` operation, then tests
one actual report before enabling the timer. Read service failures with
`journalctl --user -u personalweb-rosa-push.service`; logs omit credentials,
request headers and job details.

Pi code is `~/personalweb-api/rosa.py`. Its private verifier is under
`~/.config/personalweb-rosa/`; cached data is under
`~/.local/share/personalweb-rosa/`. Reports older than ten minutes are marked
delayed; the last good snapshot is preserved. Gateway changes add the upload
route and a GET-only private summary route. There is no machine-authenticated
viewer endpoint.

After a fresh Titan report is independently verified on the Pi, the installer
disables the former Diana collector and revokes only its exact old monitoring
public keys. It does not change the VPN or unrelated services.

## Validation

```sh
PYTHONPATH=raspberry-api python3 -m unittest raspberry-api/test_rosa.py
node --test tests/rosa.test.mjs
```

Tests cover unauthorized requests, credential separation, methods, replay,
rate limits, stale-cache preservation, malformed/oversized/old snapshots and
GPU-user node matching. Validate the actual installed timer/report path and
signed-in/signed-out viewer after changes; local mocks alone do not establish
successful collection.

## Publishing

Use a verified current production snapshot and `update-stage.mjs` to replace
only the bundled Rosa views/proxy. The helper compares all retained public
asset hashes. Recheck the live Worker before publishing so concurrent website
changes are preserved. A direct dirty-checkout deployment is unsafe here.

`main` has an automatic deployment integration and has previously lacked
manually published production assets. Push a scoped feature branch unless a
separate production/source reconciliation has been completed. Keep credentials,
raw snapshots, private memory records and unrelated local edits out of commits.
