#!/usr/bin/env python3
"""Record the public USI Lugano fitness-room occupancy indicator."""

from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
from html.parser import HTMLParser
import re
import sys
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen


SOURCE_URL = "https://sport.usi.ch/it/lugano"
DEFAULT_CSV = Path(__file__).resolve().parent / "data" / "affluenza.csv"
CSV_FIELDS = (
    "checked_at_local",
    "checked_at_utc",
    "status",
    "level_it",
    "occupancy_class",
    "water_top_pct",
    "visual_fill_estimate_pct",
    "description",
    "source_url",
    "error",
)


class OccupancyParser(HTMLParser):
    """Extract the same text and visual values shown by the page."""

    VOID_TAGS = {
        "area", "base", "br", "col", "embed", "hr", "img", "input",
        "link", "meta", "param", "source", "track", "wbr",
    }

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.level_parts: list[str] = []
        self.description_parts: list[str] = []
        self.occupancy_class = ""
        self.water_top_pct: float | None = None
        self._capture: str | None = None
        self._capture_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = dict(attrs)
        classes = (attr.get("class") or "").split()
        if "bubble" in classes:
            self.occupancy_class = " ".join(name for name in classes if name != "bubble")
        if "water" in classes:
            style = attr.get("style") or ""
            match = re.search(r"(?:^|;)\s*top\s*:\s*(-?\d+(?:\.\d+)?)\s*%", style, re.I)
            if match:
                self.water_top_pct = float(match.group(1))

        if "occupancy-text" in classes:
            self._capture = "level"
            self._capture_depth = 1
        elif "occupancy-desc" in classes:
            self._capture = "description"
            self._capture_depth = 1
        elif self._capture and tag.lower() not in self.VOID_TAGS:
            self._capture_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if self._capture and tag.lower() not in self.VOID_TAGS:
            self._capture_depth -= 1
            if self._capture_depth <= 0:
                self._capture = None
                self._capture_depth = 0

    def handle_data(self, data: str) -> None:
        if self._capture == "level":
            self.level_parts.append(data)
        elif self._capture == "description":
            self.description_parts.append(data)

    @staticmethod
    def _clean(parts: list[str]) -> str:
        return " ".join(" ".join(parts).split())

    def result(self) -> dict[str, object]:
        level = self._clean(self.level_parts)
        description = self._clean(self.description_parts)
        if not level or not self.occupancy_class:
            raise ValueError("Could not find the occupancy label and class in the page markup")

        fill_estimate = None
        if self.water_top_pct is not None:
            # The CSS `top` value positions the top of the water inside the gauge.
            fill_estimate = round(100 - self.water_top_pct, 2)

        return {
            "level_it": level,
            "occupancy_class": self.occupancy_class,
            "water_top_pct": self.water_top_pct,
            "visual_fill_estimate_pct": fill_estimate,
            "description": description,
        }


def fetch_occupancy(timeout: float) -> dict[str, object]:
    request = Request(
        SOURCE_URL,
        headers={
            "User-Agent": "USI-Affluenza-Monitor/1.0 (personal periodic check)",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
        },
    )
    with urlopen(request, timeout=timeout) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        page = response.read().decode(charset, errors="replace")

    parser = OccupancyParser()
    parser.feed(page)
    parser.close()
    return parser.result()


def append_row(path: Path, row: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    needs_header = not path.exists() or path.stat().st_size == 0
    with path.open("a", encoding="utf-8", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=CSV_FIELDS, extrasaction="ignore")
        if needs_header:
            writer.writeheader()
        writer.writerow(row)


def record_once(path: Path, timeout: float) -> bool:
    now = datetime.now().astimezone()
    row: dict[str, object] = {
        "checked_at_local": now.isoformat(timespec="seconds"),
        "checked_at_utc": now.astimezone(timezone.utc).isoformat(timespec="seconds"),
        "status": "ok",
        "source_url": SOURCE_URL,
        "error": "",
    }
    try:
        row.update(fetch_occupancy(timeout))
    except (OSError, URLError, TimeoutError, ValueError) as exc:
        row["status"] = "error"
        row["error"] = f"{type(exc).__name__}: {exc}"
        append_row(path, row)
        print(f"{row['checked_at_local']} error: {row['error']}", file=sys.stderr)
        return False

    append_row(path, row)
    print(
        f"{row['checked_at_local']} {row['level_it']} "
        f"({row['occupancy_class']}), gauge top={row['water_top_pct']}%"
    )
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--csv",
        type=Path,
        default=DEFAULT_CSV,
        help=f"CSV output path (default: {DEFAULT_CSV})",
    )
    parser.add_argument("--timeout", type=float, default=20.0, help="request timeout in seconds")
    args = parser.parse_args()
    return 0 if record_once(args.csv, args.timeout) else 1


if __name__ == "__main__":
    raise SystemExit(main())
