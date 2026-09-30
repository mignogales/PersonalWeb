"""Migrate saved Titan readings and install the collector/API on the Pi.

Usage: python3 raspberry-api/deploy_affluenza.py --csv /path/affluenza.csv
Only run after stopping the old Titan cron. SSH credentials stay in SSH.
"""
import argparse
import base64
import json
from pathlib import Path
import shlex
import subprocess

# Known gateway source inspected before this migration; stable across commits.
GATEWAY_BASE_HASH = '5d237b8adc1cb9c1df45951be5f8f0a1419171a71b9c7a24f93bd8f30cc0c7ef'

REMOTE = r'''
import base64, csv, hashlib, io, json, os, pathlib, subprocess, sys, time
from urllib.request import Request, urlopen
os.umask(0o077)
p = json.load(sys.stdin)
home = pathlib.Path.home()
api = home / 'personalweb-api'
gateway = api / 'sso_gateway.py'
old = gateway.read_bytes()
new = base64.b64decode(p['files']['sso_gateway.py'])
if hashlib.sha256(old).hexdigest() not in (p['gatewayBaseHash'], hashlib.sha256(new).hexdigest()):
    raise SystemExit('Pi gateway has changed. Inspect and integrate it before deployment; no files modified.')
for name in ('affluenza.py', 'sso_gateway.py', 'monitor_affluenza.py'):
    compile(base64.b64decode(p['files'][name]), name, 'exec')
base = home / 'Projects/usi-affluenza-monitor'
base.mkdir(parents=True, exist_ok=True)
(base/'data').mkdir(exist_ok=True)
csv_path = base/'data/affluenza.csv'
incoming = list(csv.DictReader(io.StringIO(base64.b64decode(p['csv']).decode())))
if not incoming:
    raise SystemExit('Migration CSV is empty; refusing to replace history.')
fields = p['fields']
existing = list(csv.DictReader(csv_path.open(newline=''))) if csv_path.exists() else []
merged = {r['checked_at_utc']: r for r in incoming + existing}
stamp = time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())
backup = base/('migration-backup-'+stamp)
backup.mkdir(exist_ok=True)
for name in ('sso_gateway.py', 'affluenza.py'):
    path = api/name
    if path.exists(): (backup/name).write_bytes(path.read_bytes())
if csv_path.exists(): (backup/'affluenza.csv').write_bytes(csv_path.read_bytes())
temp = csv_path.with_suffix('.tmp')
with temp.open('w',newline='') as out:
    writer=csv.DictWriter(out,fieldnames=fields); writer.writeheader()
    writer.writerows(merged[k] for k in sorted(merged))
os.replace(temp,csv_path)
for name in ('affluenza.py','sso_gateway.py'):
    temp = api/(name+'.tmp'); temp.write_bytes(base64.b64decode(p['files'][name])); os.replace(temp,api/name)
(base/'monitor_affluenza.py').write_bytes(base64.b64decode(p['files']['monitor_affluenza.py']))
units=home/'.config/systemd/user'; units.mkdir(parents=True,exist_ok=True)
for name in ('usi-affluenza.service','usi-affluenza.timer'):
    (units/name).write_bytes(base64.b64decode(p['files'][name]))
subprocess.run(['systemctl','--user','daemon-reload'],check=True)
# A real source fetch must succeed before scheduling unattended collection.
try:
    subprocess.run(['systemctl','--user','start','usi-affluenza.service'],check=True)
    subprocess.run(['systemctl','--user','restart','personalweb-api.service'],check=True)
    for attempt in range(25):
        try:
            with urlopen('http://127.0.0.1:8090/health',timeout=2) as r: assert json.load(r)['ok']
            break
        except OSError: time.sleep(.2)
    else: raise RuntimeError('Pi API health did not recover')
    sys.path.insert(0,str(api))
    import shared_auth as auth
    with auth.connect() as db: owner=db.execute("SELECT value FROM settings WHERE key='owner_user_id'").fetchone()
    assert owner, 'Owner is not configured'
    token=auth.issue_session(owner[0])
    cookie=auth.COOKIE+'='+token
    try:
        req=Request('http://127.0.0.1:8090/affluenza/summary',headers={'Cookie':cookie})
        with urlopen(req,timeout=10) as r: summary=json.load(r)
        assert len(summary['daily'])==30 and summary['latest'] and not summary['stale']
        print('Verified signed-in API:',len(summary['readings']),'readings;',summary['daysObserved'],'observed days')
    finally: auth.revoke_session({'Cookie':cookie})
except Exception:
    gateway.write_bytes(old)
    subprocess.run(['systemctl','--user','restart','personalweb-api.service'])
    raise
subprocess.run(['systemctl','--user','enable','--now','usi-affluenza.timer'],check=True)
subprocess.run(['systemctl','--user','is-active','usi-affluenza.timer','personalweb-api.service'],check=True)
subprocess.run(['systemctl','--user','list-timers','usi-affluenza.timer','--no-pager'],check=True)
print('Migration verified. Titan history preserved; Raspberry timer collects every ten minutes.')
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', default='raspberry')
    parser.add_argument('--csv', type=Path, required=True)
    args = parser.parse_args()
    base = Path(__file__).resolve().parent
    import csv
    with args.csv.open(newline='') as source:
        fields = csv.DictReader(source).fieldnames
    payload = {'files': {name: base64.b64encode((base/name).read_bytes()).decode() for name in
                        ('affluenza.py', 'sso_gateway.py', 'monitor_affluenza.py', 'usi-affluenza.service', 'usi-affluenza.timer')},
               'csv': base64.b64encode(args.csv.read_bytes()).decode(), 'fields': fields,
               'gatewayBaseHash': GATEWAY_BASE_HASH}
    subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10',args.host,
                    'python3 -c '+shlex.quote(REMOTE)], input=json.dumps(payload), text=True, check=True)


if __name__ == '__main__':
    main()
