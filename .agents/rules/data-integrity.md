---
trigger: always_on
description: Evidence and data integrity rules
---
- Each claim in `data/evidence/evidence.json` has `source.name` and `source.url` pointing to a real page you have opened.
- Training texts in `data/raw/` come from real public labels and are listed in `data/sources.csv`.
- Our own cut-offs in `data/evidence/rules.json` are marked `app_threshold`; never present them as numbers from a paper.
- After editing `data/` or retraining run `python3 scripts/sync_static.py`.
