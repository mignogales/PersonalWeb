#!/usr/bin/env python3
"""Keep seven daily SQLite backups in the private API data directory."""
import sqlite3
from datetime import datetime, timezone
from italian import DATA

source = DATA / 'progress.sqlite3'
if source.exists():
    folder = DATA / 'backups'
    folder.mkdir(mode=0o700, exist_ok=True)
    target = folder / ('italian-' + datetime.now(timezone.utc).strftime('%Y-%m-%d') + '.sqlite3')
    with sqlite3.connect(source) as db, sqlite3.connect(target) as backup:
        db.backup(backup)
    target.chmod(0o600)
    for old in sorted(folder.glob('italian-????-??-??.sqlite3'))[:-7]:
        old.unlink()
    print('Italian database backup complete')

# The existing daily timer also protects the Office Scheduler database.
from office import DATA as OFFICE_DATA
source = OFFICE_DATA / 'office.sqlite3'
if source.exists():
    folder = OFFICE_DATA / 'backups'
    folder.mkdir(mode=0o700, exist_ok=True)
    target = folder / ('office-' + datetime.now(timezone.utc).strftime('%Y-%m-%d') + '.sqlite3')
    with sqlite3.connect(source) as db, sqlite3.connect(target) as backup:
        db.backup(backup)
    target.chmod(0o600)
    for old in sorted(folder.glob('office-????-??-??.sqlite3'))[:-7]:
        old.unlink()
    print('Office database backup complete')
