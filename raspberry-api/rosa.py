"""Private cached Rosa viewer and narrowly scoped outbound-agent ingestion."""
import datetime
import hashlib
import hmac
import json
from pathlib import Path
import re
import threading
import time

CONFIG = Path.home() / '.config/personalweb-rosa'
DATA = Path.home() / '.local/share/personalweb-rosa'
LOCK = threading.Lock()
MAX_BYTES = 1_000_000


def iso_now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def instant(value):
    if not isinstance(value, str) or len(value) > 50:
        raise ValueError('Invalid timestamp')
    parsed = datetime.datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError('Timezone required')
    return parsed.timestamp()


def text(value, limit=256):
    if not isinstance(value, str) or len(value) > limit or re.search(r'[\x00-\x1f\x7f]', value):
        raise ValueError('Invalid text field')
    return value


def number(value, maximum):
    if type(value) is not int or not 0 <= value <= maximum:
        raise ValueError('Invalid numeric field')
    return value


def validate_snapshot(payload):
    if not isinstance(payload, dict) or set(payload) != {'observedAt', 'nodes', 'jobs', 'partitions'}:
        raise ValueError('Invalid report fields')
    observed = instant(payload['observedAt'])
    if not -60 <= time.time() - observed <= 120:
        raise ValueError('Report is not current')
    for key, limit in (('nodes', 1000), ('jobs', 5000), ('partitions', 200)):
        if not isinstance(payload[key], list) or len(payload[key]) > limit:
            raise ValueError('Invalid collection')
    if not payload['nodes']:
        raise ValueError('No nodes')
    nodes = []
    names = set()
    for row in payload['nodes']:
        if not isinstance(row, dict) or set(row) != {'name', 'state', 'partitions', 'gpuModel', 'gpus', 'allocatedGpus', 'cpuAllocated', 'cpuTotal', 'telemetry'}:
            raise ValueError('Invalid node fields')
        name = text(row['name'], 100)
        if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]*', name) or name in names:
            raise ValueError('Invalid node name')
        names.add(name)
        total = number(row['gpus'], 64)
        allocated = row['allocatedGpus']
        if allocated is not None:
            number(allocated, total)
        if not isinstance(row['partitions'], list) or len(row['partitions']) > 30 or row['telemetry'] is not None:
            raise ValueError('Invalid node data')
        cpus = {}
        for field in ('cpuAllocated', 'cpuTotal'):
            value = row[field]
            if value is not None and not re.fullmatch(r'\d{1,6}', text(value, 6)):
                raise ValueError('Invalid CPU count')
            cpus[field] = value
        nodes.append(dict(name=name, state=text(row['state'], 100), partitions=[text(v, 100) for v in row['partitions']],
                          gpuModel=text(row['gpuModel'], 300), gpus=total, allocatedGpus=allocated,
                          telemetry=None, **cpus))
    jobs = []
    job_fields = {'id', 'user', 'partition', 'state', 'elapsed', 'limit', 'nodes', 'cpus', 'gres', 'reason', 'name'}
    for row in payload['jobs']:
        if not isinstance(row, dict) or set(row) != job_fields:
            raise ValueError('Invalid job fields')
        jobs.append({key: text(row[key], 512 if key in ('reason', 'name') else 256) for key in job_fields})
    partitions = []
    part_fields = {'name', 'availability', 'limit', 'nodes', 'state', 'gres'}
    for row in payload['partitions']:
        if not isinstance(row, dict) or set(row) != part_fields:
            raise ValueError('Invalid partition fields')
        partitions.append({key: text(row[key], 300) for key in part_fields})
    return dict(observedAt=payload['observedAt'], nodes=nodes, jobs=jobs, partitions=partitions)


def read_state():
    try:
        return json.loads((DATA / 'state.json').read_text())
    except (OSError, ValueError):
        return dict(state='waiting', snapshot=None, error='Waiting for the first Titan report.')


def summary():
    state = read_state()
    snapshot = state.get('snapshot')
    if snapshot:
        try:
            age = time.time() - instant(snapshot['observedAt'])
        except (KeyError, ValueError, TypeError):
            age = float('inf')
        if age > 600:
            state.update(state='unavailable', error='Titan’s latest report is delayed. Showing the last received snapshot.')
    state['servedAt'] = iso_now()
    return state


def authorized(headers):
    supplied = headers.get('Authorization', '')
    if not supplied.startswith('Bearer ') or not 32 <= len(supplied[7:]) <= 200:
        return False
    try:
        expected = (CONFIG / 'titan-token.sha256').read_text().strip()
        digest = hashlib.sha256(supplied[7:].encode('ascii')).hexdigest()
    except (OSError, UnicodeError):
        return False
    return bool(re.fullmatch(r'[0-9a-f]{64}', expected)) and hmac.compare_digest(digest, expected)


def receive(handler):
    # This credential never authenticates viewer routes, SSH, or other apps.
    if not authorized(handler.headers):
        return handler.send_json(401, {'error': 'Agent authentication required'})
    if handler.command != 'POST':
        return handler.send_json(405, {'error': 'Method not allowed'})
    if handler.headers.get('Origin') or handler.headers.get('Transfer-Encoding'):
        return handler.send_json(403, {'error': 'Invalid agent request'})
    if handler.headers.get('Content-Type', '').split(';')[0].strip() != 'application/json':
        return handler.send_json(415, {'error': 'JSON required'})
    try:
        length = int(handler.headers.get('Content-Length', '0'))
    except ValueError:
        return handler.send_json(400, {'error': 'Invalid request'})
    if not 0 < length <= MAX_BYTES:
        return handler.send_json(413, {'error': 'Report too large'})
    try:
        if hasattr(handler, 'connection'):
            handler.connection.settimeout(10)
        raw = handler.rfile.read(length)
        if len(raw) != length:
            raise ValueError('Incomplete report')
        snapshot = validate_snapshot(json.loads(raw))
    except (OSError, ValueError, TypeError, KeyError, RecursionError):
        return handler.send_json(400, {'error': 'Invalid monitoring snapshot'})
    with LOCK:
        previous = read_state()
        if previous.get('snapshot'):
            if instant(snapshot['observedAt']) <= instant(previous['snapshot']['observedAt']):
                return handler.send_json(409, {'error': 'Report already superseded'})
        if time.time() - previous.get('receivedUnix', 0) < 30:
            return handler.send_json(429, {'error': 'Reports are too frequent'})
        received = iso_now()
        next_at = datetime.datetime.fromtimestamp((int(time.time()) // 300 + 1) * 300, datetime.timezone.utc).isoformat()
        state = dict(state='ready', snapshot=snapshot, lastAttemptAt=snapshot['observedAt'], receivedAt=received,
                     receivedUnix=time.time(), nextAttemptAt=next_at, collectorHost='Titan', error=None)
        DATA.mkdir(mode=0o700, parents=True, exist_ok=True)
        temporary = DATA / 'state.tmp'
        temporary.write_text(json.dumps(state))
        temporary.chmod(0o600)
        temporary.replace(DATA / 'state.json')
    return handler.send_json(200, {'ok': True, 'observedAt': snapshot['observedAt']})
