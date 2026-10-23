# Contributing

Thanks for helping. This is a small student project, so the rules are short.

## Setup
Follow "Quick start" in `README.md`, then `pip install -r backend/requirements-dev.txt`.

## Before you open a pull request
1. `python3 -m pytest -q backend` passes.
2. If you touched `ml/`, `data/` or `frontend/src/js/model.js`: run `python3 scripts/sync_static.py`, start the backend and run `node scripts/check_parity.mjs`.
3. If you changed behaviour, update the matching file in `docs/` and add a line to `CHANGELOG.md`.
4. Look at the result in a browser at phone width (390 px) and at desktop width.

## Conventions
- **Branches:** `feat/short-name`, `fix/short-name`, `docs/short-name`.
- **Commits:** short, present tense: `Add pH band for acidic water`.
- **Python:** type hints, small functions, routes thin and logic in `backend/app/services/`. Format with `black` if you have it.
- **JavaScript:** ES modules, no framework, no build step. Keep one concern per file.
- **CSS:** use tokens from `tokens.css` (no hard-coded colours in components).
- **Docs:** plain, short sentences.

## Content rules (important)
- Every evidence claim needs a real source with a working URL, added in `data/evidence/evidence.json`.
- Add training texts only from real, public labels, and record them in `data/sources.csv`.
- Never invent a statistic, accuracy or survival number. If `ml/train.py` did not print it, do not write it.
- Photos need a license that allows reuse; add them to `frontend/assets/images/credits.json`.

## Reporting problems
Open an issue with: what you did, what you expected, what happened, browser/OS. For security problems, please report them privately to the repository owner instead of opening a public issue.
