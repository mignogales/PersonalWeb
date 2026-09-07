"""Run: python3 -m unittest discover -s raspberry-api -p 'test_*.py'"""
import concurrent.futures
import copy
import tempfile
import unittest
from pathlib import Path
import italian


class ItalianTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        italian.DATA = Path(self.temp.name)
        self.user = self.register('Miguel')
        self.headers = {'Authorization': 'Bearer ' + self.user['token']}

    def tearDown(self):
        self.temp.cleanup()

    def register(self, name):
        return italian.handle('POST', '/italian/auth/register', {}, {'name': name, 'password': 'test-password-123'})[1]

    def save(self, revision, mutation, progress=None, headers=None):
        return italian.handle('PUT', '/italian/progress', headers or self.headers,
                              {'revision': revision, 'mutationId': mutation, 'progress': progress or copy.deepcopy(italian.EMPTY)})

    def test_account_isolation_and_logout(self):
        with self.assertRaises(italian.APIError) as error:
            italian.handle('GET', '/italian/progress', {}, {})
        self.assertEqual(error.exception.status, 401)
        other = self.register('Other')
        self.save(0, 'first')
        self.assertEqual(italian.handle('GET', '/italian/progress', {'Authorization': 'Bearer ' + other['token']}, {})[1]['revision'], 0)
        italian.handle('POST', '/italian/auth/logout', self.headers, {})
        with self.assertRaises(italian.APIError):
            italian.handle('GET', '/italian/progress', self.headers, {})

    def test_password_and_session_persistence(self):
        with self.assertRaises(italian.APIError):
            italian.handle('POST', '/italian/auth/login', {}, {'name': 'Miguel', 'password': 'incorrect-password'})
        signed = italian.handle('POST', '/italian/auth/login', {}, {'name': 'miguel', 'password': 'test-password-123'})[1]
        self.assertEqual(signed['user']['id'], self.user['user']['id'])
        with self.assertRaises(italian.APIError):
            self.register('MIGUEL')
        db = italian.connect()
        row = db.execute('SELECT password FROM accounts').fetchone()
        self.assertNotEqual(row[0], 'test-password-123')
        db.close()

    def test_concurrent_save_conflict_and_idempotent_retry(self):
        with concurrent.futures.ThreadPoolExecutor() as pool:
            results = list(pool.map(lambda key: self.save(0, key), ['a', 'b']))
        self.assertEqual(sorted(status for status, _ in results), [200, 409])
        winner = 'a' if results[0][0] == 200 else 'b'
        self.assertEqual(self.save(0, winner)[1]['revision'], 1)
        self.assertEqual(self.save(0, 'stale')[0], 409)
        self.assertEqual(self.save(1, 'next')[1]['revision'], 2)
        self.assertEqual(self.save(0, winner)[1]['revision'], 2)

    def test_validation(self):
        bad = copy.deepcopy(italian.EMPTY)
        bad['forms'] = {'x': {'attempts': -1}}
        with self.assertRaises(italian.APIError) as error:
            self.save(0, 'bad', bad)
        self.assertEqual(error.exception.status, 400)
        self.assertEqual(italian.handle('GET', '/italian/progress', self.headers, {})[1]['revision'], 0)


if __name__ == '__main__':
    unittest.main()
