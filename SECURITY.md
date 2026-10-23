# Security and privacy

bioOasis is a prototype with no accounts, no database and no analytics. This
file says exactly what the app does with the two sensitive things it touches -
your label photos and your location - and what the code does to protect them.

## What the app collects

Nothing is stored. There is no database, no log of requests' contents, no
cookies, no tracking, no accounts.

- **Label photos:** read by OCR and thrown away. In the default flow the OCR
  runs **in your browser** (tesseract.js), so the photo never leaves your
  device. If the browser OCR cannot run, the app **asks you first**; only if
  you say yes, the photo goes to `POST /api/ocr` for that one read. On the
  server it is processed in memory, never stored and never logged, and
  discarded when the request ends. One honest detail: while that request is
  handled, the web server's upload parser and the OCR program can use
  short-lived temporary system files (that is how they are built); those are
  deleted when the request ends, and nothing about the photo is kept. Photos
  are shrunk to at most 1800 px in the browser before any upload.
- **Label text:** sent to `POST /api/analyze` (or scored in the browser in
  static mode). Processed in memory, not stored, not logged.
- **Location:** asked for only when you tap "Use my location", handled by the
  browser's own permission prompt. The coordinates go to Open-Meteo (the
  weather provider) - through the backend, or directly in static mode. They are
  not stored and not logged by the app. From v0.2.1 the frontend uses
  `POST /api/conditions` instead of GET, so coordinates travel in the request
  body and stay out of this server's access logs and your browser history. Two
  honest exceptions: the old `GET /api/conditions` form still accepts
  coordinates in its URL (kept for manual use and old clients), and in static
  mode (no backend) the browser calls Open-Meteo directly, so the coordinates
  sit in that HTTPS request to them, as with any weather website.

## What third parties see

| Who | What they receive | When |
|---|---|---|
| Open-Meteo (weather) | Your coordinates, rounded to what you shared | Only when you tap "Use my location" |
| cdn.jsdelivr.net | Your IP (normal CDN request) | The first time OCR runs (downloads the reader) |
| tessdata.projectnaptha.com | Your IP | The first time OCR runs (downloads English language data) |
| Your hosting provider (Render, GitHub Pages, ...) | Normal hosting logs | Always - see "If you host it" below |

Evidence "Source" links open third-party sites only when you tap them.

## What the backend does to protect you

- **Security headers on every response:** Content-Security-Policy (only the
  app's own files plus the three third parties listed above), nosniff,
  frame-ancestors 'none' / X-Frame-Options DENY (no clickjacking),
  Referrer-Policy: no-referrer, and a Permissions-Policy that limits camera
  and location to the app itself.
- **Rate limits per IP:** 10/min for OCR, 30/min for analyze, 60/min for
  classify and conditions, 240/min shared across other API paths, plus a
  300/min global cap per IP across the whole API. Over the limit you get a 429
  with Retry-After. Counters expire after their window and are hard-capped in
  number, so the limiter's memory cannot grow without limit. Configurable, see
  `.env.example`.
- **Upload guard rails:** `/api/ocr` refuses bodies over 12 MB **before the
  upload is parsed** (413) - including chunked uploads, which are counted as
  they stream in - then stops reading at 12 MB, rejects files that are not real
  images (400), and refuses images over 40 megapixels before decoding them, so
  a tiny "decompression bomb" file cannot exhaust memory. OCR runs in a bounded
  worker (2 reads at a time, 30 s timeout), so a slow or huge photo cannot
  stall the server.
- **Input validation:** label text 30-20000 characters; pH 0-14; latitude
  -90..90; longitude -180..180. Out-of-range values get a 422, never reach
  the weather provider.
- **CORS off by default.** The backend serves the website itself, so no cross-
  origin access is needed. If you host the website separately, set
  `BIOOASIS_CORS_ORIGINS` to your website's exact origin - never `*`.
- **No API-override trick:** the backend address comes only from
  `frontend/assets/config.js`. A link cannot silently repoint the app at
  someone else's server.
- **Container runs as a non-root user.** Only the folders the app needs are
  copied into the image (`data/raw/` and `docs/` stay out).

## Secrets

There are none. The app needs no API keys or passwords. `.env` is git-ignored;
`.env.example` documents every setting and contains only safe defaults.
Dependencies are checked with pip-audit (clean as of 2026-10-20).

## If you host it

- Use HTTPS (Render/Railway/Fly give it automatically). Browsers only allow
  location on HTTPS, and HTTPS keeps label text private in transit.
- The app logs no request bodies. Uvicorn's access log records request URLs.
  The frontend keeps coordinates out of URLs (it uses POST), but the legacy
  `GET /api/conditions` form can still carry them if someone uses it - start
  uvicorn with `--no-access-log` if you want no URLs logged at all.
- The container is started with `--proxy-headers` and trusts forwarded headers
  from any peer by default. That is right on Render/Railway/Fly, where the
  platform's router is the only thing that can reach the container. If you run
  it somewhere clients can connect to directly, set `FORWARDED_ALLOW_IPS` to
  your proxy's address, or callers could spoof their rate-limit identity.
- Static hosting (Option B): `netlify.toml` and `vercel.json` send the same
  security headers the backend sends. GitHub Pages cannot send custom headers;
  the app still works there, just without this extra hardening (in static mode
  the browser talks only to the OCR CDNs and Open-Meteo).
- Keep `BIOOASIS_CORS_ORIGINS` empty unless the website is on a different host.

## Reporting a vulnerability

Please tell the maintainers privately (team ViabilAg) before posting publicly.
Include steps to reproduce.


## Service worker and installable app (v0.4.0)
- The site can be installed ("Add to Home Screen") and opens faster because `frontend/sw.js` caches the app's **own static files** (pages, css, js, fonts, bundled photos and data). That cache holds public app code only.
- The service worker never caches: anything under `/api/` (answers, photo uploads, weather), any non-GET request (the conditions POST carries your coordinates), or any cross-origin request (OCR CDN, Open-Meteo). Label photos are in-memory `blob:` URLs, so they never reach the service worker at all.
- The cache is versioned (`biooasis-static-v1`); old versions are deleted on update. Tests in `backend/tests/test_pwa.py` lock these rules in.

## Theme setting and CSP (v0.3.0)
- The chosen theme is stored in the browser's `localStorage` (`biooasis-theme`) and never sent anywhere.
- The CSP `script-src` is `'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net`. `'wasm-unsafe-eval'` is needed because the in-browser OCR (tesseract.js) runs WebAssembly. It does not permit `eval()` or inline scripts. A test checks that `'unsafe-eval'` and `'unsafe-inline'` are not in `script-src` and that `index.html` has no inline scripts.
- If you host the static frontend without this backend (GitHub Pages, Netlify, Vercel), set an equivalent CSP header yourself; the backend's headers only apply to responses it serves.

## Desktop polish script (v0.5.0)

`frontend/src/js/desktop-fx.js` only changes how the page looks (pointer glow, gentle parallax, number count-up, scroll bar, a few floating drops). It is an external module (no inline script, the CSP is unchanged), it makes no network calls, reads no photos or location, and stores nothing. A test (`backend/tests/test_desktop.py`) fails if it ever uses `fetch`, storage or geolocation.
