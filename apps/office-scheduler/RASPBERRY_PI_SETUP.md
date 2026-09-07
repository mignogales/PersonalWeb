# Shared Office Scheduler

The website calls `/api/office/*` on its own origin. `src/office.js` forwards
only login, logout, schedule and personal attendance requests to the existing
Pi tunnel at `https://api.miguelnogales.com/office/*`. No new tunnel or port is needed.
The optional Worker variable `OFFICE_SCHEDULER_API_BASE` overrides that origin.
The old browser `config.js` and separate port 8789 backend are no longer used.

## Update the Pi

Copy `raspberry-api/server.py`, `italian.py`, `office.py`, and `backup_italian.py`
to `~/personalweb-api/`, then run `systemctl --user restart personalweb-api`.
Deploy the website with the updated Worker and `/apps/office-scheduler/` assets.
The existing Worker asset configuration runs `/api/*` through the Worker first.

## Private accounts

On the Pi, create each account interactively (password input is hidden):

```sh
cd ~/personalweb-api
python3 office.py "Miguel"
```

Use 10–256 characters for passwords. There is no public registration or demo
account. Office accounts are separate from Italian learning accounts. Every
Office account can see the team's calendar, but can edit only its own attendance.
Existing data from the old `backend_secrets` demo is not imported automatically.

## Persistence and sharing

SQLite database: `~/.local/share/personalweb-office/office.sqlite3`.
Override with `OFFICE_DATA_DIR` when needed. Database files are private to the
service user. The existing daily backup timer now backs up both applications;
Office backups live in the Office data directory's `backups/` folder, retaining
seven daily snapshots. Copy them off the Pi for hardware-loss recovery.

Passwords use scrypt, sessions are stored as hashes and expire after 30 days,
and signing out online revokes the session. Saves are transactional, scoped to
the authenticated account, and send only edited dates. Changes on different
dates merge across devices; if two devices edit the same date, the last saved
choice wins. Repeating a save is safe.

The calendar refreshes every 15 seconds while visible and on focus/reconnection.
Refreshes preserve unsaved selections. Drafts are held in the open tab, with an
unsaved-changes warning before leaving; they are not durable offline storage.
If a session expires with a draft, leave the tab open to review your selections
before signing out and signing in again.

## Verification

```sh
python3 -m unittest discover -s raspberry-api -p 'test_*.py'
node --test tests/office.test.mjs
```

Use Python with OpenSSL/scrypt (available on the Pi). Test with two accounts in
separate browsers: save a date, refresh the other browser, and verify both names
remain after either account updates its own dates.
