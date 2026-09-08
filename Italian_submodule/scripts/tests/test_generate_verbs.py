import importlib.util
import json
import unittest
from pathlib import Path


GENERATOR_PATH = Path(__file__).resolve().parents[1] / "generate_verbs.py"
VERB_BANK_PATH = Path(__file__).resolve().parents[2] / "src" / "data" / "verbs.json"
SPEC = importlib.util.spec_from_file_location("generate_verbs", GENERATOR_PATH)
assert SPEC and SPEC.loader
generate_verbs = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(generate_verbs)


class FakeConjugation:
    def __init__(self, past_participle_rows: list[dict[str, list[str]]]) -> None:
        self.past_participle_rows = past_participle_rows

    def get_data(self) -> dict:
        return {
            "moods": {
                "participio": {
                    "participio-passato": self.past_participle_rows,
                }
            }
        }


class PastParticipleValidationTest(unittest.TestCase):
    def test_accepts_a_real_past_participle(self) -> None:
        conjugation = FakeConjugation([{"c": ["parlato"]}])

        self.assertTrue(generate_verbs.has_valid_past_participle(conjugation))

    def test_rejects_missing_or_placeholder_past_participles(self) -> None:
        self.assertFalse(generate_verbs.has_valid_past_participle(FakeConjugation([])))
        self.assertFalse(generate_verbs.has_valid_past_participle(FakeConjugation([{"c": ["-"]}])))


class ReflexiveImperativeVariantsTest(unittest.TestCase):
    def test_noi_clitic_is_attached(self) -> None:
        self.assertEqual(
            generate_verbs.reflexive_accepted_variants("imperativo affermativo", "noi", ["mettiamo"]),
            ["ci mettiamo", "mettiamoci"],
        )

    def test_tu_and_voi_clitics_are_attached(self) -> None:
        self.assertEqual(
            generate_verbs.reflexive_accepted_variants("imperativo affermativo", "tu", ["metti"]),
            ["ti metti", "mettiti"],
        )
        self.assertEqual(
            generate_verbs.reflexive_accepted_variants("imperativo affermativo", "voi", ["mettete"]),
            ["vi mettete", "mettetevi"],
        )

    def test_short_tu_imperative_doubles_clitic_consonant(self) -> None:
        self.assertEqual(
            generate_verbs.reflexive_accepted_variants("imperativo affermativo", "tu", ["da'"]),
            ["ti da'", "datti"],
        )

    def test_formal_imperative_remains_proclitic(self) -> None:
        self.assertEqual(
            generate_verbs.reflexive_accepted_variants("imperativo affermativo", "lui/lei", ["metta"]),
            ["si metta"],
        )

    def test_negative_tu_accepts_proclitic_and_enclitic_infinitives(self) -> None:
        self.assertEqual(
            generate_verbs.reflexive_accepted_variants("imperativo negativo", "tu", ["mettere"]),
            ["ti mettere", "metterti"],
        )


class NegativeImperativeRepairTest(unittest.TestCase):
    def test_replaces_corrupt_sapere_forms_from_affirmative_imperative(self) -> None:
        forms = [
            {"tense": "imperativo affermativo", "person": "tu", "accepted": ["sappi"]},
            {"tense": "imperativo affermativo", "person": "noi", "accepted": ["sappiamo"]},
            {"tense": "imperativo negativo", "person": "tu", "accepted": ["sire"]},
            {"tense": "imperativo negativo", "person": "noi", "accepted": ["siamo"]},
        ]

        repaired = generate_verbs.repair_negative_imperatives(forms, "sapere")

        negative = {
            form["person"]: form["accepted"]
            for form in repaired
            if form["tense"] == "imperativo negativo"
        }
        self.assertEqual(negative, {"tu": ["sapere"], "noi": ["sappiamo"]})

    def test_preserves_gender_specific_counterparts(self) -> None:
        forms = [
            {
                "tense": "imperativo affermativo",
                "person": "lui/lei",
                "genderNumber": "f_s",
                "accepted": ["sappia"],
            },
            {
                "tense": "imperativo negativo",
                "person": "lui/lei",
                "genderNumber": "f_s",
                "accepted": ["sga"],
            },
        ]

        repaired = generate_verbs.repair_negative_imperatives(forms, "sapere")

        self.assertEqual(repaired[1]["accepted"], ["sappia"])

    def test_drops_spurious_negative_form_without_affirmative_counterpart(self) -> None:
        forms = [
            {"tense": "imperativo negativo", "person": "tu", "accepted": ["bisognttere"]},
            {"tense": "imperativo negativo", "person": "noi", "accepted": ["bisiamo"]},
        ]

        self.assertEqual(generate_verbs.repair_negative_imperatives(forms, "bisognare"), [])


class GeneratedBankInvariantTest(unittest.TestCase):
    def test_no_placeholder_forms_are_included(self) -> None:
        verbs = json.loads(VERB_BANK_PATH.read_text(encoding="utf-8"))

        for verb in verbs:
            for form in verb["forms"]:
                for accepted in form["accepted"]:
                    self.assertNotIn("-", accepted.split(), f"{verb['lemma']} {form['tense']}")

    def test_all_non_reflexive_negative_imperatives_follow_italian_rule(self) -> None:
        verbs = json.loads(VERB_BANK_PATH.read_text(encoding="utf-8"))

        for verb in verbs:
            forms_by_key = {
                (form["tense"], form["person"], form.get("genderNumber")): form
                for form in verb["forms"]
            }
            for form in verb["forms"]:
                if form["tense"] != "imperativo negativo":
                    continue

                key = ("imperativo affermativo", form["person"], form.get("genderNumber"))
                affirmative = forms_by_key.get(key)
                self.assertIsNotNone(affirmative, f"{verb['lemma']} {form['person']}")

                if verb["lemma"].endswith("si"):
                    continue

                expected = [verb["lemma"]] if form["person"] == "tu" else affirmative["accepted"]
                self.assertEqual(form["accepted"], expected, f"{verb['lemma']} {form['person']}")


class FrequencyRankingTest(unittest.TestCase):
    def test_frequency_ranks_are_unique_and_one_based(self) -> None:
        ranks = list(generate_verbs.FREQUENCY_RANK_BY_LEMMA.values())
        self.assertEqual(ranks, list(range(1, len(ranks) + 1)))

    def test_everyday_verbs_are_prioritized_before_dictionary_fallbacks(self) -> None:
        available = ["abbacchiare", "incontrare", "essere", "rilassare"]
        self.assertEqual(
            generate_verbs.prioritized_infinitives(available, None),
            ["essere", "incontrare", "rilassarsi", "incontrarsi", "abbacchiare", "rilassare"],
        )


if __name__ == "__main__":
    unittest.main()
