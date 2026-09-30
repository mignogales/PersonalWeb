"""Read-only USI crowding statistics. Days start at 06:00 Europe/Zurich.

Means use observed ten-minute intervals only. Each day gets equal weight in
the mean daily profile; missing intervals are never imputed as zero.
"""
import csv
from collections import defaultdict
from datetime import datetime, time, timedelta, timezone
import math
import os
from pathlib import Path
from statistics import mean
from zoneinfo import ZoneInfo

ZONE = ZoneInfo("Europe/Zurich")
UTC = timezone.utc
CSV_PATH = Path(os.environ.get("AFFLUENZA_CSV", str(Path.home() / "Projects/usi-affluenza-monitor/data/affluenza.csv")))


def day_of(stamp):
    local = stamp.astimezone(ZONE)
    return local.date() - timedelta(days=local.hour < 6)


def boundary(day):
    return datetime.combine(day, time(6), ZONE).astimezone(UTC)


def average(values):
    return round(mean(values), 2) if values else None


def summarize(path=CSV_PATH, now=None):
    now = (now or datetime.now(UTC)).astimezone(UTC)
    today = day_of(now)
    first_day = today - timedelta(days=29)
    start = boundary(first_day)
    rows = []
    if path.exists():
        with path.open(newline="", encoding="utf-8") as source:
            for row in csv.DictReader(source):
                try:
                    stamp = datetime.fromisoformat(row["checked_at_utc"].replace("Z", "+00:00"))
                    if stamp.tzinfo is None:
                        continue
                    stamp = stamp.astimezone(UTC)
                    if not start <= stamp <= now:
                        continue
                    fill = float(row.get("visual_fill_estimate_pct") or "nan")
                    valid = row.get("status") == "ok" and math.isfinite(fill) and 0 <= fill <= 100
                    rows.append({"stamp": stamp, "value": fill if valid else None,
                                 "level": row.get("level_it", ""), "class": row.get("occupancy_class", ""),
                                 "status": "ok" if valid else "error"})
                except (KeyError, TypeError, ValueError, OverflowError):
                    continue
    rows.sort(key=lambda row: row["stamp"])
    # Collapse extra manual checks inside one interval. UTC keys preserve the
    # repeated autumn hour and missing spring hour without inventing readings.
    intervals = defaultdict(list)
    for row in rows:
        if row["value"] is not None:
            intervals[int(row["stamp"].timestamp()) // 600].append(row)
    daily_intervals = defaultdict(list)
    for key, observations in intervals.items():
        stamp = datetime.fromtimestamp(key * 600, UTC)
        local = stamp.astimezone(ZONE)
        slot = ((local.hour - 6) % 24) * 6 + local.minute // 10
        daily_intervals[day_of(stamp)].append((slot, mean(r["value"] for r in observations)))
    profiles = defaultdict(list)
    hours = defaultdict(list)
    daily = []
    for offset in range(30):
        day = first_day + timedelta(days=offset)
        begin, end = boundary(day), boundary(day + timedelta(days=1))
        expected = int((end - begin).total_seconds() / 600)
        elapsed = min(expected, max(0, math.ceil((min(now, end) - begin).total_seconds() / 600)))
        values = daily_intervals.get(day, [])
        by_slot, by_hour = defaultdict(list), defaultdict(list)
        for slot, value in values:
            by_slot[slot].append(value)
            by_hour[(6 + slot // 6) % 24].append(value)
        for slot, readings in by_slot.items():
            profiles[slot].append(mean(readings))
        for hour, readings in by_hour.items():
            hours[hour].append(mean(readings))
        daily.append({"date": day.isoformat(), "start": begin.isoformat(), "end": end.isoformat(),
                      "mean": average([v for _, v in values]),
                      "openMean": average([v for slot, v in values if slot < 108]),
                      "intervals": len(values), "expectedIntervals": expected,
                      "coveragePct": round(100 * len(values) / expected, 1),
                      "elapsedCoveragePct": round(100 * len(values) / elapsed, 1) if elapsed else None,
                      "profile": [average(by_slot[slot]) for slot in range(144)],
                      "complete": now >= end, "partial": len(values) < expected})
    profile = [{"time": f"{(6 + slot // 6) % 24:02d}:{slot % 6 * 10:02d}",
                "mean": average(profiles[slot]), "days": len(profiles[slot])} for slot in range(144)]
    hourly = [{"hour": (6 + index) % 24, "mean": average(hours[(6 + index) % 24]),
               "days": len(hours[(6 + index) % 24]), "open": index < 18} for index in range(24)]
    ranked = sorted([h for h in hourly if h["open"] and h["mean"] is not None], key=lambda h: (h["mean"], h["hour"]))
    latest = next((row for row in reversed(rows) if row["value"] is not None), None)
    latest_check = rows[-1] if rows else None
    return {"timezone": "Europe/Zurich", "generatedAt": now.isoformat(), "windowStart": start.isoformat(),
            "daysRequested": 30, "daysObserved": sum(d["mean"] is not None for d in daily),
            "completeDays": sum(not d["partial"] and d["complete"] for d in daily),
            "mean": average([d["mean"] for d in daily if d["mean"] is not None]),
            "latest": {"timestamp": latest["stamp"].isoformat(), "value": latest["value"],
                       "level": latest["level"], "class": latest["class"]} if latest else None,
            "lastCheck": {"timestamp": latest_check["stamp"].isoformat(), "status": latest_check["status"]} if latest_check else None,
            "stale": not latest or (now - latest["stamp"]).total_seconds() > 1500,
            "readings": [{"timestamp": r["stamp"].isoformat(), "value": r["value"], "level": r["level"]} for r in rows if r["value"] is not None],
            "errors": sum(r["status"] == "error" for r in rows), "profile": profile,
            "hourly": hourly, "best": ranked[:3], "worst": list(reversed(ranked))[:3], "daily": daily}
