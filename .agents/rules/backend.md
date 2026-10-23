---
trigger: glob
globs: "backend/**/*.py, ml/**/*.py"
description: Python backend and ML conventions
---
- FastAPI routes stay thin in `backend/app/main.py`; logic goes in `backend/app/services/`.
- Validate input with pydantic models in `backend/app/schemas.py`.
- The backend serves the model from `ml/artifacts/model.json` in pure Python. Do not import scikit-learn in `backend/app`.
- Every endpoint change needs a test in `backend/tests/` and an update to `docs/api.md`.
- Run `python3 -m pytest -q backend`.
