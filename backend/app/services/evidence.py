"""Evidence lookup. Every claim carries its source; nothing is generated."""
import json
from functools import lru_cache

from .. import config


@lru_cache(maxsize=1)
def _evidence() -> dict:
    with open(config.EVIDENCE_PATH, encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def rules() -> dict:
    with open(config.RULES_PATH, encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def samples() -> list[dict]:
    with open(config.SAMPLES_PATH, encoding="utf-8") as f:
        return json.load(f)


def for_class(cls: str) -> dict | None:
    return _evidence()["classes"].get(cls)


def common() -> dict:
    return _evidence()["common"]


def ph_advice(ph: float) -> dict | None:
    if not 0 <= ph <= 14:
        return None
    r = rules()["ph"]
    for band in r["bands"]:
        if "max_exclusive" in band and ph < band["max_exclusive"]:
            return {"level": band["level"], "text": band["text"], "source": r["source"]}
        if "max_inclusive" in band and ph <= band["max_inclusive"]:
            return {"level": band["level"], "text": band["text"], "source": r["source"]}
    return None


def weather_flag(cls: str, temperature_c: float | None, uv_index: float | None) -> dict | None:
    for f in rules()["weather"]["flags"]:
        if f["class"] != cls:
            continue
        value = temperature_c if f["metric"] == "temperature_c" else uv_index
        if value is not None and value >= f["app_threshold"]:
            return {"text": f["text"], "source": f["source"]}
    return None
