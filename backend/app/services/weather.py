"""Current weather from Open-Meteo (free, no key). Needs internet."""
from datetime import datetime, timezone

import httpx

from .. import config


async def current(lat: float, lon: float) -> dict:
    params = {
        "latitude": lat, "longitude": lon,
        "current": "temperature_2m,relative_humidity_2m,uv_index",
        "timezone": "auto",
    }
    async with httpx.AsyncClient(timeout=config.WEATHER_TIMEOUT_S) as client:
        r = await client.get(config.WEATHER_URL, params=params)
        r.raise_for_status()
        d = r.json()
    cur = d["current"]
    return {
        "temperature_c": cur.get("temperature_2m"),
        "humidity_pct": cur.get("relative_humidity_2m"),
        "uv_index": cur.get("uv_index"),
        "observed_at": cur.get("time") or datetime.now(timezone.utc).isoformat(),
        "source": {"name": "Open-Meteo forecast API", "url": "https://open-meteo.com/en/docs"},
    }
