#!/usr/bin/env python3
"""Install the approved Titan→Pi five-minute snapshot path, without a listener."""
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('monitor_install', Path(__file__).with_name('remote_install.py'))
ops = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ops)


def main():
    # All private keys and the upload token are generated on Titan and stay there.
    ops.ssh('titan', 'if [ "$(loginctl show-user mnogales -p Linger --value)" != yes ]; then loginctl enable-linger mnogales; fi')
    public_key = ops.key('titan', '~/personalweb-rosa/rosa_ed25519')
    ops.put('rosa', '~/.local/share/personalweb-rosa/probe.py', (ROOT/'services/rosa-monitor/probe.py').read_text())
    ops.authorize('rosa', public_key, '/usr/bin/python3 /home/nogalm/.local/share/personalweb-rosa/probe.py')
    host_key = ops.ssh('rosa', 'cat /etc/ssh/ssh_host_ed25519_key.pub').decode().strip()
    ops.put('titan', '~/personalweb-rosa/known_hosts', 'rosa.usi.ch '+host_key+'\n')
    digest = ops.remote('titan', '''import hashlib,secrets
from pathlib import Path
p=Path.home()/'personalweb-rosa/upload-token'
if not p.exists(): p.write_text(secrets.token_urlsafe(48)+'\\n')
p.chmod(0o600)
print(hashlib.sha256(p.read_text().strip().encode()).hexdigest())''').decode().strip()
    assert len(digest) == 64 and all(c in '0123456789abcdef' for c in digest)
    ops.put('raspberry', '~/.config/personalweb-rosa/titan-token.sha256', digest+'\n')
    previous_module = ops.ssh('raspberry', 'cat ~/personalweb-api/rosa.py').decode()
    if 'def receive(handler)' not in previous_module:
        ops.put('raspberry', '~/personalweb-api/rosa.before-titan-20261025.py', previous_module)
    ops.put('raspberry', '~/personalweb-api/rosa.py', (ROOT/'raspberry-api/rosa.py').read_text())
    gateway = ops.ssh('raspberry', 'cat ~/personalweb-api/sso_gateway.py').decode()
    updated = gateway
    if 'if path == "/rosa/agent/report":' not in updated:
        marker = '        if path == "/rosa/summary":'
        assert updated.count(marker) == 1
        updated = updated.replace(marker, '        if path == "/rosa/agent/report":\n            from rosa import receive as rosa_receive\n            return rosa_receive(self)\n'+marker)
    old = '''            if self.command not in ("GET", "POST"):
                return self.send_json(405, {"error": "Method not allowed"})
            from rosa import summary as rosa_summary
            return self.send_json(200, rosa_summary(self.command == "POST"))'''
    new = '''            if self.command != "GET":
                return self.send_json(405, {"error": "Method not allowed"})
            from rosa import summary as rosa_summary
            return self.send_json(200, rosa_summary())'''
    if old in updated:
        assert updated.count(old) == 1
        updated = updated.replace(old, new)
    assert 'rosa_summary()' in updated and 'rosa_summary(self.command' not in updated
    if gateway != updated:
        ops.put('raspberry', '~/personalweb-api/sso_gateway.before-titan-20261025.py', gateway)
        ops.put('raspberry', '~/personalweb-api/sso_gateway.py', updated)
    print(ops.ssh('raspberry', 'python3 -m py_compile ~/personalweb-api/rosa.py ~/personalweb-api/sso_gateway.py && systemctl --user restart personalweb-api && systemctl --user is-active personalweb-api').decode().strip())
    for name in ('titan-agent.py', 'personalweb-rosa-push.service', 'personalweb-rosa-push.timer'):
        destination = '~/personalweb-rosa/'+name if name.endswith('.py') else '~/.config/systemd/user/'+name
        ops.put('titan', destination, (ROOT/'services/rosa-monitor'/name).read_text())
    print(ops.ssh('titan', 'systemctl --user daemon-reload && systemctl --user start personalweb-rosa-push.service && systemctl --user enable --now personalweb-rosa-push.timer && systemctl --user show personalweb-rosa-push.service -p Result -p ExecMainStatus && systemctl --user list-timers personalweb-rosa-push.timer --no-pager && loginctl show-user mnogales -p Linger').decode().strip())
    receipt = ops.ssh('raspberry', 'cd ~/personalweb-api && python3 -c "import json,rosa; s=rosa.summary(); print(json.dumps(dict(state=s.get(\'state\'),collector=s.get(\'collectorHost\'),observedAt=(s.get(\'snapshot\') or {}).get(\'observedAt\'))))"').decode()
    state = json.loads(receipt)
    assert state['state'] == 'ready' and state['collector'] == 'Titan', receipt
    print(receipt.strip())
    # Retire the old poller only after the new report is independently visible.
    ops.ssh('diana', 'systemctl --user disable --now personalweb-rosa.service')
    retired = ops.ssh('diana', 'systemctl --user show personalweb-rosa.service -p ActiveState -p UnitFileState').decode()
    assert 'ActiveState=inactive' in retired and 'UnitFileState=disabled' in retired, retired
    print(retired.strip())
    # Revoke only the exact old monitoring public keys; preserve every other key.
    for source_host, public_path, target_host in (
        ('diana', '~/personalweb-rosa/rosa_ed25519.pub', 'rosa'),
        ('raspberry', '~/.config/personalweb-rosa/diana_ed25519.pub', 'diana')):
        blob = ops.ssh(source_host, 'cat '+public_path).decode().split()[1]
        ops.remote(target_host, '''import json
from pathlib import Path
blob=json.load(__import__('sys').stdin)
p=Path.home()/'.ssh/authorized_keys';before=p.read_text();after=''.join(line for line in before.splitlines(keepends=True) if blob not in line.split())
if after!=before:
 backup=p.with_name('authorized_keys.before-titan-retirement-20261025')
 if not backup.exists(): backup.write_text(before);backup.chmod(0o600)
 p.write_text(after);p.chmod(0o600)''', blob)
    print('Titan five-minute push path verified; old Diana poller disabled and its monitoring authorizations revoked.')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # SSH stderr contains diagnostics but never command stdin/token material.
        detail = getattr(error, 'stderr', b'')
        if detail:
            print(detail.decode(errors='replace')[-2000:])
        raise
