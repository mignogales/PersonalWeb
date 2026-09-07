#!/usr/bin/env python3
"""Prompt privately for the Cloudflare token and start a user service."""
import getpass
import os
from pathlib import Path
import subprocess

home = Path.home()
folder = home / '.cloudflared'
folder.mkdir(mode=0o700, exist_ok=True)
token = getpass.getpass('Cloudflare tunnel token (hidden): ').strip()
if not token or any(c.isspace() for c in token):
    raise SystemExit('Paste only the token, not the install command.')
path = folder / 'personalweb-token'
fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
with os.fdopen(fd, 'w') as stream:
    os.fchmod(stream.fileno(), 0o600)
    stream.write(token + '\n')
del token
units = home / '.config/systemd/user'
units.mkdir(parents=True, exist_ok=True)
(units / 'personalweb-tunnel.service').write_text('''[Unit]
Description=Personal website Cloudflare Tunnel
After=network.target

[Service]
ExecStart=/usr/local/bin/cloudflared tunnel --no-autoupdate run --token-file %h/.cloudflared/personalweb-token
Restart=on-failure
RestartSec=5
NoNewPrivileges=yes

[Install]
WantedBy=default.target
''')
subprocess.run(['systemctl', '--user', 'daemon-reload'], check=True)
subprocess.run(['systemctl', '--user', 'enable', 'personalweb-tunnel'], check=True)
subprocess.run(['systemctl', '--user', 'restart', 'personalweb-tunnel'], check=True)
print('Token saved privately; tunnel service started. Check Cloudflare for Healthy status.')
