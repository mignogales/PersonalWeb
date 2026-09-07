#!/bin/sh
# Run on the Raspberry Pi: sudo sh install.sh
set -eu
if [ "$(id -u)" -ne 0 ]; then
  echo 'Run this installer with sudo: sudo sh install.sh' >&2
  exit 1
fi
command -v python3 >/dev/null
command -v systemctl >/dev/null
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
install -d -m 755 /opt/personalweb-api
install -m 644 "$script_dir/server.py" /opt/personalweb-api/server.py
install -m 644 "$script_dir/italian.py" /opt/personalweb-api/italian.py
install -m 644 "$script_dir/personalweb-api.service" /etc/systemd/system/personalweb-api.service
systemctl daemon-reload
systemctl enable personalweb-api
systemctl restart personalweb-api
systemctl --no-pager status personalweb-api
