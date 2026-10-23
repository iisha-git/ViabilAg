.PHONY: setup dev test train sync parity
PY ?= python3

setup:            ## create .venv and install backend + dev deps
	$(PY) -m venv .venv && . .venv/bin/activate && pip install -r backend/requirements-dev.txt

dev:              ## run API + website on http://localhost:8000
	uvicorn backend.app.main:app --reload --port 8000

test:             ## backend tests
	$(PY) -m pytest -q backend

train:            ## retrain the model from data/ and refresh the browser copy
	$(PY) ml/train.py && $(PY) scripts/sync_static.py

sync:             ## copy data files to frontend/assets/data (static mode)
	$(PY) scripts/sync_static.py

parity:           ## browser scorer vs backend (backend must be running)
	node scripts/check_parity.mjs
