# AGENTS.md - context for AI coding agents (Antigravity and others)

Read this first. It is short on purpose. Deeper detail is in `ARCHITECTURE.md` and `docs/`.

## What this project is
bioOasis: a mobile-first web app. A farmer photographs a **biological spray** label (living-organism product). The app reads it (OCR), a small ML model names the product type (Bt, Trichoderma, Pseudomonas, Beauveria), and the app shows **cited evidence** about keeping the organisms alive. If unsure it stops and says "ask an agronomist".

## Stack (exact)
- Frontend: plain HTML/CSS/JS ES modules in `frontend/`. **No framework, no bundler, no build step.**
- Backend: Python 3.10+, FastAPI, Uvicorn in `backend/`.
- ML: scikit-learn training in `ml/train.py`; serving is a plain Python/JS scorer reading `ml/artifacts/model.json`.
- Content: JSON/CSV in `data/`. No database.

## Commands
```
pip install -r backend/requirements-dev.txt
uvicorn backend.app.main:app --reload --port 8000     # app + API at http://localhost:8000
python3 -m pytest -q backend                          # tests (must pass)
python3 ml/train.py && python3 scripts/sync_static.py # after changing data/ or the model
node scripts/check_parity.mjs                         # browser scorer == backend (backend running)
```

## Where things live
| Need | Path |
|---|---|
| Routes | `backend/app/main.py` (keep thin) |
| Logic | `backend/app/services/*.py` |
| Evidence claims and rules | `data/evidence/evidence.json`, `rules.json` |
| Screens and behaviour | `frontend/src/js/main.js` |
| Browser fallback of the backend | `frontend/src/js/model.js` |
| Look and feel | `frontend/src/styles/tokens.css` (+ `docs/design-system.md`) |

## Hard rules (do not break)
1. **Never invent facts.** Every evidence claim needs a real source name + URL. Never output a survival rate or any accuracy number that `ml/train.py` did not measure.
2. **Abstain when unsure** (probability below `threshold` in `model.json`).
3. **Content lives in `data/`**, not hard-coded in JS or Python.
4. Keep the Python scorer and `frontend/src/js/model.js` identical in behaviour; run the parity check after touching either.
5. Photos must be licensed and listed in `frontend/assets/images/credits.json`. The mascot "Dew" and icons are original SVG.
6. UX principle: **progressive disclosure.** Short answer first; details one tap away (tabs, sheets). Never hide information permanently.
7. Update `docs/` and `CHANGELOG.md` when behaviour changes. Add or update tests with any backend change.

## Style
Python: type hints, small functions. JS: ES modules, no frameworks, no new dependencies without an ADR in `docs/adr/`. CSS: use tokens, no hard-coded colours. Writing: plain, short sentences, no hype.

Scoped rules for Antigravity live in `.agents/rules/`.
