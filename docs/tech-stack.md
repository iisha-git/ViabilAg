# Tech stack and why

| Choice | Why |
|---|---|
| Plain HTML/CSS/JS, no framework | One file to open, nothing to install or build, easy for a student team and for AI agents to read. See ADR 0002. |
| FastAPI | Typed, small, auto-generated `/docs`, async for the weather call. |
| Python scorer instead of scikit-learn at runtime | A tiny dependency list and fast cold starts on free hosts. See ADR 0001. |
| tesseract.js (browser OCR) | No server needed, works on static hosting. Server OCR (pytesseract) exists as a fallback. |
| Open-Meteo | Free, no API key. |
| JSON/CSV files, no database | The content is small and edited by people; git is the history. See ADR 0003. |
| Self-hosted fonts (Fraunces, Inter) | Works offline, no third-party requests, SIL OFL licensed. |

## Versions in use
Python 3.10+ (developed on 3.10; Docker image uses 3.11), FastAPI >= 0.110, Uvicorn >= 0.29, httpx >= 0.27, scikit-learn >= 1.4 (training only), tesseract.js 5 (CDN), tesseract 4/5 program (server OCR only).
