# Development guide

## Daily loop
1. `uvicorn backend.app.main:app --reload --port 8000` (API + website, auto-reload for Python; refresh the browser for frontend changes).
2. Edit. Test on a phone-sized window (390 px) and a desktop window.
3. `python3 -m pytest -q backend`.

## Testing on a real phone
Geolocation and camera access need **HTTPS** (or `localhost`). Opening `http://<laptop-ip>:8000` on a phone will load the site but the browser blocks "Use my location". To test on a phone use a deployed HTTPS URL (`docs/deployment.md`) or a tunnel such as `cloudflared tunnel --url http://localhost:8000`.
Photo upload (the file picker / camera) works over plain HTTP; only location needs HTTPS.

## Tests
- `backend/tests/test_api.py` - endpoints, abstain, pH bands, OCR (skipped if tesseract is missing)
- `backend/tests/test_parity.py` - Python scorer equals scikit-learn (skipped if scikit-learn is missing)
- `scripts/check_parity.mjs` - browser scorer equals backend
- `scripts/check_speech_wire.mjs` - the Android speech bridge and Dew agree on the message format

## Adding things
- **Endpoint:** route in `main.py`, logic in `services/`, schema in `schemas.py`, test, `docs/api.md`.
- **Screen/section:** markup in `frontend/index.html`, behaviour in `src/js/main.js`, styles in `src/styles/components.css`.
- **Evidence claim:** `data/evidence/evidence.json` (needs source), then `python3 scripts/sync_static.py`.
- **Product type:** see `docs/data-and-ml.md`.

## Troubleshooting
| Problem | Fix |
|---|---|
| Blank page, console says it could not load JSON | Open through a server (`http://localhost:8000`), not by double-clicking the file |
| "Static mode" shows in the footer | The backend was not found. Start uvicorn, or ignore: static mode is a supported fallback |
| Photo reading says it cannot read | The reader downloads once (needs internet). Type the text instead, or use the Docker deploy (server OCR) |
| Location button does nothing | Needs HTTPS or localhost, and the user must allow location |
| `ModuleNotFoundError: backend` | Run uvicorn from the project root, not from `backend/` |
