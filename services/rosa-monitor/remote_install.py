#!/usr/bin/env python3
"""Install only the private collector, forced-command keys and Pi API route."""
import json
from pathlib import Path
import shlex
import subprocess

ROOT = Path(__file__).resolve().parents[2]


def ssh(host, command, data=None):
    return subprocess.run(['ssh', '-oBatchMode=yes', '-oConnectTimeout=10', host, command],
                          input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                          check=True, timeout=60).stdout


def remote(host, source, payload=None):
    return ssh(host, 'python3 -c ' + shlex.quote(source), json.dumps(payload).encode() if payload is not None else None)


def put(host, path, source, mode=0o600):
    remote(host, '''import json,os,sys
from pathlib import Path
p=json.load(sys.stdin); dest=Path(p['path']).expanduser();dest.parent.mkdir(parents=True,exist_ok=True)
tmp=dest.with_suffix('.install-tmp');tmp.write_text(p['source']);tmp.chmod(p['mode']);os.replace(str(tmp),str(dest))''', dict(path=path, source=source, mode=mode))


def key(host, path):
    return remote(host, '''import json,subprocess,sys
from pathlib import Path
p=Path(json.load(sys.stdin)['path']).expanduser();p.parent.mkdir(parents=True,exist_ok=True);p.parent.chmod(0o700)
if not p.exists(): subprocess.check_call(['ssh-keygen','-q','-t','ed25519','-N','','-f',str(p)],stdout=subprocess.DEVNULL)
print(p.with_suffix('.pub').read_text().strip())''', dict(path=path)).decode().strip()


def authorize(host, public_key, forced):
    remote(host, '''import json,sys
from pathlib import Path
p=json.load(sys.stdin); d=Path.home()/'.ssh';d.mkdir(mode=0o700,exist_ok=True);f=d/'authorized_keys';old=f.read_text() if f.exists() else ''
if p['key'].split()[1] not in old:
 if f.exists() and not (d/'authorized_keys.before-rosa-monitor-20261025').exists(): (d/'authorized_keys.before-rosa-monitor-20261025').write_text(old)
 f.write_text(old.rstrip()+'\\nrestrict,command="'+p['forced']+'" '+p['key']+'\\n');f.chmod(0o600)''', dict(key=public_key, forced=forced))
