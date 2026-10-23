"""The two-label mix check: cited pair rules, honest abstention, no invention."""
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)
ROOT = Path(__file__).resolve().parents[2]
PAIRS = json.loads((ROOT / "data" / "evidence" / "pairs.json").read_text())

T34 = "T34 BIOCONTROL Biological Fungicide. Active ingredient: Trichoderma asperellum strain T34. Wettable powder for soil application."
TILT = "TILT 25 EC systemic fungicide. Active ingredient: propiconazole 25% EC. For the control of rusts and leaf spots."
COPPER = "KOCIDE 3000 copper hydroxide fungicide and bactericide. 46.1% copper hydroxide. For disease control on vegetables."
BOTANIGARD = "BotaniGard ES Biological Insecticide. Contains live spores of the entomopathogenic fungus Beauveria bassiana strain GHA. For control of whiteflies, aphids and thrips."
MANCOZEB = "Dithane M-45 fungicide. Active ingredient: mancozeb 75% WP. A protectant fungicide for potatoes and tomatoes."
SOAP = "Gentle hand soap with lavender oil, glycerin and a little salt. Keep away from eyes and children."


def check(a, b):
    r = client.post("/api/mixcheck", json={"text_a": a, "text_b": b})
    assert r.status_code == 200
    return r.json()


def test_conflict_t34_any_pesticide():
    j = check(T34, TILT)
    assert j["status"] == "conflict"
    f = j["findings"][0]
    assert f["rule_id"] == "t34_no_tank_mix"
    assert f["source"]["url"].startswith("http")
    assert "T34" in f["headline"]


def test_conflict_rootshield_propiconazole():
    j = check("RootShield WP Biological Fungicide Trichoderma harzianum strain KRL-AG2 for root diseases.",
              TILT)
    assert j["status"] == "conflict"
    assert j["findings"][0]["rule_id"] == "rootshield_wp_listed_ais"
    assert "propiconazole" in j["findings"][0]["headline"]


def test_conflict_blightban_copper():
    j = check("BlightBan A506 uses the beneficial bacterium Pseudomonas fluorescens A506 for fire blight suppression.",
              COPPER)
    assert j["status"] == "conflict"
    assert j["findings"][0]["rule_id"] == "blightban_no_copper"


def test_conflict_naturalis_fungicide():
    j = check("Naturalis L Biological Insecticide, Beauveria bassiana strain ATCC 74040, for whitefly control.",
              MANCOZEB)
    assert j["status"] == "conflict"
    assert any(f["rule_id"] == "naturalis_no_fungicides" for f in j["findings"])


def test_limited_botanigard_fungicide():
    j = check(BOTANIGARD, MANCOZEB)
    assert j["status"] == "limited"
    assert j["findings"][0]["rule_id"] == "botanigard_fungicides_limited"
    assert "may kill the spores" in j["findings"][0]["scope"]


def test_no_evidence_two_known_bios():
    j = check("Trianum-P. Trichoderma harzianum T-22. Beneficial fungi for soil borne diseases.",
              "DiPel DF Biological Insecticide. Bacillus thuringiensis subsp. kurstaki. For caterpillar pests.")
    assert j["status"] == "no_evidence" and j["reason"] == "no_pair_evidence"
    assert j["product_a"]["product"]["id"] == "trianum_p"
    assert j["product_b"]["product"]["id"] == "dipel_df"


def test_unknown_first_product_abstains():
    j = check(SOAP, TILT)
    assert j["status"] == "no_evidence" and j["reason"] == "product_a_unknown"
    assert j["product_a"]["product"] is None


def test_unknown_second_product_abstains():
    j = check(T34, "Plain well water with a little dissolved urea fertiliser for the field channel.")
    assert j["status"] == "no_evidence" and j["reason"] == "product_b_unknown"


def test_expiry_extracted_and_flagged():
    j = check(T34, TILT + " Expiry date: 08/2024")
    exp = j["product_b"]["expiry"]
    assert exp["raw"] == "08/2024" and exp["expired"] is True


def test_formulation_extracted():
    j = check(T34, TILT)
    assert j["product_b"]["formulation"] == "EC"


def test_no_mixing_advice_in_response():
    j = check(T34, TILT)
    blob = json.dumps(j).lower()
    for banned in ("spray after", "wait 3 days between", "add 2 ml", "mix ratio"):
        assert banned not in blob
    assert "never recommends" in blob


def test_short_text_rejected():
    assert client.post("/api/mixcheck", json={"text_a": "hi", "text_b": "x" * 40}).status_code == 422


def test_every_rule_and_product_source_is_real_link():
    for rule in PAIRS["rules"]:
        assert rule["source"]["url"].startswith("http")
        assert rule["verdict"] in ("conflict", "limited")


def test_duplicate_recognised_product_is_not_pair_evidence():
    j = check("DiPel DF biological insecticide for caterpillars.",
              "DiPel DF biological insecticide, Bacillus thuringiensis.")
    assert j["status"] == "same_product"
    assert j["reason"] == "duplicate_product"
    assert j["findings"] == []


def test_identical_unrecognised_labels_are_duplicates():
    j = check(SOAP, SOAP)
    assert j["status"] == "same_product"


def test_reversing_pair_retains_second_label_prohibition():
    for a,b in [(T34,TILT), ("BlightBan A506 biological fungicide Pseudomonas fluorescens.",COPPER)]:
        forward, reverse = check(a,b), check(b,a)
        assert forward["status"] == reverse["status"] == "conflict"
        assert {x["rule_id"] for x in forward["findings"]} == {x["rule_id"] for x in reverse["findings"]}


def test_rules_on_both_labels_checked_without_duplicates():
    j = check("T34 Biocontrol biological fungicide Trichoderma asperellum.",
              "BotaniGard ES biological insecticide Beauveria bassiana.")
    ids=[f["rule_id"] for f in j["findings"]]
    assert j["status"] == "conflict"
    assert "t34_no_tank_mix" in ids and "botanigard_fungicides_limited" in ids
    assert len(ids)==len(set(ids))
