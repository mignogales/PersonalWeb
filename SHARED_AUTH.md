# Shared sign-in for the personal apps

The website uses one sign-in at `https://api.miguelnogales.com/auth/login`. The
launch page at `https://api.miguelnogales.com/auth/` lists only apps granted to
the signed-in account. The first owner account is `miguel` and initially uses
the existing Calories password. The password itself was never copied or read;
only its existing salted verifier was linked.

The session is stored in a Secure, HttpOnly, SameSite=Lax cookie scoped to
`miguelnogales.com`. The Worker sends that cookie to the Pi gateway when an app
needs data. The Pi checks the session and app grant on every request. It maps
the account to each app's own data ID. Old browser tokens are ignored.

## App data rules

| App | Account data rule |
| --- | --- |
| Calories | Meals, goals, and weight logs stay under each Calories user ID. |
| Italian | Progress is stored under each user's Italian account ID. |
| Office | Each user edits only their own attendance. The team calendar intentionally shows everyone's planned days. |
| Scale | Owner only. The scale CSV has no person ID, so all readings belong to one private stream. |
| Nightwatch and Personal | Owner only; these apps have global private data. |
| Chat Lab | No server conversation history. The chat grant controls access to the Gemini API; current messages live in the browser tab. |

Scale, Nightwatch, and Personal grants are reserved for the owner in code. New
accounts receive only the app grants specified when created. An old tab sends
the account it expects; the gateway rejects requests if the browser switched
to another account.

## Admin commands on the Pi

Run through `ssh -t raspberry` so passwords are entered privately at the Pi
prompt. Do not put passwords on the command line.

```sh
python3 ~/personalweb-api/shared_auth.py add-user alice --app italian --app calories
python3 ~/personalweb-api/shared_auth.py grant alice office
python3 ~/personalweb-api/shared_auth.py reset-password alice
```

The database is `~/.local/share/personalweb-auth/auth.sqlite3` on the Pi with
owner-only file permissions. New passwords must have 12–256 characters. Resetting
a shared password revokes that user's existing sessions. The direct loopback
Calories backend has its own older password verifier; the public website uses
the shared password.

## Deployment and rollback

The Pi gateway runs `~/personalweb-api/sso_gateway.py` through the
`personalweb-api.service` `sso.conf` drop-in. The Cloudflare Worker and its
static assets come from this PersonalWeb checkout. Deploy the Worker and Pi
gateway together, then verify public `health`, a signed-in app, an unauthenticated
Scale 401, and a non-owner Scale 403. The Nightwatch Bearer API remains available
for existing CLI workers.

To roll back the Pi gateway, remove only the `sso.conf` drop-in, reload the user
systemd manager, and restart `personalweb-api.service`. Restore the prior Worker
revision in Cloudflare. Keep the shared-auth database intact so account mappings
are available if the migration is retried.
