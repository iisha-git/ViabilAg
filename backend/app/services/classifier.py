"""Label-type classifier: TF-IDF + logistic regression, scored in plain Python.

The model is trained by ml/train.py (scikit-learn) and exported to
ml/artifacts/model.json. The backend only needs the JSON file, so scikit-learn
is NOT a runtime dependency. The browser fallback in frontend/src/js/model.js
implements the same math; tests/test_parity.py checks they agree.
"""
import json
import math
import re
from collections import Counter
from functools import lru_cache

from .. import config

# Same token rule as scikit-learn's default TfidfVectorizer.
_TOKEN = re.compile(r"(?u)\b\w\w+\b")


@lru_cache(maxsize=1)
def load_model() -> dict:
    with open(config.MODEL_PATH, encoding="utf-8") as f:
        return json.load(f)


def _features(text: str) -> list[str]:
    toks = _TOKEN.findall(text.lower())
    return toks + [f"{a} {b}" for a, b in zip(toks, toks[1:])]


_FALLBACK_ORGANISM_TERMS = {
    "bt": ["bacillus thuringiensis", "thuringiensis", "kurstaki", "aizawai", "israelensis", "galleriae", "tenebrionis"],
    "trichoderma": ["trichoderma", "harzianum", "viride", "asperellum"],
    "pseudomonas": ["pseudomonas", "fluorescens", "chlororaphis"],
    "beauveria": ["beauveria", "bassiana"],
}


def _classes_named(model: dict, text: str) -> set:
    terms = model.get("organism_terms") or _FALLBACK_ORGANISM_TERMS
    tl = text.lower()
    named = set()
    for c, ts in terms.items():
        if any(re.search(r"\b" + re.escape(t) + r"\b", tl) for t in ts):
            named.add(c)
    return named


def _organism_evidence(model: dict, cls: str, text: str) -> bool:
    """Organism-evidence gate: the scanned text must literally name the predicted
    group's organism (word-boundary match), otherwise the app abstains. This stops
    unsupported or mismatched products from being shown as a known group. Keep in
    sync with ml/train.py ORGANISM_TERMS and frontend/src/js/model.js."""
    named = _classes_named(model, text)
    if len(named) > 1:
        return False  # mixed-organism label: abstain instead of picking one
    return cls in named


def predict(text: str) -> dict:
    """Return probabilities for every class plus the abstain decision."""
    m = load_model()
    counts = Counter(f for f in _features(text) if f in m["vocabulary"])
    x = {m["vocabulary"][f]: (1 + math.log(c)) * m["idf"][m["vocabulary"][f]] for f, c in counts.items()}
    norm = math.sqrt(sum(v * v for v in x.values())) or 1.0
    logits = []
    for ci in range(len(m["classes"])):
        s = m["intercept"][ci]
        coef = m["coef"][ci]
        for i, v in x.items():
            s += (v / norm) * coef[i]
        logits.append(s)
    mx = max(logits)
    exps = [math.exp(l - mx) for l in logits]
    total = sum(exps)
    probs = [e / total for e in exps]
    ranked = sorted(zip(m["classes"], probs), key=lambda t: -t[1])
    best_cls, best_p = ranked[0]
    abstain = best_p < m["threshold"] or not _organism_evidence(m, best_cls, text)
    return {
        "class": best_cls,
        "probability": best_p,
        "threshold": m["threshold"],
        "abstain": abstain,
        "ranking": [{"class": c, "probability": p} for c, p in ranked],
        "known_terms": len(counts),
    }


def model_info() -> dict:
    return load_model()["meta"] | {"threshold": load_model()["threshold"], "classes": load_model()["classes"]}
