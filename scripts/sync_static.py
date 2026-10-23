#!/usr/bin/env python3
"""Copy the data files the browser fallback needs into frontend/assets/data/.

Run after you retrain the model or edit evidence/rules/samples:
    python3 scripts/sync_static.py
Needed for static hosting (GitHub Pages etc.), where there is no backend.
"""
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "frontend" / "assets" / "data"
DEST.mkdir(parents=True, exist_ok=True)
FILES = {
    ROOT / "ml" / "artifacts" / "model.json": "model.json",
    ROOT / "ml" / "artifacts" / "metrics.json": "metrics.json",
    ROOT / "data" / "evidence" / "evidence.json": "evidence.json",
    ROOT / "data" / "evidence" / "rules.json": "rules.json",
    ROOT / "data" / "evidence" / "pairs.json": "pairs.json",
    ROOT / "data" / "samples.json": "samples.json",
}
for src, name in FILES.items():
    shutil.copyfile(src, DEST / name)
    print("copied", src.relative_to(ROOT), "->", (DEST / name).relative_to(ROOT))
