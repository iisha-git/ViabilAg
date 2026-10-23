"""The Python scorer must reproduce scikit-learn's probabilities."""
import csv
import re
from pathlib import Path

import pytest

sk = pytest.importorskip("sklearn")
from sklearn.feature_extraction.text import TfidfVectorizer  # noqa: E402
from sklearn.linear_model import LogisticRegression  # noqa: E402

from backend.app.services import classifier  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]


def _clean(text):
    lines = [l for l in text.splitlines()
             if not re.match(r"^\s*\[\d+\]", l) and not re.match(r"^\s*https?://\S+\s*$", l)]
    return re.sub(r"[ \t]+", " ", "\n".join(lines).replace("\x0c", " ")).strip()


def test_matches_sklearn_on_training_docs():
    docs, labels = [], []
    for row in csv.DictReader(open(ROOT / "data" / "sources.csv")):
        t = _clean(open(ROOT / "data" / "raw" / (row["doc_id"] + ".txt"), encoding="utf-8", errors="ignore").read())
        if len(t) >= 200:
            docs.append(t[:12000]); labels.append(row["class"])
    vec = TfidfVectorizer(lowercase=True, ngram_range=(1, 2), min_df=2, sublinear_tf=True)
    X = vec.fit_transform(docs)
    clf = LogisticRegression(max_iter=2000, C=12.0).fit(X, labels)
    for i in range(0, len(docs), 5):
        want = dict(zip(clf.classes_, clf.predict_proba(X[i])[0]))
        got = {r["class"]: r["probability"] for r in classifier.predict(docs[i])["ranking"]}
        for c in want:
            assert abs(want[c] - got[c]) < 1e-6
