import copy
import datetime
import hashlib
import io
import json
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch

import rosa


def snapshot():
    return dict(observedAt=rosa.iso_now(), nodes=[dict(name='icsnode05', state='MIXED', partitions=['gpu'],
                gpuModel='gpu:A100:1', gpus=1, allocatedGpus=1, cpuAllocated='8', cpuTotal='20', telemetry=None)],
                jobs=[dict(id='1', user='nogalm', partition='gpu', state='RUNNING', elapsed='1:00', limit='2:00',
                           nodes='1', cpus='8', gres='gres:gpu:1', reason='icsnode05', name='example')], partitions=[])


class Request:
    command = 'POST'

    def __init__(self, data, token='synthetic-report-token-at-least-32-characters', **headers):
        body = json.dumps(data).encode()
        self.headers = {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'Content-Length': str(len(body)), **headers}
        self.rfile = io.BytesIO(body)

    def send_json(self, status, data):
        self.status, self.result = status, data
        return status


class ReceiverTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.config = patch.object(rosa, 'CONFIG', self.root / 'config'); self.config.start()
        self.data = patch.object(rosa, 'DATA', self.root / 'data'); self.data.start()
        rosa.CONFIG.mkdir()
        (rosa.CONFIG / 'titan-token.sha256').write_text(hashlib.sha256(b'synthetic-report-token-at-least-32-characters').hexdigest())

    def tearDown(self):
        self.data.stop(); self.config.stop(); self.tmp.cleanup()

    def test_authentication_and_method_are_independent_of_browser_sessions(self):
        request = Request(snapshot(), token='wrong')
        self.assertEqual(rosa.receive(request), 401)
        request = Request(snapshot(), Origin='https://personal.miguelnogales.com')
        self.assertEqual(rosa.receive(request), 403)
        request = Request(snapshot()); request.command = 'GET'
        self.assertEqual(rosa.receive(request), 405)
        self.assertFalse((rosa.DATA / 'state.json').exists())

    def test_good_report_then_replay_rate_limit_and_stale_cache(self):
        payload = snapshot()
        self.assertEqual(rosa.receive(Request(payload)), 200)
        self.assertEqual(rosa.summary()['state'], 'ready')
        self.assertEqual(rosa.summary()['collectorHost'], 'Titan')
        self.assertEqual(rosa.receive(Request(payload)), 409)
        newer = copy.deepcopy(payload)
        newer['observedAt'] = (datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(seconds=1)).isoformat()
        self.assertEqual(rosa.receive(Request(newer)), 429)
        with patch.object(rosa.time, 'time', return_value=time.time()+601):
            state = rosa.summary()
            self.assertEqual(state['state'], 'unavailable')
            self.assertEqual(state['snapshot'], payload)

    def test_schema_age_size_and_extra_fields(self):
        payload = snapshot(); payload['nodes'][0]['allocatedGpus'] = 2
        self.assertEqual(rosa.receive(Request(payload)), 400)
        payload = snapshot(); payload['command'] = 'shell'
        self.assertEqual(rosa.receive(Request(payload)), 400)
        payload = snapshot(); payload['observedAt'] = '2020-01-01T00:00:00Z'
        self.assertEqual(rosa.receive(Request(payload)), 400)
        payload = snapshot(); payload['jobs'][0]['user'] = 'bad\nname'
        self.assertEqual(rosa.receive(Request(payload)), 400)
        self.assertEqual(rosa.receive(Request(snapshot(), **{'Content-Length': str(rosa.MAX_BYTES+1)})), 413)
        self.assertEqual(rosa.receive(Request(snapshot(), **{'Transfer-Encoding': 'chunked'})), 403)
        self.assertFalse((rosa.DATA / 'state.json').exists())


if __name__ == '__main__':
    unittest.main()
