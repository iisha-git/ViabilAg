"""Security headers, an ingress body-size limit, and a small per-IP rate limiter.

No external dependencies: the limits live in process memory, which is the right
size for a single small container (the documented deployment). If the app is
ever scaled to several replicas, replace this with a shared store.
"""
import json
import time
from collections import deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from . import config

# 'wasm-unsafe-eval' lets the in-browser OCR (tesseract.js WebAssembly) run; it does NOT allow eval() of strings.
# Lets the frontend load its OCR worker (jsdelivr) and language data (tessdata),
# call Open-Meteo in static mode, and lets FastAPI's /docs load Swagger (jsdelivr).
CSP = (
    "default-src 'self'; "
    "script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net; "
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "img-src 'self' data: blob:; "
    "font-src 'self'; "
    "connect-src 'self' https://cdn.jsdelivr.net https://tessdata.projectnaptha.com https://api.open-meteo.com; "
    "worker-src 'self' blob: https://cdn.jsdelivr.net; "
    "frame-ancestors 'none'; "
    "base-uri 'self'; "
    "form-action 'self'"
)

HEADERS = {
    "Content-Security-Policy": CSP,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(self), geolocation=(self), microphone=()",
    "Cross-Origin-Resource-Policy": "same-origin",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        for k, v in HEADERS.items():
            response.headers.setdefault(k, v)
        return response


async def _send_413(send, limit: int) -> None:
    body = json.dumps({"detail": f"Image too large (max {max(1, limit // (1024 * 1024))} MB)."}).encode()
    await send({"type": "http.response.start", "status": 413,
                "headers": [(b"content-type", b"application/json"),
                            (b"content-length", str(len(body)).encode())]})
    await send({"type": "http.response.body", "body": body})


class BodyLimitMiddleware:
    """Reject oversized request bodies BEFORE the app parses them.

    FastAPI's multipart parser spools uploads over ~1 MiB to a temporary file as
    they arrive, so a size check inside the route is too late: a huge body has
    already consumed temporary disk. This pure-ASGI middleware answers 413 from
    the Content-Length header when one is sent, and otherwise reads the body
    itself - counting every byte, including multipart overhead and chunked
    uploads - and answers 413 the moment the cap is passed, without calling the
    app. A body within the cap (12 MB by default) is replayed to the app, so
    whatever the parser then spools is bounded by the same cap. It only guards
    the upload endpoint; the JSON endpoints take a few KB. The cap is read from
    config at call time so tests and operators can change it.
    """

    def __init__(self, app, prefix: str = "/api/ocr"):
        self.app = app
        self.prefix = prefix

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or not scope["path"].startswith(self.prefix):
            return await self.app(scope, receive, send)
        limit = config.OCR_MAX_BYTES
        for name, value in scope.get("headers", []):
            if name.lower() == b"content-length":
                try:
                    if int(value) > limit:
                        return await _send_413(send, limit)
                except ValueError:
                    pass  # a broken header must not become a bypass: the body is still counted
                break

        parts: list[bytes] = []
        total = 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                async def disconnected():
                    return {"type": "http.disconnect"}
                return await self.app(scope, disconnected, send)
            body = message.get("body", b"")
            total += len(body)
            if total > limit:
                return await _send_413(send, limit)
            parts.append(body)
            if not message.get("more_body", False):
                break

        full = b"".join(parts)
        replayed = False

        async def replay():
            nonlocal replayed
            if replayed:
                return {"type": "http.request", "body": b"", "more_body": False}
            replayed = True
            return {"type": "http.request", "body": full, "more_body": False}

        return await self.app(scope, replay, send)


class RateLimiter:
    """Sliding-window per-key counters with bounded memory: entries expire after
    their window, a periodic sweep drops stale keys, and a hard cap evicts the
    least recently active keys - so the map can never grow without limit, no
    matter how many distinct IPs or paths arrive."""

    MAX_KEYS = 10_000

    def __init__(self, sweep_window_s: float = 60.0):
        self._hits: dict[str, deque] = {}
        self._sweep_window_s = sweep_window_s
        self._last_sweep = time.monotonic()

    def reset(self) -> None:
        self._hits.clear()

    def allow(self, key: str, limit: int, window_s: float = 60.0) -> bool:
        now = time.monotonic()
        if now - self._last_sweep > self._sweep_window_s:
            self._sweep(now)
        q = self._hits.setdefault(key, deque())
        while q and now - q[0] > window_s:
            q.popleft()
        if len(q) >= limit:
            return False
        q.append(now)
        return True

    def _sweep(self, now: float) -> None:
        self._last_sweep = now
        stale = [k for k, q in self._hits.items() if not q or now - q[-1] > self._sweep_window_s]
        for k in stale:
            del self._hits[k]
        if len(self._hits) > self.MAX_KEYS:
            by_recency = sorted(self._hits, key=lambda k: self._hits[k][-1])
            for k in by_recency[: len(self._hits) - self.MAX_KEYS]:
                del self._hits[k]


limiter = RateLimiter()


def _client_key(request: Request) -> str:
    # Behind Render/Railway the container is started with --proxy-headers, so
    # request.client.host is the real caller address, not the load balancer's.
    return request.client.host if request.client else "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if config.RATE_LIMIT_ENABLED and request.url.path.startswith("/api/"):
            ip = _client_key(request)
            path = request.url.path
            # Unknown paths (including 404 probes) share one bucket instead of
            # minting a new counter per URL; a global per-IP limit caps the total.
            bucket = path if path in config.RATE_LIMITS else "other"
            limit = config.RATE_LIMITS.get(bucket, config.RATE_LIMIT_DEFAULT)
            if (not limiter.allow(f"{ip}|*", config.RATE_LIMIT_GLOBAL)
                    or not limiter.allow(f"{ip}|{bucket}", limit)):
                return JSONResponse(
                    {"detail": "Too many requests. Wait a minute and try again."},
                    status_code=429,
                    headers={"Retry-After": "60"},
                )
        return await call_next(request)
