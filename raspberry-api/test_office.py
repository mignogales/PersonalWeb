import tempfile
import unittest
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import office
from italian import APIError, dispatch


class OfficeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.old = office.DATA
        office.DATA = Path(self.temp.name)
        self.headers = []
        for name in ('Alice', 'Bob'):
            db = office.connect()
            dispatch(db, 'POST', '/italian/auth/register', {}, {'name': name, 'password': 'test-password-123'})
            db.close()
            _, result = office.handle('POST', '/office/login', {}, {'name': name, 'password': 'test-password-123'})
            self.headers.append({'Authorization': 'Bearer ' + result['token']})

    def tearDown(self):
        office.DATA = self.old
        self.temp.cleanup()

    def save(self, who, changes):
        return office.handle('PUT', '/office/schedule/me', self.headers[who], {'changes': changes})[1]

    def test_shared_and_independent_writes(self):
        with ThreadPoolExecutor(2) as pool:
            list(pool.map(lambda who: self.save(who, {'2026-09-08': True}), [0, 1]))
        self.assertEqual(self.save(0, {'2026-09-09': True})['schedule']['dates']['2026-09-08'], ['Alice', 'Bob'])
        result = self.save(0, {'2026-09-08': False})['schedule']['dates']
        self.assertEqual(result['2026-09-08'], ['Bob'])
        self.assertEqual(result['2026-09-09'], ['Alice'])
        self.assertEqual(result, self.save(0, {'2026-09-08': False})['schedule']['dates'])

    def test_validation_is_atomic(self):
        with self.assertRaises(APIError):
            self.save(0, {'2026-09-08': True, '2026-02-30': True})
        self.assertEqual(self.save(0, {})['schedule']['dates'], {})
        with self.assertRaises(APIError):
            self.save(0, {'2026-09-08': 1})

    def test_private_and_revoked_sessions(self):
        with self.assertRaises(APIError) as error:
            office.handle('GET', '/office/schedule', {}, {})
        self.assertEqual(error.exception.status, 401)
        office.handle('POST', '/office/logout', self.headers[0], {})
        with self.assertRaises(APIError):
            self.save(0, {})
        with self.assertRaises(APIError):
            office.handle('POST', '/office/register', {}, {'name': 'Mallory', 'password': 'test-password-123'})

    def test_same_account_different_devices(self):
        self.save(0, {'2026-09-08': True})
        self.save(0, {'2026-09-09': True})
        self.assertEqual(len(self.save(0, {})['schedule']['dates']), 2)


if __name__ == '__main__':
    unittest.main()
