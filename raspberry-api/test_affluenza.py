import csv
from datetime import datetime, timezone
from pathlib import Path
import tempfile
import unittest

from affluenza import summarize


class AffluenzaTests(unittest.TestCase):
    def summary(self, rows, now="2026-09-30T12:00:00+00:00"):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "affluenza.csv"
            with path.open("w", newline="") as out:
                writer = csv.DictWriter(out, fieldnames=["checked_at_utc", "status", "visual_fill_estimate_pct"])
                writer.writeheader()
                for stamp, value in rows:
                    writer.writerow({"checked_at_utc": stamp, "status": "error" if value is None else "ok", "visual_fill_estimate_pct": value})
            return summarize(path, datetime.fromisoformat(now))

    def test_day_boundary_and_closed_hours(self):
        data = self.summary([("2026-09-30T03:50:00Z", 90), ("2026-09-30T04:00:00Z", 20)])
        self.assertEqual(data["daily"][-2]["mean"], 90)
        self.assertEqual(data["daily"][-1]["mean"], 20)
        self.assertEqual(data["best"][0]["hour"], 6)
        self.assertTrue(all(h["hour"] >= 6 for h in data["best"] + data["worst"]))
        self.assertEqual(data["daily"][-2]["openMean"], None)

    def test_manual_checks_do_not_overweight_interval_or_day(self):
        rows = [("2026-09-29T04:00:00Z", 0), ("2026-09-29T04:02:00Z", 100),
                ("2026-09-29T04:10:00Z", 0), ("2026-09-30T04:00:00Z", 100)]
        data = self.summary(rows)
        self.assertEqual(data["daily"][-2]["intervals"], 2)
        self.assertEqual(data["daily"][-2]["mean"], 25)
        self.assertEqual(data["profile"][0]["mean"], 75)
        self.assertEqual(data["hourly"][0]["mean"], 62.5)
        self.assertEqual(data["mean"], 62.5)

    def test_failed_missing_out_of_range_and_future_readings(self):
        data = self.summary([("2026-09-30T04:00:00Z", 50), ("2026-09-30T04:10:00Z", None),
                             ("2026-09-30T04:20:00Z", 101), ("2026-09-30T04:30:00Z", "nan"),
                             ("2026-09-30T13:00:00Z", 0), ("bad-timestamp", 20)])
        self.assertEqual(data["errors"], 3)
        self.assertEqual(data["daily"][-1]["mean"], 50)
        self.assertEqual(data["profile"][1]["mean"], None)
        self.assertTrue(data["stale"])
        self.assertEqual(data["lastCheck"]["status"], "error")

    def test_swiss_dst_coverage(self):
        spring = self.summary([], "2026-03-30T12:00:00+00:00")
        autumn = self.summary([], "2026-10-26T12:00:00+00:00")
        self.assertEqual(next(d for d in spring["daily"] if d["date"] == "2026-03-28")["expectedIntervals"], 138)
        self.assertEqual(next(d for d in autumn["daily"] if d["date"] == "2026-10-24")["expectedIntervals"], 150)

    def test_empty_and_rolling_thirty_days(self):
        data = self.summary([("2026-08-30T12:00:00Z", 80)])
        self.assertEqual(len(data["daily"]), 30)
        self.assertEqual(len(data["profile"]), 144)
        self.assertIsNone(data["mean"])
        self.assertEqual(data["best"], [])
        self.assertTrue(data["stale"])


if __name__ == "__main__":
    unittest.main()
