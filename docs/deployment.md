# Deployment

Goal: a normal **HTTPS** URL, so photo reading and "Use my location" work on a phone. (Browsers only allow location on HTTPS or localhost.)

**Option A is recommended**: website, API and server-side OCR in one container.

## Option A: one container

### Render (free plan, easiest)
1. Put this folder in a GitHub repository (see "Put it on GitHub").
2. On <https://render.com>: New > Blueprint, pick the repo. `render.yaml` is picked up automatically.
3. Wait for the build (a few minutes). Render gives you `https://<name>.onrender.com`.
4. Open it on your phone. `https://<name>.onrender.com/api/health` should show `"status":"ok"`.
5. Optional - Dew's Gemini answers: create a key in Google AI Studio, then in Render > your service > Environment add `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`). Redeploy; `/api/health` then shows `"dew_ai":true`. Without the key Dew still answers with its built-in guided replies. Note: Google's free tier lets Google use sent content to improve its products; the app sends only chat text and scanned label text, never photos.
Free Render services sleep when idle, so the first open after a break can take about a minute.

### Railway
New Project > Deploy from GitHub repo. `railway.json` makes it use the `Dockerfile`. Then Settings > Networking > Generate Domain.

### Vercel (Hobby free plan)
1. Put this folder in a GitHub repository (see "Put it on GitHub").
2. On <https://vercel.com>: Add New > Project, import the repo. Vercel detects the FastAPI entrypoint (`main.py` at the root re-exports the app from `backend/app/main.py`) and installs the root `requirements.txt`.
3. Deploy. Vercel gives you `https://<name>.vercel.app`. `/api/health` should show `"status":"ok"`.
4. Optional - Dew's Gemini answers: create a key in Google AI Studio, then in Vercel > your project > Settings > Environment Variables add `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`, default `gemini-3.6-flash`). Redeploy; `/api/health` then shows `"dew_ai":true`. Without the key Dew still answers with its built-in guided replies. Note: Google's free tier lets Google use sent content to improve its products; the app sends only chat text and scanned label text, never photos.
Note: Vercel has no tesseract binary, so server-side OCR is off there (`"ocr_server_side":false` in `/api/health`); photo reading runs in the browser instead, which is the app's normal path on phones. The Hobby plan is free and fits a prototype; check its current limits if usage grows.

### Any Docker host (Fly.io, a VPS, Google Cloud Run)
```
docker build -t biooasis .
docker run -p 8000:8000 biooasis        # http://localhost:8000
```
The container listens on `$PORT` (default 8000).

## Option B: website only (static, no backend)
The website runs the same model in the browser ("Static mode" in the footer). Publish the `frontend/` folder:
- **GitHub Pages:** not enabled in the public repo for now (its workflow is kept out of the repo until separately authorized). To enable later, restore `.github/workflows/pages.yml` from the private source archive, then Repo Settings > Pages > Source: GitHub Actions and push.
- **Vercel:** importing the repo now deploys the full app (frontend + API, see Option A above). To publish the website statically on Vercel instead, add `"outputDirectory": "frontend"` to `vercel.json`.
- **Netlify:** import the repo; `netlify.toml` sets `publish = frontend`.
Photo reading still works (it runs in the browser). There is no server OCR in this mode.

### Website and backend on different hosts
Set `window.BIOOASIS_API = "https://your-backend.example"` in `frontend/assets/config.js`, and on the backend set `BIOOASIS_CORS_ORIGINS=https://your-website.example`.

## Put it on GitHub
Easiest: create an empty repository on github.com, then on its page choose "uploading an existing file" and drag the project folder contents in. With the GitHub CLI instead:
```
git init && git add . && git commit -m "bioOasis v0.2"
gh repo create biooasis --public --source=. --push
```

## Checklist after deploying
- [ ] `/api/health` is ok
- [ ] Tap a sample label and get a result
- [ ] On a phone, "Scan a label" opens the camera and text appears
- [ ] Result > Your field > "Use my location" asks permission and shows weather
- [ ] Footer says "Connected to the bioOasis backend" (A) or "Static mode" (B)
- [ ] (If `GEMINI_API_KEY` set) `/api/health` shows `"dew_ai":true`, and Dew answers an open typed question
- [ ] On the phone's browser menu, "Add to Home Screen" / "Install app" appears, and the installed copy opens full screen (needs https; on desktop, look for the install icon in the address bar)
- [ ] On a laptop, check the wide layout: result screen shows the summary next to the evidence tabs

## Security notes
- All options above serve HTTPS, which the app expects: it keeps label text private in transit, is required for "Use my location", and is required for the installable-app part (the service worker only registers on https or localhost; on plain http the site simply works as before, not installable).
- The backend sends security headers and per-IP rate limits itself (see `SECURITY.md`). In static mode (Option B), `netlify.toml` sends the same headers on Netlify (and `vercel.json` does the same for a static Vercel deploy); **GitHub Pages cannot send custom headers**, so the app works there without this hardening (the browser then talks only to the OCR CDNs and Open-Meteo). If you want the headers in static mode, prefer Netlify or Vercel.
- The container trusts `X-Forwarded-For` from any peer by default (`FORWARDED_ALLOW_IPS=*`), which is correct on Render/Railway/Fly where only the platform router can reach it. On a direct-exposed host, set `FORWARDED_ALLOW_IPS` to your proxy's address.
- The container runs as a non-root user and contains only the folders it needs (`data/raw/` and `docs/` are excluded by `.dockerignore`).
- The only optional secret is `GEMINI_API_KEY` for Dew's Gemini answers. Set it in the host's env-var settings, never in a committed file; `render.yaml` declares it with `sync: false` so its value stays in the dashboard.

## What was tested
Tested in development: the app, the API, the CORS setting, the start command with `$PORT`, browser OCR and the flow end to end. The Vercel entrypoint layout (`main.py` + root `requirements.txt` + `vercel.json`) was verified locally with a fresh virtual environment: `uvicorn main:app` serves `/api/health`, the frontend, `config.js` and the bundled model. The deploy files (`Dockerfile`, `render.yaml`, `railway.json`, `netlify.toml`) follow each platform's documented format but were **not run on those platforms**. The GitHub CI/Pages workflows are not in the public repo yet (kept in the private source archive until separately authorized), so GitHub Actions is not enabled; backend tests run locally (`make test` / pytest). If a build fails, the log says why; the usual fix is small. If a build fails, the log says why; the usual fix is small.
