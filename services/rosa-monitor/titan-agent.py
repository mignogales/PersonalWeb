#!/usr/bin/env python3
"""One read-only scheduler snapshot, outbound HTTPS upload; no listener."""
import json
from pathlib import Path
import subprocess
import sys
import urllib.request

ROOT = Path(__file__).resolve().parent
DESTINATION = 'https://api.miguelnogales.com/rosa/agent/report'


def main():
    try:
        token = (ROOT / 'upload-token').read_text().strip()
        result = subprocess.run(['ssh', '-oBatchMode=yes', '-oConnectTimeout=8', '-oStrictHostKeyChecking=yes',
                                 '-oIdentitiesOnly=yes', '-oUserKnownHostsFile=' + str(ROOT / 'known_hosts'),
                                 '-i', str(ROOT / 'rosa_ed25519'), 'nogalm@rosa.usi.ch', 'snapshot'],
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=45, check=True)
        if not 0 < len(result.stdout) <= 1_000_000:
            raise ValueError('Invalid snapshot size')
        snapshot = json.loads(result.stdout)
        request = urllib.request.Request(DESTINATION, data=json.dumps(snapshot).encode(), method='POST',
                                         headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json',
                                                  'User-Agent': 'PersonalWeb-RosaMonitor/1'})
        # Refuse redirects so a credential cannot be forwarded elsewhere.
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, *args, **kwargs):
                return None
        with urllib.request.build_opener(NoRedirect).open(request, timeout=20) as response:
            answer = json.loads(response.read(4096))
            if response.status != 200 or answer.get('ok') is not True:
                raise ValueError('Report rejected')
        print('Rosa snapshot delivered: ' + snapshot['observedAt'], flush=True)
        return 0
    except Exception as error:
        # Never log request headers, token, captured SSH output, or job details.
        print('Rosa report failed: ' + type(error).__name__, file=sys.stderr, flush=True)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
