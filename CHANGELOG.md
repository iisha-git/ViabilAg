## Android packaging: 0.6.19 (2026-10-23)
- Rebuilt the APK with website 0.6.19 classroom cases and both-label mix checks.
- Corrected Android package version metadata to versionCode 19 / versionName 0.6.19.
- Documented changed-debug-key reinstall and local-data preservation caveats.

# Changelog

## 0.6.28 - Full Hindi and Marathi localization
- Whole platform in English, Hindi and Marathi: every menu, button, flow and settings screen, plus all evidence explanations (class facts, label points, research notes, weather and pH guidance, mix-check findings and disclaimers).
- Translated explanations are marked and keep the original one tap away: each translated line carries a "मूल EN / मूळ EN" chip that swaps to the verbatim English source and back. Verbatim label quotes, product names, study citations and Latin organism names stay unchanged.
- Settings note updated; theme names stay proper nouns while theme descriptions translate. Language choice persists across launches and applies on startup.
- No new AI, speech or photo services; no change to agricultural advice, evidence data files or privacy.

## 0.6.27 - Mix button tap fix
- Fixed an invisible layer swallowing taps: the scan-note toast faded visually but stayed on screen with pointer events enabled, blocking buttons (including "Check the mix") that scrolled under it. The toast no longer intercepts touches and is removed after fading.
- Reproduced at the reported phone geometry before the fix (tap hit the hidden toast); verified the tap opens the mix check after the fix. Full scan -> result -> mix check -> compatibility flow retested on all four product classes; 82 backend tests pass.

## 0.6.22 - Dew question routing
- Restrict built-in guide shortcuts to explicit whole requests in English, Hindi and Marathi. Full crop questions now reach AI instead of matching words such as "क्या कर", "help", "पानी" or "लेबल".
- Preserve guide chips and add routing regression tests based on the phone conversation.
- No new AI, speech or photo services; no change to agricultural advice or privacy.

## Unreleased - voice input fixes

- Website: the `Permissions-Policy` header sent `microphone=()`, which blocks the microphone for the whole site, so Dew's mic could never listen. It is now `microphone=(self)` (Vercel, Netlify and the backend). Listening still starts only when the mic button is tapped.
- Android app: the native bridge sent `onResult` / `onError` while the page listened for `result` and bare error codes, so every spoken result was dropped. The wire format now matches the page.
- Added `scripts/check_speech_wire.mjs`, a contract check that fails if the Android bridge and Dew disagree on the message format, or if the site blocks its own microphone again.
- Service worker cache bumped to v20 so open copies of the site refresh and pick up the new header.
- Android app: added the Android 11+ package-visibility query for speech recognition services, without which the phone reported no recognizer available.

## 0.6.8 - 2026-10-23

- Camera/scan dead-tap rework (Android): the app declares the CAMERA permission but never asked for it at runtime, which blocks the capture intent on devices that enforce declared permissions. The app now asks when you tap Scan, and still opens the gallery picker if you decline. Every picker failure path now logs (logcat tag `bioOasis`), completes the WebView callback so later taps keep working, and shows a small on-screen note (e.g. "Opening camera / gallery...", "Camera unavailable - opening gallery picker") so a silent dead tap is impossible to miss. The file input also renders off-screen instead of `hidden` for picky WebViews.
- Dew is honest about who answered: Gemini answers carry a "Dew AI" tag, built-in answers carry a "built-in guide" tag, and a one-time note says when Dew AI is not connected or could not be reached (English, Hindi, Marathi). No silent local answer dressed up as an AI answer.
- The footer shows the app version (from `assets/config.js`), so support can confirm which build is on the phone.
- The app and APK now point at the live backend `https://viabil-ag.vercel.app` (`assets/config.js`), and the page security policy allows that origin - Dew AI answers work in the app as soon as the server key is set.
## [0.6.7] - 2026-10-23

### Added
- Dew now answers open, free-form questions through Gemini (`POST /api/dew`). The API key lives only in the server's `GEMINI_API_KEY` environment variable - never in the app, the APK, or this repo. The app sends the question, the chat language, up to 8 recent chat messages, and facts extracted from the scanned label's text. Photos are never sent. A one-time notice in the chat says exactly this before the first open question (English, Hindi, Marathi). Without a key, on any error, or in static/offline mode, Dew keeps using its built-in guided answers; chips and guided questions never leave the device.
- `render.yaml` declares optional `GEMINI_API_KEY` / `GEMINI_MODEL` (sync: false); `docs/api.md` and `docs/deployment.md` document the endpoint, the free-tier content-use note, and the setup steps.

### Fixed
- Camera/gallery picker in the Android app: any failure in the chooser path (including unchecked FileProvider errors) now degrades to a gallery-only chooser and then to a plain gallery picker - a tap never does nothing. Uses the explicit ACTION_CHOOSER pattern (gallery base + camera initial intent).
- Dew chat layout: the message log is viewport-bounded and scrolls internally, so long conversations no longer push replies under the input bar; the hero mascot collapses once a conversation starts; the privacy note uses full-strength text color.

## [0.6.0] - 2026-10-22

### Added
- Mix check: scan or paste a second product label after analysing the first one. A guided three-step flow (add product, confirm what Dew read, action page) answers one question - "is there real evidence about using these two products together?" - with three honest outcomes: a documented conflict, limited evidence, or "we cannot confirm this combination".
- `data/evidence/pairs.json`: curated product-pair rules taken from real cited labels (T34 Biocontrol, RootShield WP, PlantShield HC, Naturalis L, BlightBan A506, BotaniGard ES/22WP, Mycotrol ESO, Howler EVO, XenTari, Javelin WG, DiPel DF). Every rule names the exact product, the exact warning, and its source. No rule transfers between brands, strains or formulations.
- `POST /api/mixcheck` endpoint with its own rate limit bucket.
- Browser mirror of the pair logic (`frontend/src/js/mixcheck.js`) so the mix check also works in static mode and in the Android app; `scripts/check_mix_parity.mjs` checks both agree.
- Editable "take this with you" summary slip for an agronomist or dealer: copy to clipboard or save as a text file. Stored only on the device.
- Label-date and formulation extraction shown on the confirm step. A past date is shown as "date has passed" - it is never called proof of a fake product or dead microbes.
- Soft generated sounds (taps, step chimes) with an on/off toggle in Settings; caution and unknown outcomes get low, quiet tones, never a success cue.
- Purpose-specific layouts for the mix flow (product tags, torn-paper summary slip, verdict-specific pages), floating-bubble decoration, and a global `prefers-reduced-motion` fallback.
- `android/`: a small native WebView wrapper project that bundles the frontend and builds a real installable APK (`gradle :app:assembleDebug`). Camera and location work inside the app; the classifier, evidence and mix check run fully offline on the device.

### Changed
- The result page now leads with a "Check the mix" invitation instead of leaving farmers on a read-only result.


All notable changes are listed here. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.5.1] - 2026-10-20
### Security
- `/api/ocr` now refuses oversized request bodies **before the upload is parsed** (previously the size check ran only after the server had already spooled a large upload to a temporary file). Chunked uploads are counted as they stream in and aborted past the cap.
- OCR now runs in a bounded worker: at most 2 reads at a time with a 30 s hard timeout, so a slow or huge photo can no longer block the server's event loop.
- The 40-megapixel cap is now enforced **before** the image is decoded (Pillow only warns between the cap and twice the cap, so oversized images used to be decoded anyway).
- Rate limiter: added a global 300/min per-IP cap across the whole API; unknown paths (including 404 probes) now share one bucket instead of minting a counter per URL; counters expire after their window and their number is hard-capped, so limiter memory can no longer grow without limit.
- The browser-to-server OCR fallback now **asks before uploading** the photo ("send to the server reader, used once and deleted right after"); saying no keeps the photo on the device.
- The in-browser OCR reader is pinned to tesseract.js 5.1.1 with an SRI integrity hash instead of tracking the moving `@5` tag.
- `netlify.toml` and `vercel.json` now send the same security headers the backend sends (GitHub Pages cannot set custom headers - noted in the docs).
- The container's trusted-proxy setting is now configurable (`FORWARDED_ALLOW_IPS`) and documented.

### Fixed
- Honest privacy wording: SECURITY.md and the OCR module no longer claim photos are "never written to disk" - short-lived temporary system files can be used while a request is handled and are deleted when it ends. The coordinates wording now names the two real exceptions (the legacy GET form and the static-mode weather call).
- API version metadata now matches the release (it said 0.4.0).
- Service worker cache bumped to v3 for the updated OCR script.

## [0.5.0] - 2026-10-20
### Changed
- **Desktop redesign** (1024 px and up only; phone and tablet layouts unchanged, all three themes): a glass top bar with section links, a "scrapbook" hero (framed photo, two taped photo cards, floating fact chips, Dew leaning toward the cursor), a scrolling ticker of the four spray families, taller sample cards with a cursor-following glow and a slide-up "Read this label" caption, numbered step cards, a farmer photo banner with three fact tiles (26 labels, 4 families, no survival numbers), floating colour blobs and a scroll progress bar.
- Result screen: sticky summary on the left, a segmented tab pill and numbered evidence cards on the right; a small burst of drops when a result appears. Label-reading screen gets a "Getting a good read" card with Dew when there is no photo. All of it still shows the short answer first and the rest one tap away.
- New `src/js/desktop-fx.js` (visual only: pointer glow, parallax, count-up, scroll bar, drops). It reads no data, makes no network calls and stores nothing. It switches itself off below 1024 px and when the system asks for reduced motion.
- Service worker cache bumped to v2 and now lists `desktop-fx.js`.

## [0.4.0] - 2026-10-20
### Added
- **Desktop layout** (`frontend/src/styles/desktop.css`, loaded after the theme CSS): from 1024 px up, the result screen puts the summary (photo banner, Dew's guess, "Good to know") next to the evidence tabs instead of above them, the label-reading screen shows photo and text side by side, the two field checks sit side by side, and the home page uses a two-column hero, a four-card sample row and three-column steps. Tablets (760-1023 px) get a slightly wider single column. The phone layout is unchanged, and all three themes get the same treatment.
- **Installable app (PWA):** `manifest.webmanifest`, Dew app icons (regular and maskable, 192/512 px), and a service worker (`sw.js`) that caches only the app's own static files, so the site can be added to a phone's home screen and opens faster. Registered from `src/js/pwa.js`; needs https (or localhost) and quietly does nothing without it.
- Tests: `backend/tests/test_pwa.py` (6 tests: manifest is installable, icons exist at their declared sizes, the page links the manifest, and the service worker never caches the API, uploads, coordinates or cross-origin requests).

### Privacy
- The service worker never caches `/api/*`, non-GET requests (the conditions POST carries coordinates), or anything cross-origin. Label photos are in-memory `blob:` URLs and never reach it. Cached files are public app code only.

## [0.3.0] - 2026-10-20
### Added
- Three selectable themes in a new in-app **Settings** sheet (button on the home screen): **Lilac Cloud** (default), **Sticker Pop** and **Aurora Night**. Same content, progressive disclosure, honesty text and credits in all three; Dew the mascot is recoloured per theme.
- The choice is remembered in this browser only (`localStorage`, key `biooasis-theme`). Nothing is sent to the server or anywhere else.
- New self-hosted fonts (SIL OFL): DM Sans, Bagel Fat One, DM Serif Display, Plus Jakarta Sans, Space Grotesk.
- Tests: CSP allows WebAssembly (for OCR) without eval, and the frontend has no inline scripts.

### Fixed
- The v0.2.1 CSP blocked the in-browser OCR reader (WebAssembly was refused). Added `'wasm-unsafe-eval'` to `script-src` (this does not allow `eval()` of strings). OCR re-tested end to end under the real headers.
- The icon bootstrap was an inline script that the v0.2.1 CSP would block. Moved to `src/js/boot-icons.js`.

## [0.2.1] - 2026-10-20
### Security
- Security headers on every response: CSP (self + the OCR CDNs + Open-Meteo only), nosniff, frame denial, Referrer-Policy no-referrer, Permissions-Policy for camera/location.
- Per-IP rate limits on the API (429 with Retry-After), configurable via env.
- `/api/ocr`: chunked upload reading with a hard 12 MB cap (413), non-image rejection, and a 40-megapixel decompression-bomb cap.
- Coordinates moved off the URL: new `POST /api/conditions`; the frontend uses it so locations never land in access logs or browser history. The GET form stays, now with range validation (422 out of range).
- Removed the `?api=` URL override: a crafted link can no longer repoint the app at another server.
- Docker image runs as a non-root user; CORS tightened to Content-Type headers when enabled.
- Frontend: weather values rendered as numbers only, and old label-photo object URLs are revoked.

### Added
- `backend/tests/test_security.py` (21 tests: headers, CORS-off default, rate limits, upload caps, validation, no-files-written).
- `docs/adr/0005-security-and-privacy-hardening.md`.

## [0.2.0] - 2026-10-20
### Added
- FastAPI backend: `/api/analyze`, `/api/classify`, `/api/evidence/{class}`, `/api/conditions`, `/api/ocr` (optional), `/api/samples`, `/api/model`, `/api/health`.
- Python scorer that reproduces scikit-learn probabilities (tested), so scikit-learn is not needed at runtime.
- Backend tests (pytest) and a browser-vs-backend parity script.
- Standard project structure (`frontend/ backend/ ml/ data/ docs/ scripts/`) and docs: README, ARCHITECTURE, CONTRIBUTING, SECURITY, AGENTS, GEMINI, `docs/`, ADRs.
- Antigravity rules in `.agents/rules/`.
- Redesigned UI: licensed photos with in-app credits, original mascot "Dew", animations, friendly stop and empty states.
- Self-hosted fonts (Fraunces, Inter).

### Changed
- Evidence, rules and samples moved out of JavaScript into `data/` (one source of truth).
- pH advice now follows the cited source wording: pH above 7 is flagged (v0.1 flagged from 7.5).
- Frontend falls back to in-browser scoring when no backend is found (static hosting).

## [0.1.0] - 2026-10-20
### Added
- First prototype: browser-only app (OCR, small ML model, cited evidence cards, pH and weather checks, "not enough evidence" stop).
- 26 real public label/product texts with sources; measured leave-one-out accuracy 88.5%, hold-out 71.4%.
