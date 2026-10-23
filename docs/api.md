# API reference

Base URL: the same origin as the website (e.g. `http://localhost:8000`). Interactive docs: `/docs`. All bodies are JSON unless noted.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | `{status, ocr_server_side, model_documents}` |
| GET | `/api/model` | Model metadata and measured metrics from the last training run |
| GET | `/api/samples` | The 4 real label excerpts for demos |
| POST | `/api/ocr` | multipart `file` (image, max 12 MB, max 40 MP) -> `{text}`. `501` if the server has no tesseract, `400` if not an image or over the pixel cap, `503` if the read times out |
| POST | `/api/classify` | `{text}` -> prediction only |
| GET | `/api/evidence/{class}` | Cited evidence for `bt`, `trichoderma`, `pseudomonas`, `beauveria` (`404` otherwise) |
| POST | `/api/conditions` | `{cls, ph?, lat?, lon?}` -> pH advice and/or weather flag. Preferred: coordinates stay out of URLs (access logs, browser history) |
| GET | `/api/conditions?cls=&ph=&lat=&lon=` | Same, for manual use. `lat` -90..90, `lon` -180..180, `ph` 0-14 (`422` outside) |
| POST | `/api/analyze` | The whole result in one call (see below) |

## POST /api/analyze
Request: `{ "text": "label text (30-20000 chars)", "ph": 7.8, "lat": 28.6, "lon": 77.2 }` (`ph`, `lat`, `lon` optional; `ph` 0-14).

Response when the model is confident enough:
```json
{ "status": "found",
  "prediction": {"class": "bt", "probability": 0.68, "threshold": 0.45, "abstain": false,
                 "ranking": [{"class": "bt", "probability": 0.68}, "..."], "known_terms": 31},
  "evidence": {"name": "Bt spray", "organism": "...", "kind": "...", "targets": "...",
               "labelPoints": [{"text": "...", "source": {"name": "...", "url": "..."}}],
               "research": ["..."]},
  "common": {"context": {}, "water": {}, "jarTest": {}},
  "conditions": {"ph": {"level": "warn", "text": "...", "source": {}},
                 "weather": {"temperature_c": 21.3, "humidity_pct": 76, "uv_index": 0.0,
                             "flag": null, "no_flag_text": "...", "source": {}}},
  "disclaimer": "..." }
```
Below the threshold: `{ "status": "abstain", "prediction": {...}, "message": "...", "disclaimer": "..." }`.
Weather failure: `conditions.weather = {"error": "Weather lookup failed (needs internet)."}`.
Validation errors return `422`.

## Limits and headers
Per-IP rate limits (defaults: OCR 10/min, analyze 30/min, classify and conditions 60/min, other API paths 240/min shared, plus a 300/min global per-IP cap) return `429` with a `Retry-After` header. `/api/ocr` uploads over 12 MB return `413`; the body is refused before it is parsed, so oversized uploads never reach the parser or a temporary file. Every response carries security headers (CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) - see `SECURITY.md`.


## POST /api/mixcheck

Two label texts in, one cited verdict out.

```json
{ "text_a": "T34 BIOCONTROL ...", "text_b": "TILT 25 EC propiconazole ..." }
```

Response: `status` is `conflict`, `limited` or `no_evidence` (never "safe");
`reason` explains an abstention (`product_a_unknown`, `product_b_unknown`,
`no_pair_evidence`); `product_a`/`product_b` carry the matched product (or
null), detected active ingredients, categories, formulation and any label
expiry date; `findings` lists each matched rule with headline, exact scope,
what was actually tested, and its source. Rules live in
`data/evidence/pairs.json` and every one cites a real label for that exact
product. The browser fallback (`frontend/src/js/mixcheck.js`) mirrors this
logic; `scripts/check_mix_parity.mjs` checks both agree.

## POST /api/dew

Dew's open questions, answered by Gemini through the server. The Gemini API key
lives only in the server's `GEMINI_API_KEY` environment variable; the app never
sees it. The app sends the question, the chat language, up to 8 recent chat
messages, and facts extracted from the scanned label's text. Photos are never
sent. When `GEMINI_API_KEY` is not set the endpoint answers `503` and the app
keeps using its built-in guided answers. `GEMINI_MODEL` overrides the model
(default `gemini-3.6-flash`).

Request:
```json
{ "message": "Can I store this in the fridge?", "lang": "en",
  "history": [{"role": "user", "text": "hi"}],
  "context": {"name": "Bt-k", "cls": "bio", "facts": ["..."], "mix": null} }
```
Response: `{ "reply": "..." }` - Errors: `503` not configured, `502` Gemini unreachable, `422` bad input.
