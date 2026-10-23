"""Settings, read from environment variables (see .env.example)."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

MODEL_PATH = Path(os.getenv("BIOOASIS_MODEL_PATH", ROOT / "ml" / "artifacts" / "model.json"))
EVIDENCE_PATH = Path(os.getenv("BIOOASIS_EVIDENCE_PATH", ROOT / "data" / "evidence" / "evidence.json"))
RULES_PATH = Path(os.getenv("BIOOASIS_RULES_PATH", ROOT / "data" / "evidence" / "rules.json"))
SAMPLES_PATH = Path(os.getenv("BIOOASIS_SAMPLES_PATH", ROOT / "data" / "samples.json"))
METRICS_PATH = Path(os.getenv("BIOOASIS_METRICS_PATH", ROOT / "ml" / "artifacts" / "metrics.json"))
FRONTEND_DIR = Path(os.getenv("BIOOASIS_FRONTEND_DIR", ROOT / "frontend"))

WEATHER_URL = os.getenv("BIOOASIS_WEATHER_URL", "https://api.open-meteo.com/v1/forecast")
WEATHER_TIMEOUT_S = float(os.getenv("BIOOASIS_WEATHER_TIMEOUT_S", "8"))
MIN_TEXT_CHARS = 30
MAX_TEXT_CHARS = 20000

# Upload guard rails for POST /api/ocr (see docs/security).
OCR_MAX_BYTES = int(os.getenv("BIOOASIS_OCR_MAX_BYTES", str(12 * 1024 * 1024)))  # 12 MB
OCR_MAX_PIXELS = int(os.getenv("BIOOASIS_OCR_MAX_PIXELS", str(40_000_000)))      # decompression-bomb cap
# OCR runs in a bounded worker so it cannot stall the server: at most this many
# reads at once, each cut off after this many seconds.
OCR_CONCURRENCY = int(os.getenv("BIOOASIS_OCR_CONCURRENCY", "2"))
OCR_TIMEOUT_S = float(os.getenv("BIOOASIS_OCR_TIMEOUT_S", "30"))

# Per-IP request limits (per minute). OCR is CPU-heavy, so it gets the lowest cap.
# Set BIOOASIS_RATE_LIMIT=0 to disable (e.g. in tests).
RATE_LIMIT_ENABLED = os.getenv("BIOOASIS_RATE_LIMIT", "1") != "0"
RATE_LIMITS = {
    "/api/ocr": int(os.getenv("BIOOASIS_RATE_OCR", "10")),
    "/api/analyze": int(os.getenv("BIOOASIS_RATE_ANALYZE", "30")),
    "/api/mixcheck": int(os.getenv("BIOOASIS_RATE_MIXCHECK", "30")),
    "/api/classify": int(os.getenv("BIOOASIS_RATE_CLASSIFY", "60")),
    "/api/conditions": int(os.getenv("BIOOASIS_RATE_CONDITIONS", "60")),
}
RATE_LIMIT_DEFAULT = int(os.getenv("BIOOASIS_RATE_DEFAULT", "240"))  # other /api/* paths, one shared bucket
RATE_LIMIT_GLOBAL = int(os.getenv("BIOOASIS_RATE_GLOBAL", "300"))    # all /api/* paths combined, per IP

# Comma-separated origins allowed to call the API from another site (only needed when the
# website is hosted separately from the backend). Empty = no CORS.
CORS_ORIGINS = [o.strip() for o in os.getenv("BIOOASIS_CORS_ORIGINS", "").split(",") if o.strip()]
