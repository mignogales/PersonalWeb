#!/usr/bin/env python3
"""Populate missing English verb glosses in the generated verb bank."""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_VERBS = ROOT / "src" / "data" / "verbs.json"
DEFAULT_CACHE = ROOT / "scripts" / "translations.json"

CURATED_TRANSLATIONS = {
    "abitare": "to live, reside",
    "accendere": "to turn on, light",
    "aiutare": "to help",
    "amare": "to love",
    "andare": "to go",
    "apparire": "to appear",
    "aprire": "to open",
    "arrivare": "to arrive",
    "ascoltare": "to listen",
    "aspettare": "to wait",
    "avere": "to have",
    "ballare": "to dance",
    "bastare": "to be enough",
    "bere": "to drink",
    "bisognare": "to be necessary",
    "cadere": "to fall",
    "cambiare": "to change",
    "camminare": "to walk",
    "cantare": "to sing",
    "capire": "to understand",
    "capitare": "to happen",
    "cenare": "to have dinner",
    "cercare": "to look for, search",
    "chiamare": "to call",
    "chiedere": "to ask",
    "chiudere": "to close",
    "cominciare": "to begin, start",
    "comprare": "to buy",
    "condurre": "to lead, conduct",
    "conoscere": "to know, be familiar with",
    "continuare": "to continue",
    "coprire": "to cover",
    "correre": "to run",
    "costare": "to cost",
    "costruire": "to build",
    "credere": "to believe",
    "crescere": "to grow",
    "cucinare": "to cook",
    "dare": "to give",
    "decidere": "to decide",
    "dire": "to say, tell",
    "disegnare": "to draw",
    "diventare": "to become",
    "dimenticare": "to forget",
    "domandare": "to ask",
    "dormire": "to sleep",
    "dovere": "must, to have to",
    "entrare": "to enter",
    "essere": "to be",
    "fare": "to do, make",
    "finire": "to finish",
    "giocare": "to play",
    "guardare": "to watch, look at",
    "guidare": "to drive",
    "imparare": "to learn",
    "iniziare": "to begin, start",
    "insegnare": "to teach",
    "inviare": "to send",
    "lasciare": "to leave, let",
    "lavare": "to wash",
    "lavorare": "to work",
    "leggere": "to read",
    "mancare": "to be missing, miss",
    "mandare": "to send",
    "mangiare": "to eat",
    "mettere": "to put",
    "misurare": "to measure",
    "morire": "to die",
    "nascere": "to be born",
    "nuotare": "to swim",
    "offrire": "to offer",
    "ordinare": "to order",
    "pagare": "to pay",
    "parlare": "to speak",
    "partire": "to leave, depart",
    "passare": "to pass, spend time",
    "pensare": "to think",
    "perdere": "to lose",
    "pesare": "to weigh",
    "piacere": "to like, be pleasing",
    "porre": "to put, place",
    "portare": "to bring, carry",
    "potere": "can, to be able to",
    "pranzare": "to have lunch",
    "preferire": "to prefer",
    "prendere": "to take",
    "prenotare": "to book, reserve",
    "preparare": "to prepare",
    "produrre": "to produce",
    "provare": "to try",
    "pulire": "to clean",
    "raccontare": "to tell, recount",
    "restare": "to stay",
    "ricevere": "to receive",
    "ricordare": "to remember",
    "ridere": "to laugh",
    "ridurre": "to reduce",
    "rimanere": "to remain",
    "riparare": "to repair",
    "rispondere": "to answer",
    "riuscire": "to manage, succeed",
    "rompere": "to break",
    "salire": "to go up, climb",
    "sapere": "to know",
    "scendere": "to go down, descend",
    "scegliere": "to choose",
    "scoprire": "to discover",
    "scrivere": "to write",
    "sembrare": "to seem",
    "seguire": "to follow",
    "sentire": "to hear, feel",
    "servire": "to serve, be useful",
    "spedire": "to send, ship",
    "spiegare": "to explain",
    "sporcare": "to dirty",
    "stare": "to stay, be",
    "studiare": "to study",
    "succedere": "to happen",
    "suonare": "to play, sound",
    "tenere": "to hold, keep",
    "tirare": "to pull, throw",
    "toccare": "to touch",
    "tornare": "to return",
    "tradurre": "to translate",
    "trovare": "to find",
    "usare": "to use",
    "uscire": "to go out",
    "valere": "to be worth",
    "vedere": "to see",
    "vendere": "to sell",
    "venire": "to come",
    "viaggiare": "to travel",
    "vincere": "to win",
    "vivere": "to live",
    "volare": "to fly",
    "volere": "to want",
}


def load_json(path: Path, fallback):
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_gloss(value: str) -> str:
    value = " ".join(value.strip().split())
    if value.isupper():
        value = value.lower()
    if not value:
        return value
    lowered = value.lower()
    if lowered.startswith("to ") or lowered.startswith("can, ") or lowered.startswith("must, "):
        return value
    return f"to {value}"


def install_request_timeout(timeout_seconds: int) -> None:
    import requests

    original_get = requests.get

    def get_with_timeout(*args: Any, **kwargs: Any):
        kwargs.setdefault("timeout", timeout_seconds)
        return original_get(*args, **kwargs)

    requests.get = get_with_timeout


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--verbs", type=Path, default=DEFAULT_VERBS)
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE)
    parser.add_argument("--limit", type=int, default=0, help="maximum new translations to fetch; 0 means all")
    parser.add_argument("--timeout", type=int, default=8, help="network timeout in seconds")
    args = parser.parse_args()

    try:
        from deep_translator import GoogleTranslator
    except ImportError as exc:
        raise SystemExit(
            "Missing deep-translator. Install it with: python3 -m pip install -r scripts/requirements.txt"
        ) from exc

    install_request_timeout(args.timeout)
    verbs = load_json(args.verbs, [])
    cache = load_json(args.cache, {})

    for verb in verbs:
        if verb.get("english"):
            cache.setdefault(verb["lemma"], verb["english"])
    cache.update(CURATED_TRANSLATIONS)
    cache = {lemma: normalize_gloss(gloss) for lemma, gloss in cache.items()}

    missing = [verb["lemma"] for verb in verbs if not cache.get(verb["lemma"])]
    if args.limit:
        missing = missing[: args.limit]

    translator = GoogleTranslator(source="it", target="en")
    fetched = 0
    for lemma in missing:
        try:
            cache[lemma] = normalize_gloss(translator.translate(lemma))
            fetched += 1
            args.cache.write_text(
                json.dumps(dict(sorted(cache.items())), ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            print(f"Fetched {fetched}/{len(missing)}: {lemma} -> {cache[lemma]}")
            time.sleep(0.08)
        except Exception as exc:
            print(f"Skipping {lemma}: {exc}", file=sys.stderr)

    for verb in verbs:
        verb["english"] = cache.get(verb["lemma"], verb.get("english", ""))

    args.cache.write_text(json.dumps(dict(sorted(cache.items())), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    args.verbs.write_text(json.dumps(verbs, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    remaining = sum(1 for verb in verbs if not verb.get("english"))
    print(f"Fetched {fetched} translations. {remaining} verbs still missing glosses.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
