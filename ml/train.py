#!/usr/bin/env python3
"""Train the bioOasis label-type classifier.

Reads data/sources.csv + data/raw/<doc_id>.txt (real public label/product text).
Trains TF-IDF + multinomial logistic regression, evaluates honestly on
(1) a stratified hold-out split and (2) leave-one-out cross-validation,
and exports ml/artifacts/model.json, scored by the backend (Python) and the browser fallback (JS).
"""
import csv, json, re, os
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split, LeaveOneOut
from sklearn.metrics import classification_report, confusion_matrix

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
RAW = os.path.join(ROOT, "data", "raw")

def clean(text):
    # strip web_fetch header lines like "[1] Title — domain" and bare URL lines
    lines = [l for l in text.splitlines()
             if not re.match(r"^\s*\[\d+\]", l) and not re.match(r"^\s*https?://\S+\s*$", l)]
    t = "\n".join(lines).replace("\x0c", " ")
    t = re.sub(r"[ \t]+", " ", t)
    return t.strip()

docs, labels, ids = [], [], []
with open(os.path.join(ROOT, "data", "sources.csv")) as f:
    for row in csv.DictReader(f):
        p = os.path.join(RAW, row["doc_id"] + ".txt")
        t = clean(open(p, encoding="utf-8", errors="ignore").read())
        if len(t) < 200:
            print("SKIP (too short):", row["doc_id"]); continue
        docs.append(t[:12000]); labels.append(row["class"]); ids.append(row["doc_id"])
print(f"{len(docs)} documents, classes:", {c: labels.count(c) for c in sorted(set(labels))})

vec = TfidfVectorizer(lowercase=True, ngram_range=(1, 2), min_df=2, sublinear_tf=True)
X = vec.fit_transform(docs)
y = np.array(labels)

# --- honest evaluation -----------------------------------------------------
def fresh_model():
    return LogisticRegression(max_iter=2000, C=12.0)

# 1) stratified hold-out (documents, never chunks of the same document)
Xtr, Xte, ytr, yte, itr, ite = train_test_split(
    X, y, np.arange(len(y)), test_size=0.25, random_state=42, stratify=y)
m = fresh_model().fit(Xtr, ytr)
holdout_pred = m.predict(Xte)
holdout_prob = m.predict_proba(Xte).max(axis=1)
holdout_acc = float((holdout_pred == yte).mean())
print("\n=== Stratified hold-out (25% of documents) ===")
print("accuracy:", round(holdout_acc, 3))
print(classification_report(yte, holdout_pred, zero_division=0))
for i, p, pr in zip(ite, holdout_pred, holdout_prob):
    mark = "ok " if p == y[i] else "MISS"
    print(f"  [{mark}] {ids[i]:24s} true={y[i]:12s} pred={p:12s} maxprob={pr:.2f}")

# 2) leave-one-out cross-validation
loo_pred, loo_prob = np.empty_like(y), np.zeros(len(y))
for tr, te in LeaveOneOut().split(X):
    mm = fresh_model().fit(X[tr], y[tr])
    loo_pred[te] = mm.predict(X[te])
    loo_prob[te] = mm.predict_proba(X[te]).max()
loo_acc = float((loo_pred == y).mean())
print("\n=== Leave-one-out cross-validation ===")
print("accuracy:", round(loo_acc, 3))
print(confusion_matrix(y, loo_pred, labels=sorted(set(y))))

# --- final model on all data, exported for the web app ----------------------
final = fresh_model().fit(X, y)
model = {
    "classes": final.classes_.tolist(),
    "vocabulary": {k: int(v) for k, v in vec.vocabulary_.items()},
    "idf": vec.idf_.tolist(),
    "coef": final.coef_.tolist(),
    "intercept": final.intercept_.tolist(),
    "threshold": 0.45,
    "meta": {
        "n_documents": len(docs),
        "holdout_accuracy": holdout_acc,
        "loo_accuracy": loo_acc,
        "note": "Trained on real public label/product text only (see sources.csv).",
    },
}
out = os.path.join(HERE, "artifacts", "model.json")
json.dump(model, open(out, "w"))
print("\nwrote", out, os.path.getsize(out), "bytes")

with open(os.path.join(HERE, "artifacts", "metrics.json"), "w") as f:
    json.dump({"holdout_accuracy": holdout_acc, "loo_accuracy": loo_acc,
               "n_documents": len(docs),
               "class_counts": {c: labels.count(c) for c in sorted(set(labels))},
               "holdout": [{"doc": ids[i], "true": y[i], "pred": p, "maxprob": round(float(pr),3)}
                           for i, p, pr in zip(ite, holdout_pred, holdout_prob)],
               "loo": [{"doc": ids[i], "true": y[i], "pred": p, "maxprob": round(float(pr),3)}
                       for i, (p, pr) in enumerate(zip(loo_pred, loo_prob))]}, f, indent=2)
