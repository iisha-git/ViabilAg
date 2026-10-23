# bioOasis

> **Will it survive?** Check a biological spray before it goes in the tank, not after it fails.

bioOasis helps a farmer check a **biological spray** (a product made of living organisms, such as Bt, Trichoderma, Pseudomonas or Beauveria). You photograph the product label. The app reads it, works out what type of product it is, and shows what real labels and published research say about keeping those organisms alive, with the **source next to every line**. If it is not sure, it says so and sends you to an agronomist.

Team ViabilAg - college AI project. Status: **early prototype (v0.5)**.

## What's new in 0.6.0

Mix check (scan two labels, get a cited conflict / thin-evidence / honest
"can't confirm" answer plus a takeaway slip for your dealer), Dew chat
(English/Hindi/Marathi, typed or spoken, answers only from the app's cited
data), soft optional sounds, and a real Android app (`android/`, see
android/README.md).

## What is real and what is not (read this first)

| Part | Status |
|---|---|
| Label reading (OCR) | Real. Runs in the browser (tesseract.js). Optional server OCR in the backend. |
| Product-type model | Real but small: TF-IDF + logistic regression, trained on **26 real public label/product texts** (4 classes). Leave-one-out accuracy **88.5%**, one hold-out split **71.4%**. This says "learns the 4 types from label text", **not** "recognizes every product in a shop". |
| Evidence cards | Real. Every claim is a statement from a cited source (EPA/CDMS labels, manufacturer pages, NPIC, UF/IFAS, peer-reviewed papers). Nothing is generated. |
| Survival prediction | **Does not exist.** bioOasis never outputs a survival number. That would need lab data we do not have. See `docs/roadmap.md`. |
| Backend | Real (FastAPI). The v0.1 prototype was frontend-only; v0.2 adds the API. |
| Photos | Real photos from Wikimedia Commons with licenses, credited in the app and in `docs/credits.md`. They illustrate the organism type, not the product. |

## Quick start (about 3 minutes)

Needs **Python 3.10+**. No Node, no build step.

```bash
# from the project root
python3 -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload --port 8000
```

Open <http://localhost:8000> on the laptop. (On a phone, "Use my location" needs HTTPS: deploy it, see `docs/deployment.md`.) The same server runs the API (`/api/...`, docs at <http://localhost:8000/docs>) and the website.

No product photo? Tap one of the 4 real label samples on the home screen, or open `http://localhost:8000/#demo-0` (to `#demo-3`).

Internet is needed for: the OCR reader's first download (from a CDN), and the weather lookup.

Shortcuts: `make setup`, `make dev`, `make test`, `make train` (see `Makefile`).

### Look and feel
Three themes (Settings on the home screen), a real desktop layout on wide screens, and it is an installable app (PWA): on a served https site, use "Add to Home Screen" / the browser's install icon. The app shell then opens full screen and loads faster; the service worker caches only public app files, never photos, answers or location (see `SECURITY.md`).

### No backend? Static mode

The frontend also works on its own. If it cannot find the API, it runs the same model in the browser. To try it: `cd frontend && python3 -m http.server 8080` and open <http://localhost:8080>. This is also how you host it on GitHub Pages (see `docs/deployment.md`).

## Tech stack (exact)

| Layer | Choice |
|---|---|
| Frontend | Plain HTML, CSS and JavaScript (ES modules). **No framework, no build step.** Three themes (Settings sheet, saved on the device only), self-hosted OFL fonts. |
| OCR | tesseract.js v5 in the browser (loaded from jsDelivr CDN); optional `pytesseract` + the `tesseract` program on the server |
| Backend | Python 3.10+, FastAPI, Uvicorn, httpx, python-multipart (`backend/requirements.txt`) |
| ML (training) | scikit-learn (TfidfVectorizer + LogisticRegression), NumPy (`ml/requirements.txt`) |
| ML (serving) | Plain Python / JavaScript scorer reading `ml/artifacts/model.json`. scikit-learn is **not** needed to run the app. |
| Data | JSON and CSV files in `data/` (no database yet; see `docs/adr/0003-no-database-yet.md`) |
| Weather | Open-Meteo API (free, no key) |
| Tests | pytest (`backend/tests/`), plus `scripts/check_parity.mjs` (Node) |

Details and reasons: [`docs/tech-stack.md`](docs/tech-stack.md).

## Project structure

```
frontend/   the website (what the user sees)
backend/    the API (FastAPI) and its tests
ml/         model training + the trained model file
data/       real label texts, sources, evidence cards, samples
docs/       guides, API reference, decisions (docs/adr/)
scripts/    helper scripts (sync, parity check)
.agents/    rules for Antigravity (see AGENTS.md)
Dockerfile, render.yaml, railway.json, vercel.json, netlify.toml, .github/   hosting + CI (docs/deployment.md)
```

Full explanation with the data flow: [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Where to read next

- [`ARCHITECTURE.md`](ARCHITECTURE.md) - how it is organised and why
- [`docs/development.md`](docs/development.md) - day-to-day workflow
- [`docs/api.md`](docs/api.md) - every endpoint
- [`docs/data-and-ml.md`](docs/data-and-ml.md) - the data, the model, how to add products
- [`docs/design-system.md`](docs/design-system.md) - colours, type, Dew the mascot
- [`docs/deployment.md`](docs/deployment.md) - put it online (HTTPS, so location and photo reading work on phones)
- [`docs/roadmap.md`](docs/roadmap.md) - what is next
- [`CONTRIBUTING.md`](CONTRIBUTING.md), [`CHANGELOG.md`](CHANGELOG.md), [`SECURITY.md`](SECURITY.md)
- [`AGENTS.md`](AGENTS.md) - context for AI coding agents (Antigravity)

## Add your own product labels

1. Save the real label text as `data/raw/<id>.txt`.
2. Add one line to `data/sources.csv` (`doc_id,class,title,source_url`).
3. `python3 ml/train.py` (needs `pip install -r ml/requirements.txt`), then `python3 scripts/sync_static.py`.

More in `docs/data-and-ml.md`.

## License

Code: MIT (`LICENSE`). Label texts in `data/raw/` are excerpts of third-party public documents kept for research and education; they belong to their owners (sources in `data/sources.csv`). Photos and fonts: see `docs/credits.md`.
