"""bioOasis API.  Run: uvicorn backend.app.main:app --reload  (from the repo root)

Endpoints are documented in docs/api.md. The same server also serves the
frontend/ folder, so one command runs the whole app.
"""
import asyncio
import json

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from . import config
from .schemas import (AnalyzeRequest, ClassifyRequest, ConditionsRequest, DewRequest,
                      MixCheckRequest)
from .security import BodyLimitMiddleware, RateLimitMiddleware, SecurityHeadersMiddleware
from .services import classifier, dewchat, evidence, ocr, pairs, weather

app = FastAPI(title="bioOasis API", version="0.6.7",
              description="Label text in, product type + cited evidence out. Abstains when unsure.")

# Outermost middleware last: security headers go on every response, including 429s and 413s.
# BodyLimit sits between them so an oversized upload is refused before the
# multipart parser (which spools large uploads to a temp file) ever runs.
app.add_middleware(RateLimitMiddleware)
app.add_middleware(BodyLimitMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

if config.CORS_ORIGINS:
    from fastapi.middleware.cors import CORSMiddleware
    app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS,
                       allow_methods=["GET", "POST"], allow_headers=["Content-Type"], max_age=600)

DISCLAIMER = ("Evidence, not spray orders. The product-type guess is a small ML model; "
              "the sources carry the weight. When unsure, ask an agronomist.")

_READ_CHUNK = 1024 * 1024


async def _read_capped(file: UploadFile) -> bytes:
    """Read an upload in chunks and stop as soon as it passes the size cap, so a
    huge body never lands in memory all at once."""
    if file.size is not None and file.size > config.OCR_MAX_BYTES:
        raise HTTPException(413, f"Image too large (max {config.OCR_MAX_BYTES // (1024 * 1024)} MB).")
    parts: list[bytes] = []
    total = 0
    while chunk := await file.read(_READ_CHUNK):
        total += len(chunk)
        if total > config.OCR_MAX_BYTES:
            raise HTTPException(413, f"Image too large (max {config.OCR_MAX_BYTES // (1024 * 1024)} MB).")
        parts.append(chunk)
    return b"".join(parts)


async def _conditions(cls: str, ph: float | None, lat: float | None, lon: float | None) -> dict:
    out: dict = {}
    if ph is not None:
        out["ph"] = evidence.ph_advice(ph)
    if lat is not None and lon is not None:
        try:
            w = await weather.current(lat, lon)
            out["weather"] = w | {"flag": evidence.weather_flag(cls, w["temperature_c"], w["uv_index"]),
                                  "no_flag_text": evidence.rules()["weather"]["no_flag_text"]}
        except Exception:
            out["weather"] = {"error": "Weather lookup failed (needs internet)."}
    return out


@app.get("/api/health")
def health():
    return {"status": "ok", "ocr_server_side": ocr.available(), "dew_ai": dewchat.available(),
            "model_documents": classifier.model_info()["n_documents"]}


@app.post("/api/dew")
async def dew_endpoint(req: DewRequest):
    """Dew's open questions, answered by Gemini with the key held server-side.
    503 when no key is configured: the app then uses its built-in guided answers."""
    if not dewchat.available():
        raise HTTPException(503, "Dew AI is not configured on this server.")
    try:
        text = await dewchat.reply(req.message, req.lang,
                                   [m.model_dump() for m in req.history],
                                   req.context.model_dump())
    except Exception:
        raise HTTPException(502, "Dew AI could not answer right now.")
    return {"reply": text}


@app.get("/api/model")
def model():
    """Model metadata + the measured metrics from the last training run."""
    info = classifier.model_info()
    try:
        with open(config.METRICS_PATH, encoding="utf-8") as f:
            m = json.load(f)
        info["measured"] = {k: m[k] for k in ("holdout_accuracy", "loo_accuracy", "n_documents", "class_counts")}
    except FileNotFoundError:
        pass
    return info


@app.get("/api/samples")
def samples():
    """Real label excerpts for demos (no photo needed)."""
    return evidence.samples()


# OCR runs in a bounded worker: at most OCR_CONCURRENCY reads at once, each with a
# hard timeout, so a slow or huge photo cannot block the event loop or starve the
# server. (A read that times out keeps finishing in its thread; the slot is freed
# and the overshoot is bounded by the timeout rate.)
_OCR_SLOTS = asyncio.Semaphore(config.OCR_CONCURRENCY)


@app.post("/api/ocr")
async def ocr_endpoint(file: UploadFile = File(...)):
    data = await _read_capped(file)
    try:
        async with _OCR_SLOTS:
            text = await asyncio.wait_for(asyncio.to_thread(ocr.read_image, data),
                                          timeout=config.OCR_TIMEOUT_S)
    except (asyncio.TimeoutError, TimeoutError):
        raise HTTPException(503, "The reader took too long on that photo. Try a sharper, smaller photo.")
    except ocr.OcrUnavailable as e:
        raise HTTPException(501, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"text": text}


@app.post("/api/classify")
def classify(req: ClassifyRequest):
    return classifier.predict(req.text)


@app.get("/api/evidence/{cls}")
def get_evidence(cls: str):
    e = evidence.for_class(cls)
    if not e:
        raise HTTPException(404, f"No evidence for class '{cls}'.")
    return e


@app.post("/api/analyze")
async def analyze(req: AnalyzeRequest):
    """One call for the whole result screen: type, evidence, and conditions."""
    pred = classifier.predict(req.text)
    cls = pred["class"]
    ev = evidence.for_class(cls)
    if pred["abstain"] or ev is None:
        return {"status": "abstain", "prediction": pred, "message":
                "Not enough evidence for this product. Check with an agronomist before you mix or spray.",
                "disclaimer": DISCLAIMER}
    conditions = await _conditions(cls, req.ph, req.lat, req.lon)
    return {"status": "found", "prediction": pred, "evidence": ev, "common": evidence.common(),
            "conditions": conditions, "disclaimer": DISCLAIMER}


@app.post("/api/mixcheck")
def mixcheck(req: MixCheckRequest):
    """Two labels in, one cited verdict out: documented conflict, limited
    evidence, or an honest 'we cannot confirm this combination'."""
    return pairs.mix_check(req.text_a, req.text_b)


@app.post("/api/conditions")
async def conditions_post(req: ConditionsRequest):
    """Preferred form: coordinates travel in the request body, so they never
    appear in a URL (and therefore not in access logs or browser history)."""
    return await _conditions(req.cls, req.ph, req.lat, req.lon)


@app.get("/api/conditions")
async def conditions_get(cls: str = Query(min_length=1, max_length=50),
                         ph: float | None = Query(default=None, ge=0, le=14),
                         lat: float | None = Query(default=None, ge=-90, le=90),
                         lon: float | None = Query(default=None, ge=-180, le=180)):
    """Kept for manual use and old clients. New clients should use POST: query
    strings are written to server access logs, and coordinates do not belong there."""
    return await _conditions(cls, ph, lat, lon)


@app.exception_handler(ValueError)
async def value_error(_, exc):
    return JSONResponse({"detail": str(exc)}, status_code=400)


# Serve the frontend last so /api/* wins.
if config.FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=config.FRONTEND_DIR, html=True), name="frontend")
