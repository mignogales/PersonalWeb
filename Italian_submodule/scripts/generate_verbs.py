#!/usr/bin/env python3
"""Generate the Italian verb practice bank from verbecc conjugations."""

from __future__ import annotations

import argparse
import json
import logging
import re
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "src" / "data" / "verbs.json"
TRANSLATION_CACHE = ROOT / "scripts" / "translations.json"

PERSON_BY_CODE = {
    "1": {"s": "io", "p": "noi"},
    "2": {"s": "tu", "p": "voi"},
    "3": {"s": "lui/lei", "p": "loro"},
}

GENDER_NUMBER = {
    ("m", "s"): "m_s",
    ("f", "s"): "f_s",
    ("m", "p"): "m_p",
    ("f", "p"): "f_p",
}

COMPOUND_TENSES = {
    "passato prossimo",
    "trapassato prossimo",
    "trapassato remoto",
    "futuro anteriore",
    "condizionale passato",
    "congiuntivo passato",
    "congiuntivo trapassato",
}

AUXILIARY_BY_TENSE_PERSON = {
    "passato prossimo": {
        "io": ("ho", "sono"),
        "tu": ("hai", "sei"),
        "lui/lei": ("ha", "è"),
        "noi": ("abbiamo", "siamo"),
        "voi": ("avete", "siete"),
        "loro": ("hanno", "sono"),
    },
    "trapassato prossimo": {
        "io": ("avevo", "ero"),
        "tu": ("avevi", "eri"),
        "lui/lei": ("aveva", "era"),
        "noi": ("avevamo", "eravamo"),
        "voi": ("avevate", "eravate"),
        "loro": ("avevano", "erano"),
    },
    "trapassato remoto": {
        "io": ("ebbi", "fui"),
        "tu": ("avesti", "fosti"),
        "lui/lei": ("ebbe", "fu"),
        "noi": ("avemmo", "fummo"),
        "voi": ("aveste", "foste"),
        "loro": ("ebbero", "furono"),
    },
    "futuro anteriore": {
        "io": ("avrò", "sarò"),
        "tu": ("avrai", "sarai"),
        "lui/lei": ("avrà", "sarà"),
        "noi": ("avremo", "saremo"),
        "voi": ("avrete", "sarete"),
        "loro": ("avranno", "saranno"),
    },
    "condizionale passato": {
        "io": ("avrei", "sarei"),
        "tu": ("avresti", "saresti"),
        "lui/lei": ("avrebbe", "sarebbe"),
        "noi": ("avremmo", "saremmo"),
        "voi": ("avreste", "sareste"),
        "loro": ("avrebbero", "sarebbero"),
    },
    "congiuntivo passato": {
        "io": ("abbia", "sia"),
        "tu": ("abbia", "sia"),
        "lui/lei": ("abbia", "sia"),
        "noi": ("abbiamo", "siamo"),
        "voi": ("abbiate", "siate"),
        "loro": ("abbiano", "siano"),
    },
    "congiuntivo trapassato": {
        "io": ("avessi", "fossi"),
        "tu": ("avessi", "fossi"),
        "lui/lei": ("avesse", "fosse"),
        "noi": ("avessimo", "fossimo"),
        "voi": ("aveste", "foste"),
        "loro": ("avessero", "fossero"),
    },
}

ESSERE_AUXILIARY_LEMMAS = {
    "accadere",
    "andare",
    "apparire",
    "arrivare",
    "bastare",
    "cadere",
    "capitare",
    "costare",
    "crescere",
    "decadere",
    "decrescere",
    "diventare",
    "entrare",
    "esistere",
    "fuggire",
    "intervenire",
    "mancare",
    "morire",
    "nascere",
    "occorrere",
    "partire",
    "piacere",
    "restare",
    "riapparire",
    "ricadere",
    "rimanere",
    "riuscire",
    "salire",
    "scappare",
    "scendere",
    "sembrare",
    "sparire",
    "stare",
    "succedere",
    "tornare",
    "uscire",
    "venire",
}

REFLEXIVE_PRONOUN_BY_PERSON = {
    "io": "mi",
    "tu": "ti",
    "lui/lei": "si",
    "noi": "ci",
    "voi": "vi",
    "loro": "si",
}

PRONOUN_PREFIXES = (
    "che io ",
    "che tu ",
    "che lui ",
    "che lei ",
    "che noi ",
    "che voi ",
    "che loro ",
    "io ",
    "tu ",
    "lui ",
    "lei ",
    "noi ",
    "voi ",
    "loro ",
)

COMMON_FIRST = [
    "essere",
    "avere",
    "fare",
    "dire",
    "andare",
    "potere",
    "volere",
    "dovere",
    "sapere",
    "stare",
    "vedere",
    "dare",
    "venire",
    "parlare",
    "trovare",
    "sentire",
    "lasciare",
    "prendere",
    "guardare",
    "mettere",
    "pensare",
    "portare",
    "credere",
    "chiamare",
    "arrivare",
    "passare",
    "vivere",
    "capire",
    "mangiare",
    "uscire",
    "tornare",
    "scrivere",
    "leggere",
    "perdere",
    "conoscere",
    "rispondere",
    "aprire",
    "chiudere",
    "bere",
    "dormire",
    "finire",
    "partire",
    "comprare",
    "lavorare",
    "studiare",
    "ascoltare",
    "giocare",
    "cercare",
    "pagare",
    "aiutare",
    "amare",
    "aspettare",
    "restare",
    "entrare",
    "salire",
    "scendere",
    "morire",
    "nascere",
    "piacere",
    "scegliere",
    "rimanere",
    "tenere",
    "porre",
    "tradurre",
    "offrire",
    "correre",
    "ridere",
    "vincere",
    "decidere",
    "ricevere",
    "servire",
    "seguire",
    "costruire",
    "pulire",
    "preferire",
    "spedire",
    "capitare",
    "succedere",
    "cominciare",
    "iniziare",
    "continuare",
    "provare",
    "usare",
    "cambiare",
    "diventare",
    "sembrare",
    "mancare",
    "bisognare",
    "bastare",
    "chiedere",
    "domandare",
    "spiegare",
    "raccontare",
    "ricordare",
    "dimenticare",
    "imparare",
    "insegnare",
    "viaggiare",
    "abitare",
    "visitare",
    "telefonare",
    "mandare",
    "inviare",
    "aspettare",
    "cucinare",
    "lavare",
    "lavarsi",
    "alzarsi",
    "svegliarsi",
    "vestirsi",
    "divertirsi",
    "sedersi",
    "sentirsi",
    "chiamarsi",
    "preparare",
    "portare",
    "pranzare",
    "cenare",
    "camminare",
    "guidare",
    "volare",
    "nuotare",
    "cantare",
    "ballare",
    "suonare",
    "disegnare",
    "vendere",
    "affittare",
    "prenotare",
    "ordinare",
    "pagare",
    "costare",
    "valere",
    "pesare",
    "misurare",
    "toccare",
    "spingere",
    "tirare",
    "accendere",
    "spegnere",
    "rompere",
    "riparare",
    "pulire",
    "sporcare",
    "cadere",
    "crescere",
    "apparire",
    "sparire",
    "coprire",
    "scoprire",
    "riuscire",
    "produrre",
    "ridurre",
    "condurre",
    "mettersi",
    "rendersi",
    "accorgersi",
    "lamentarsi",
    "sposarsi",
    "fermarsi",
    "muoversi",
    "preoccuparsi",
    "addormentarsi",
    "arrabbiarsi",
]


def reflexive_base(lemma: str) -> str | None:
    if not lemma.endswith("si"):
        return None
    stem = lemma[:-2]
    if stem.endswith(("ar", "er", "ir")):
        return f"{stem}e"
    return None


def load_existing_translations(path: Path) -> dict[str, str]:
    translations: dict[str, str] = {}
    if TRANSLATION_CACHE.exists():
        try:
            translations.update(json.loads(TRANSLATION_CACHE.read_text(encoding="utf-8")))
        except json.JSONDecodeError:
            pass
    if not path.exists():
        return translations
    try:
        verbs = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return translations
    translations.update({entry["lemma"]: entry.get("english", "") for entry in verbs if entry.get("english")})
    return translations


def strip_prompt_prefix(value: str) -> str:
    value = re.sub(r"\s+", " ", value).strip()
    for prefix in PRONOUN_PREFIXES:
        if value.startswith(prefix):
            return value[len(prefix) :].strip()
    return value


def accepted_variants(values: list[str]) -> list[str]:
    variants: list[str] = []
    for value in values:
        if not value or value == "-":
            continue
        parts = [part.strip() for part in value.split("/") if part.strip()]
        for part in parts:
            stripped = strip_prompt_prefix(part)
            if stripped and stripped not in variants:
                variants.append(stripped)
    return variants


def person_for(form: dict[str, Any]) -> str | None:
    person_code = str(form.get("p", ""))
    number_code = form.get("n", "")
    return PERSON_BY_CODE.get(person_code, {}).get(number_code)


def form_id(form: dict[str, Any]) -> tuple[str, str | None]:
    gender_number = GENDER_NUMBER.get((form.get("g"), form.get("n")))
    return (person_for(form) or "", gender_number)


def normalize_tense(mood: str, tense: str) -> str:
    tense_label = tense.replace("-", " ")
    if mood == "indicativo":
        return tense_label
    return f"{mood} {tense_label}"


def participle_variants(participle: str, person: str) -> list[tuple[str, str]]:
    gender_numbers = {
        "io": ("m_s", "f_s"),
        "tu": ("m_s", "f_s"),
        "lui/lei": ("m_s", "f_s"),
        "noi": ("m_p", "f_p"),
        "voi": ("m_p", "f_p"),
        "loro": ("m_p", "f_p"),
    }[person]
    if participle.endswith("o"):
        stem = participle[:-1]
        endings = {"m_s": "o", "f_s": "a", "m_p": "i", "f_p": "e"}
        return [(f"{stem}{endings[gender_number]}", gender_number) for gender_number in gender_numbers]
    return [(participle, gender_number) for gender_number in gender_numbers]


def convert_to_essere_compounds(forms: list[dict[str, Any]], reflexive: bool = False) -> list[dict[str, Any]]:
    converted: list[dict[str, Any]] = []

    for form in forms:
        tense = form["tense"]
        person = form["person"]
        if tense not in COMPOUND_TENSES:
            next_form = {**form, "accepted": [f"{REFLEXIVE_PRONOUN_BY_PERSON[person]} {value}" for value in form["accepted"]]} if reflexive else form
            converted.append(next_form)
            continue

        aux_pair = AUXILIARY_BY_TENSE_PERSON.get(tense, {}).get(person)
        if not aux_pair:
            converted.append(form)
            continue

        avere_aux, essere_aux = aux_pair
        accepted: list[str] = []
        for value in form["accepted"]:
            if not value.startswith(f"{avere_aux} "):
                continue
            participle = value[len(avere_aux) + 1 :]
            for inflected, gender_number in participle_variants(participle, person):
                prefix = f"{REFLEXIVE_PRONOUN_BY_PERSON[person]} " if reflexive else ""
                accepted.append((f"{prefix}{essere_aux} {inflected}", gender_number))

        if not accepted:
            next_form = {**form}
            if reflexive:
                next_form["accepted"] = [f"{REFLEXIVE_PRONOUN_BY_PERSON[person]} {value}" for value in form["accepted"]]
            converted.append(next_form)
            continue

        for value, gender_number in accepted:
            next_form = {
                "tense": tense,
                "person": person,
                "genderNumber": gender_number,
                "accepted": [value],
            }
            if next_form not in converted:
                converted.append(next_form)

    return converted


def flatten_forms(conjugation: Any, lemma: str, reflexive: bool = False) -> list[dict[str, Any]]:
    forms_by_key: dict[tuple[str, str, str | None], dict[str, Any]] = {}
    moods = conjugation.get_data()["moods"]

    for mood, tenses in moods.items():
        if mood in {"infinito", "participio"}:
            continue
        for tense, rows in tenses.items():
            tense_label = normalize_tense(mood, tense)
            for row in rows:
                person = person_for(row)
                if not person:
                    continue

                accepted = accepted_variants(row.get("c", []))
                if not accepted:
                    continue

                _, gender_number = form_id(row)
                key = (tense_label, person, gender_number)
                target = forms_by_key.setdefault(
                    key,
                    {
                        "tense": tense_label,
                        "person": person,
                        "accepted": [],
                    },
                )
                if gender_number:
                    target["genderNumber"] = gender_number
                for value in accepted:
                    if value not in target["accepted"]:
                        target["accepted"].append(value)

    forms = sorted(
        forms_by_key.values(),
        key=lambda item: (
            item["tense"],
            ["io", "tu", "lui/lei", "noi", "voi", "loro"].index(item["person"]),
            item.get("genderNumber", ""),
        ),
    )
    if lemma in ESSERE_AUXILIARY_LEMMAS or reflexive:
        return convert_to_essere_compounds(forms, reflexive=reflexive)
    return forms


def prioritized_infinitives(all_infinitives: list[str], limit: int | None) -> list[str]:
    seen = set()
    ordered: list[str] = []
    available = set(all_infinitives)
    for lemma in COMMON_FIRST:
        base_lemma = reflexive_base(lemma)
        if (lemma in available or (base_lemma and base_lemma in available)) and lemma not in seen:
            ordered.append(lemma)
            seen.add(lemma)
    for lemma in all_infinitives:
        if lemma not in seen:
            ordered.append(lemma)
            seen.add(lemma)
    return ordered if limit is None else ordered[:limit]


def generate(output: Path, limit: int | None) -> list[dict[str, Any]]:
    try:
        from verbecc import CompleteConjugator, LangCodeISO639_1
    except ImportError as exc:
        raise SystemExit(
            "Missing verbecc. Install it with: python3 -m pip install -r scripts/requirements.txt"
        ) from exc

    logging.getLogger("verbecc").setLevel(logging.ERROR)
    translations = load_existing_translations(output)
    conjugator = CompleteConjugator(LangCodeISO639_1.it)
    available_infinitives = conjugator.get_infinitives()
    infinitives = prioritized_infinitives(available_infinitives, limit)
    verbs: list[dict[str, Any]] = []
    skipped: list[tuple[str, str]] = []

    for lemma in infinitives:
        base_lemma = reflexive_base(lemma) or lemma
        is_reflexive = base_lemma != lemma
        try:
            verb = conjugator.find_verb_by_infinitive(base_lemma)
            conjugation = conjugator.conjugate(base_lemma)
        except Exception as exc:
            skipped.append((lemma, str(exc)))
            continue
        forms = flatten_forms(conjugation, lemma=base_lemma, reflexive=is_reflexive)
        if not forms:
            continue

        verbs.append(
            {
                "id": lemma,
                "lemma": lemma,
                "english": translations.get(lemma, ""),
                "irregular": str(verb.template).startswith(":"),
                "forms": forms,
            }
        )

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(verbs, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if skipped:
        print(f"Skipped {len(skipped)} verbs with invalid source templates.", file=sys.stderr)
    return verbs


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--limit", type=int, default=750, help="number of infinitives to generate; use 0 for all")
    args = parser.parse_args()

    limit = None if args.limit == 0 else args.limit
    verbs = generate(args.output, limit)
    forms = sum(len(verb["forms"]) for verb in verbs)
    print(f"Wrote {len(verbs)} verbs and {forms} forms to {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
