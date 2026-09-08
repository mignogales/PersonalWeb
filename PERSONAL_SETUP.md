# Personal area

The private entrance is `/personal/`; the first tool lives at `/personal/dashboard`.
There is no link to it on the public portfolio. The old `/apps/dashboard/` address
requires sign-in and redirects to the private dashboard. The status APIs at
`/api/personal/status` and the old `/api/dashboard/status` both require a session.

## Configure before deployment

Set these two independent **Secrets** on the existing `mainpersonalweb` Worker
in Cloudflare → Workers & Pages → Settings → Variables and Secrets:

- `PERSONAL_PASSWORD`: unique random password, 20–256 characters. Store in your password manager.
- `PERSONAL_SESSION_SECRET`: independent random signing key, at least 32 characters.

Do not paste either secret into source code, chat, a URL, or a public variable.
Missing or placeholder secrets leave the area locked. Existing Chat Lab and
Italian/Office logins retain their separate access rules.

`wrangler.jsonc` declares `PERSONAL_LOGIN_LIMITER`: five login attempts per minute
per IP. Publish with this configuration; a missing or unavailable binding blocks
sign-in. Cloudflare's limiter is per location and eventually consistent, rather
than a global exact quota. See [Cloudflare rate limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

Use the existing Worker deployment flow, not a static hosting upload. Private
HTML and scripts live in `src/personal-views.js`, bundled inside the Worker;
`src/**` is excluded from public assets. There is no public dashboard HTML copy.
Keep the declared Worker-first route patterns and `.assetsignore` exclusions.
[Cloudflare authentication routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/).

## Local development and verification

Set development-only secrets in ignored `.dev.vars`, using `.dev.vars.example`
as the template, and run `wrangler dev`. Open `/personal/` on its localhost URL.
No real password is checked into this project; tests use synthetic credentials.

Run `node --test tests/personal.test.mjs`, `node tests/dashboard.test.mjs`,
`node tests/italian-proxy.test.mjs`, and `node --test tests/chat.test.mjs`.

## Sessions and future tools

A successful login issues an origin-bound signed session, valid for eight hours,
in an HttpOnly, SameSite=Strict cookie. HTTPS uses a Secure `__Host-` cookie; only
localhost permits a separate development cookie over HTTP. Login and logout
POSTs require a matching Origin. Private responses forbid caching and framing.

Sign out clears this browser's cookie. Stateless sessions do not have per-token
server revocation: an already copied token remains valid until expiry. Rotate
`PERSONAL_SESSION_SECRET` or `PERSONAL_PASSWORD` to invalidate all sessions.
Previously viewed/downloaded content cannot be retracted by signing out.

Add future pages to `handlePersonal` after its shared `signedIn` gate and link
them from the personal navigation. Put private APIs under `/api/personal/`.
Keep private content in Worker modules under `src/`; never add private HTML,
exports, backups or credentials to the public assets directory. Existing useful
links still lead to their original apps and their original access controls.


## Calorie tracker

The tracker frontend is served at `/calories/`, linked from the homepage and
personal dashboard. Deploy the Worker together with the static assets: the
`/calories/api/*` route proxies to the existing Raspberry Pi gateway at
`https://api.miguelnogales.com/calories/api/*`. An optional
`CALORIE_TRACKER_API_BASE` overrides the upstream origin (no path suffix).

Accounts, meals, voice processing, and backups remain on the Pi. The app keeps
its own account login; users must sign in again when switching domains because
browser sessions are stored per origin. No database, model, or secret is copied
into this website. Keep `/calories/api/*` in `assets.run_worker_first`.

Frontend source was copied from the CalorieTracking project on 7 September 2026.
When updating it, copy `index.html`, `app.js`, and `styles.css` from that project's
`frontend/`, preserving this site's `calories/config.js`. The original Pi URL
continues working. Run `node --test tests/calories.test.mjs` to test the proxy.


## Usage Hub panel

The private dashboard now reads the Usage Hub summary through the Worker. Set the Worker secret `USAGE_HUB_TOKEN` to a device bearer token for Miguel's Usage Hub account. Never put it in browser JavaScript, a public configuration file, or source control. The upstream address is fixed to `https://usage.miguelnogales.com`; redirects are refused.

The existing personal session protects the status endpoint. The response contains only selected usage, account, model and device-count fields. Missing setup and upstream errors are explicit states, not zero usage. Existing tokens have device privileges; a dedicated read-only integration credential is preferable if one is added later. Rotating or revoking the configured device token also requires replacing the Worker secret.

Validation: run `node tests/usage-dashboard.test.mjs`, `node tests/dashboard.test.mjs`, and `node tests/personal.test.mjs`.
