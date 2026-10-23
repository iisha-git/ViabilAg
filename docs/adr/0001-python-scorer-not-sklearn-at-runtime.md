# 0001 Pure-Python scorer instead of scikit-learn at runtime
Date: 2026-10-20. Status: accepted

## Context
The model is TF-IDF + logistic regression. scikit-learn is heavy to install and slow to start on free hosts. The browser also needs the same model.

## Decision
Train with scikit-learn (`ml/train.py`), export weights to `ml/artifacts/model.json`, and score with a few lines of plain Python (backend) and JavaScript (browser fallback).

## Consequences
Small install, fast start, one model file for both sides. Cost: two scorers to keep identical. `backend/tests/test_parity.py` and `scripts/check_parity.mjs` guard this. If we move to a model that cannot be exported to JSON, revisit.
