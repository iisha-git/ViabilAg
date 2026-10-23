# Architecture

This file explains how bioOasis is organised, how a request flows through it, and the rules that keep it tidy. It is the single place to understand the structure.

## The idea in one line

**Label text in -> product type + cited evidence out. When unsure, stop.**

## Layout and responsibilities

```
bioOasis/
├── frontend/                 WHAT THE USER SEES. No business rules here.
│   ├── index.html            single page, 4 views: home, read, result, stop
│   ├── src/js/               main.js (screens), api.js (talks to backend),
│   │                         model.js (browser fallback), ocr.js, mascot.js, icons.js
│   ├── src/styles/           tokens.css (design tokens), base, components, animations
│   └── assets/               images/ (+credits.json), fonts/, data/ (copy for static mode)
├── backend/                  THE API. Owns all decisions.
│   ├── app/main.py           routes only (thin)
│   ├── app/schemas.py        request validation
│   ├── app/config.py         paths + settings (env vars)
│   ├── app/services/         classifier.py, evidence.py, weather.py, ocr.py
│   └── tests/                pytest
├── ml/                       TRAINING. Offline, run by a person.
│   ├── train.py              reads data/ -> writes ml/artifacts/
│   └── artifacts/            model.json, metrics.json (committed, small)
├── data/                     SOURCE OF TRUTH FOR CONTENT.
│   ├── raw/                  real label/product texts (+ some PDFs)
│   ├── sources.csv           every document: id, class, title, URL
│   ├── evidence/             evidence.json (cited claims), rules.json (pH, weather rules)
│   └── samples.json          the 4 demo label excerpts
├── docs/                     guides, API reference, ADRs
└── scripts/                  sync_static.py, check_parity.mjs
```

### The one-direction rule

`data/` and `ml/` produce files -> `backend/` reads them -> `frontend/` calls the backend.
The frontend never imports from `backend/` or `ml/`. The backend never imports from `ml/` code (it only reads `ml/artifacts/model.json`). This is why scikit-learn is not needed to run the app.

## Request flow

```
 photo ──> OCR (browser: tesseract.js)  ──> label text (user can edit)
                                               │
                         POST /api/analyze {text, ph?, lat?, lon?}
                                               │
        ┌──────────────────────────────────────┴───────────────────────┐
        │ backend                                                       │
        │ 1 classifier.predict(text)   TF-IDF + logistic regression     │
        │ 2 probability < threshold?   ──yes──> {status:"abstain"}  ────┼──> STOP screen
        │ 3 evidence.for_class(cls)    cited claims from data/evidence  │
        │ 4 conditions: pH advice (rules.json) + weather (Open-Meteo)   │
        └───────────────────────────────────────────────────────────────┘
                                               │
                                       {status:"found", prediction, evidence, common, conditions}
                                               │
                                          RESULT screen
```

If there is no backend, `frontend/src/js/model.js` does steps 1-4 in the browser from `frontend/assets/data/*.json` (static mode). `scripts/check_parity.mjs` proves both give the same probabilities.

## Rules that must not be broken

1. **No claim without a source.** Every fact in `data/evidence/` has a source name and URL. The UI shows it next to the claim.
2. **No fabricated numbers.** The app never outputs survival rates or accuracy beyond what `ml/train.py` measured.
3. **Abstain below the threshold** (`threshold` in `model.json`, currently 0.45).
4. **Content lives in `data/`**, not in code. To change a claim, edit JSON, not JS or Python.
5. **Thresholds that are ours** (UV >= 6, temperature >= 35 C) are marked `app_threshold` in `rules.json` so nobody mistakes them for numbers from a paper.

## Where do I change X?

| I want to... | Edit |
|---|---|
| change wording or a source of an evidence card | `data/evidence/evidence.json`, then `python3 scripts/sync_static.py` |
| add a product type (class) | `data/` (texts + sources.csv + evidence), retrain, see `docs/data-and-ml.md` |
| change the look | `frontend/src/styles/tokens.css` first, then components.css |
| add an API endpoint | `backend/app/main.py` (route) + a function in `backend/app/services/` + a test + `docs/api.md` |
| change the abstain threshold | `threshold` in `ml/train.py`, retrain |

## Known limits

- Tiny training set (26 documents). See `docs/data-and-ml.md`.
- The Python and JS tokenizers match for ASCII text; non-ASCII letters may tokenize differently (JS `\w` is ASCII only).
- OCR quality depends on the photo; the user can always edit the text.
- No database, no user accounts, no history. Nothing is stored.
