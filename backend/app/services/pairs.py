"""Product-pair mix check: identify both products from label text, then apply
curated, cited pair rules. Never invents compatibility; abstains honestly."""
import json
import re
from datetime import date
from functools import lru_cache

from .. import config

PAIRS_PATH = config.ROOT / "data" / "evidence" / "pairs.json"

PESTICIDE_WORDS = re.compile(
    r"\b(fungicide|insecticide|herbicide|pesticide|miticide|acaricide|bactericide|nematicide|"
    r"weedicide|larvicide|molluscicide|rodenticide)\b", re.I)

FORMULATIONS = ["WDG", "WSG", "WP", "WG", "ESO", "ES", "EC", "EW", "SC", "SE", "SL", "OD", "DF", "GR"]
_FORMULATION_RE = re.compile(r"\b(" + "|".join(FORMULATIONS) + r")\b")

_MONTHS = {m: i + 1 for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}
_EXPIRY_RE = re.compile(
    r"(?:expiry|expiration|expires|exp\.?|use\s*(?:by|before)|best\s*before|not\s*to\s*be\s*used\s*after)"
    r"\s*(?:date)?\s*[:\-]?\s*"
    r"(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}"
    r"|\d{1,2}[\/\-.]\d{4}"
    r"|\d{1,2}\s+[A-Za-z]{3,9}\.?\s*,?\s*\d{2,4}"
    r"|[A-Za-z]{3,9}\.?\s*\d{4})",
    re.I)


@lru_cache(maxsize=1)
def _pairs() -> dict:
    with open(PAIRS_PATH, encoding="utf-8") as f:
        return json.load(f)


def _word_hit(text: str, needle: str) -> bool:
    return re.search(r"(?<!\w)" + re.escape(needle.lower()) + r"(?!\w)", text.lower()) is not None


def identify_product(text: str) -> dict | None:
    """Match label text against the curated product registry by exact product
    names only. Longest fingerprint wins; ties go to the first match."""
    best, best_len = None, 0
    for pid, p in _pairs()["products"].items():
        for fp in p["fingerprints"]:
            if len(fp) > best_len and _word_hit(text, fp):
                best, best_len = (pid, p), len(fp)
    if not best:
        return None
    pid, p = best
    return {"id": pid, "name": p["name"], "class": p["class"], "kind": p["kind"],
            "organism": p["organism"]}


def detect_actives(text: str) -> list[dict]:
    out = []
    for aid, a in _pairs()["active_ingredients"].items():
        if any(_word_hit(text, n) for n in a["names"]):
            out.append({"id": aid, "name": a["display"], "type": a["type"]})
    return out


def detect_categories(text: str, actives: list[dict]) -> list[str]:
    cats = {a["type"] for a in actives}
    for c in ("fungicide", "insecticide", "herbicide"):
        if _word_hit(text, c):
            cats.add(c)
    return sorted(cats)


def extract_formulation(text: str) -> str | None:
    m = _FORMULATION_RE.search(text)
    return m.group(1) if m else None


def _parse_expiry(raw: str) -> date | None:
    s = raw.strip().replace(",", "")
    m = re.fullmatch(r"(\d{1,2})[\/\-.](\d{4})", s)
    if m:  # MM/YYYY
        mo, y = int(m.group(1)), int(m.group(2))
        if 1 <= mo <= 12:
            return date(y, mo, 1)
        return None
    m = re.fullmatch(r"(\d{1,2})[\/\-.](\d{4})", s)
    if m:  # MM/YYYY
        mo, y = int(m.group(1)), int(m.group(2))
        return date(y, mo, 1) if 1 <= mo <= 12 else None
    m = re.fullmatch(r"(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})", s)
    if m:
        a, b, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        y = y + 2000 if y < 100 else y
        # Prefer month-first; if the first number cannot be a month, treat as day-first.
        mo, d = (a, b) if a <= 12 else (b, a)
        try:
            return date(y, mo, min(d, 28))
        except ValueError:
            return None
    m = re.fullmatch(r"(\d{1,2})\s+([A-Za-z]{3,9})\.?\s*(\d{2,4})", s)
    if m:
        mo = _MONTHS.get(m.group(2)[:3].lower())
        y = int(m.group(3)); y = y + 2000 if y < 100 else y
        if mo:
            return date(y, mo, 1)
    m = re.fullmatch(r"([A-Za-z]{3,9})\.?\s*(\d{4})", s)
    if m:
        mo = _MONTHS.get(m.group(1)[:3].lower())
        if mo:
            return date(int(m.group(2)), mo, 1)
    return None


def extract_expiry(text: str) -> dict | None:
    m = _EXPIRY_RE.search(text)
    if not m:
        return None
    raw = m.group(1)
    d = _parse_expiry(raw)
    return {"raw": raw, "iso": d.isoformat() if d else None,
            "expired": (d < date.today()) if d else None}


def describe_product(text: str) -> dict:
    return {"product": identify_product(text),
            "actives": detect_actives(text),
            "categories": detect_categories(text, detect_actives(text)),
            "formulation": extract_formulation(text),
            "expiry": extract_expiry(text),
            "looks_like_pesticide": bool(PESTICIDE_WORDS.search(text))}


def _other_matches(rule_other: dict, b: dict) -> str | None:
    """Return a short description of what matched on product B, or None."""
    kind = rule_other["kind"]
    if kind == "any_pesticide":
        if b["actives"]:
            return b["actives"][0]["name"]
        if b["looks_like_pesticide"] or b["product"]:
            return "a pesticide"
        return None
    if kind == "category":
        c = rule_other["category"]
        return c if c in b["categories"] else None
    if kind == "active_ingredient":
        for a in b["actives"]:
            if a["id"] in rule_other["any_of"]:
                return a["name"]
    return None


def mix_check(text_a: str, text_b: str) -> dict:
    a, b = describe_product(text_a), describe_product(text_b)
    findings = []
    if a["product"]:
        for rule in _pairs()["rules"]:
            if a["product"]["id"] not in rule["bio"]:
                continue
            hit = _other_matches(rule["other"], b)
            if hit:
                findings.append({"rule_id": rule["id"], "verdict": rule["verdict"],
                                 "headline": rule["headline"].replace("{ai}", hit),
                                 "scope": rule["scope"], "what_tested": rule["what_tested"],
                                 "source": rule["source"]})
    if any(f["verdict"] == "conflict" for f in findings):
        status = "conflict"
    elif findings:
        status = "limited"
    else:
        status = "no_evidence"
    if not a["product"]:
        reason = "product_a_unknown"
    elif status != "no_evidence":
        reason = None
    elif b["product"]:
        reason = "no_pair_evidence"
    elif b["actives"] or b["looks_like_pesticide"]:
        reason = "no_pair_evidence"
    else:
        reason = "product_b_unknown"
    return {"status": status, "reason": reason,
            "product_a": a, "product_b": b, "findings": findings,
            "disclaimer": ("Product matches come from the words on the scanned labels, not from a "
                           "product database or a lab test. Compatibility findings are product-specific. "
                           "bioOasis never recommends doses, mixing recipes or spray timings.")}
