"""Security and privacy regression tests.

Run with the rest of the suite: python -m pytest -q backend
"""
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app import config
from backend.app.main import app
from backend.app.security import limiter

client = TestClient(app)
ROOT = Path(__file__).resolve().parents[2]
SAMPLES = json.loads((ROOT / "data" / "samples.json").read_text())
TEXT = SAMPLES[0]["text"]


@pytest.fixture(autouse=True)
def _reset_limiter():
    limiter.reset()
    yield
    limiter.reset()


# ---------- security headers ----------

@pytest.mark.parametrize("path", ["/api/health", "/", "/api/nope"])
def test_security_headers_on_every_response(path):
    r = client.get(path)
    assert r.headers["X-Content-Type-Options"] == "nosniff"
    assert r.headers["X-Frame-Options"] == "DENY"
    assert r.headers["Referrer-Policy"] == "no-referrer"
    assert "geolocation=(self)" in r.headers["Permissions-Policy"]
    csp = r.headers["Content-Security-Policy"]
    assert "default-src 'self'" in csp and "frame-ancestors 'none'" in csp


def test_csp_allows_only_the_known_third_parties():
    csp = client.get("/").headers["Content-Security-Policy"]
    # The only outside hosts the page may talk to: the OCR worker CDN, its
    # language-data CDN, and the weather API. Nothing else.
    for host in ("cdn.jsdelivr.net", "tessdata.projectnaptha.com", "api.open-meteo.com"):
        assert host in csp
    assert "http" not in csp.replace("https://", "")


# ---------- CORS ----------

def test_cors_is_off_by_default():
    r = client.get("/api/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in r.headers


# ---------- rate limiting ----------

def test_rate_limit_returns_429_after_the_cap(monkeypatch):
    monkeypatch.setitem(config.RATE_LIMITS, "/api/classify", 3)
    body = {"text": TEXT}
    codes = [client.post("/api/classify", json=body).status_code for _ in range(4)]
    assert codes[:3] == [200, 200, 200]
    assert codes[3] == 429
    r = client.post("/api/classify", json=body)
    assert r.headers.get("Retry-After") == "60"
    assert r.json()["detail"] == "Too many requests. Wait a minute and try again."


def test_rate_limit_is_per_endpoint(monkeypatch):
    monkeypatch.setitem(config.RATE_LIMITS, "/api/classify", 1)
    assert client.post("/api/classify", json={"text": TEXT}).status_code == 200
    assert client.post("/api/classify", json={"text": TEXT}).status_code == 429
    # A different endpoint still works.
    assert client.post("/api/analyze", json={"text": TEXT}).status_code == 200


def test_rate_limit_429_still_carries_security_headers(monkeypatch):
    monkeypatch.setitem(config.RATE_LIMITS, "/api/classify", 1)
    client.post("/api/classify", json={"text": TEXT})
    r = client.post("/api/classify", json={"text": TEXT})
    assert r.status_code == 429 and r.headers["X-Content-Type-Options"] == "nosniff"


# ---------- OCR upload guard rails ----------

def test_ocr_rejects_over_cap_upload(monkeypatch):
    monkeypatch.setattr(config, "OCR_MAX_BYTES", 1024)
    r = client.post("/api/ocr", files={"file": ("big.png", b"x" * 2048, "image/png")})
    assert r.status_code == 413


def test_ocr_cap_does_not_reject_normal_images():
    # 1 MB of text is well under the default 12 MB cap: must reach the OCR step
    # (501 without tesseract, 400 with it - not 413).
    r = client.post("/api/ocr", files={"file": ("l.png", b"0" * (1024 * 1024), "image/png")})
    assert r.status_code in (400, 501)


def test_ocr_garbage_is_a_clean_400_not_a_500():
    from backend.app.services import ocr
    if not ocr.available():
        pytest.skip("server OCR not installed")
    r = client.post("/api/ocr", files={"file": ("x.png", b"\x89PNG garbage", "image/png")})
    assert r.status_code == 400


# ---------- conditions endpoint ----------

def test_conditions_post_keeps_coordinates_out_of_the_url():
    r = client.post("/api/conditions", json={"cls": "bt", "ph": 6.0})
    assert r.status_code == 200 and r.json()["ph"]["level"] == "good"


@pytest.mark.parametrize("body", [
    {"cls": "bt", "ph": 20},
    {"cls": "bt", "lat": 999},
    {"cls": "bt", "lon": -999},
])
def test_conditions_post_validates_ranges(body):
    assert client.post("/api/conditions", json=body).status_code == 422


@pytest.mark.parametrize("qs", ["cls=bt&ph=20", "cls=bt&lat=999", "cls=bt&lon=-999"])
def test_conditions_get_validates_ranges(qs):
    assert client.get("/api/conditions?" + qs).status_code == 422


def test_conditions_get_still_works_for_manual_use():
    assert client.get("/api/conditions?cls=bt&ph=6").status_code == 200


# ---------- no data leaves traces ----------

def test_nothing_is_written_for_requests(tmp_path):
    # Analyze and OCR must not create files anywhere near the app.
    before = {str(p) for p in ROOT.rglob("*")}
    client.post("/api/analyze", json={"text": TEXT, "ph": 7.0})
    client.post("/api/ocr", files={"file": ("x.png", b"not an image", "image/png")})
    after = {str(p) for p in ROOT.rglob("*")}
    assert before == after


def test_validation_error_does_not_leak_internals():
    r = client.post("/api/analyze", json={"text": 123})
    assert r.status_code == 422
    body = r.text
    assert "Traceback" not in body and "site-packages" not in body


def test_csp_allows_wasm_for_ocr_but_not_eval():
    csp = client.get("/api/health").headers["content-security-policy"]
    script = [d for d in csp.split(";") if d.strip().startswith("script-src")][0]
    assert "'wasm-unsafe-eval'" in script          # in-browser OCR (WebAssembly) needs this
    assert "'unsafe-eval'" not in script and "'unsafe-inline'" not in script


def test_frontend_has_no_inline_scripts():
    import re
    from pathlib import Path
    html = (Path(__file__).resolve().parents[2] / "frontend" / "index.html").read_text()
    for m in re.finditer(r"<script\b([^>]*)>(.*?)</script>", html, re.S):
        assert "src=" in m.group(1) and not m.group(2).strip(), f"inline script found: {m.group(0)[:80]}"


# ---------- v0.5.1 hardening ----------

import asyncio
import io
import time

from backend.app.security import BodyLimitMiddleware, RateLimiter


def test_api_version_matches_changelog():
    import re
    latest = re.search(r"## \[(\d+\.\d+\.\d+)\]",
                       (ROOT / "CHANGELOG.md").read_text()).group(1)
    assert app.version == latest


# ---------- ingress body limit (before multipart parsing) ----------

def test_body_limit_rejects_by_content_length(monkeypatch):
    monkeypatch.setattr(config, "OCR_MAX_BYTES", 1024)
    r = client.post("/api/ocr", files={"file": ("big.png", b"x" * 2048, "image/png")})
    assert r.status_code == 413
    # ...and the 413 still carries the security headers
    assert r.headers["X-Content-Type-Options"] == "nosniff"


def test_body_limit_counts_chunked_uploads(monkeypatch):
    # No Content-Length: the body streams in chunks and must be aborted mid-way.
    monkeypatch.setattr(config, "OCR_MAX_BYTES", 64 * 1024)

    def chunks():
        for _ in range(8):  # 128 KiB total, no declared length
            yield b"x" * 16384

    r = client.post("/api/ocr", content=chunks(),
                    headers={"Content-Type": "multipart/form-data; boundary=abc"})
    assert r.status_code == 413


# ---------- hard pixel cap, before decoding ----------

def test_ocr_rejects_over_pixel_cap_before_decoding(monkeypatch):
    # Pillow only *warns* between MAX_IMAGE_PIXELS and twice it; the app must
    # reject explicitly. 150 px against a cap of 100 must be a 400.
    pytest.importorskip("PIL")
    from PIL import Image
    from backend.app.services import ocr
    monkeypatch.setattr(ocr, "available", lambda: True)  # pixel check needs no tesseract binary
    monkeypatch.setattr(config, "OCR_MAX_PIXELS", 100)
    buf = io.BytesIO()
    Image.new("RGB", (15, 10)).save(buf, "PNG")  # 150 pixels
    r = client.post("/api/ocr", files={"file": ("x.png", buf.getvalue(), "image/png")})
    assert r.status_code == 400


def test_ocr_under_pixel_cap_still_reaches_the_reader(monkeypatch):
    pytest.importorskip("PIL")
    from PIL import Image
    from backend.app.services import ocr
    monkeypatch.setattr(ocr, "available", lambda: True)
    monkeypatch.setattr(config, "OCR_MAX_PIXELS", 40_000_000)
    monkeypatch.setattr("pytesseract.image_to_string", lambda img: "  some label text  ")
    buf = io.BytesIO()
    Image.new("RGB", (30, 20), "white").save(buf, "PNG")
    r = client.post("/api/ocr", files={"file": ("x.png", buf.getvalue(), "image/png")})
    assert r.status_code == 200 and r.json()["text"] == "some label text"


# ---------- bounded OCR worker ----------

def test_ocr_has_a_hard_timeout(monkeypatch):
    from backend.app import main
    monkeypatch.setattr(config, "OCR_TIMEOUT_S", 0.05)
    monkeypatch.setattr(main.ocr, "read_image", lambda data: time.sleep(0.3) or "late")
    r = client.post("/api/ocr", files={"file": ("x.png", b"0" * 10, "image/png")})
    assert r.status_code == 503


def test_ocr_reads_run_with_bounded_concurrency(monkeypatch):
    import httpx
    from backend.app import main
    active = {"now": 0, "max": 0}

    def fake_ocr(_data):
        active["now"] += 1
        active["max"] = max(active["max"], active["now"])
        time.sleep(0.05)
        active["now"] -= 1
        return "txt"

    monkeypatch.setattr(main.ocr, "read_image", fake_ocr)
    monkeypatch.setattr(main, "_OCR_SLOTS", asyncio.Semaphore(1))

    async def run():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app),
                                     base_url="http://test") as c:
            files = {"file": ("x.png", b"0" * 10, "image/png")}
            rs = await asyncio.gather(*[c.post("/api/ocr", files=files) for _ in range(3)])
            assert all(r.status_code == 200 for r in rs)

    asyncio.run(run())
    assert active["max"] == 1  # never two reads at once


# ---------- rate limiter: global cap, normalized buckets, bounded memory ----------

def test_global_per_ip_limit_applies_across_paths(monkeypatch):
    monkeypatch.setattr(config, "RATE_LIMIT_GLOBAL", 3)
    codes = [client.get(p).status_code for p in
             ["/api/health", "/api/samples", "/api/model", "/api/health"]]
    assert codes[:3] == [200, 200, 200] and codes[3] == 429


def test_unknown_paths_share_one_bucket(monkeypatch):
    monkeypatch.setattr(config, "RATE_LIMIT_DEFAULT", 3)
    codes = [client.get(f"/api/nope{i}").status_code for i in range(4)]
    assert codes[:3] == [404, 404, 404] and codes[3] == 429
    # one global counter + one "other" bucket - not one counter per probed path
    assert len(limiter._hits) <= 2


def test_limiter_sweep_expires_old_keys():
    limiter.reset()
    limiter.allow("ip|old", 5)
    limiter._sweep(time.monotonic() + 120)
    assert "ip|old" not in limiter._hits


def test_limiter_hard_caps_stored_keys(monkeypatch):
    monkeypatch.setattr(RateLimiter, "MAX_KEYS", 10)
    limiter.reset()
    for i in range(50):
        limiter.allow(f"ip|k{i}", 5)
    limiter._sweep(time.monotonic())
    assert len(limiter._hits) <= 10


# ---------- frontend: pinned reader + consent before upload ----------

def test_tesseract_cdn_is_pinned_with_sri():
    js = (ROOT / "frontend" / "src" / "js" / "ocr.js").read_text()
    assert "tesseract.js@5." in js and "tesseract.js@5/" not in js
    assert "integrity" in js and "sha384-" in js


def test_server_ocr_fallback_asks_before_uploading():
    js = (ROOT / "frontend" / "src" / "js" / "ocr.js").read_text()
    # The fallback must be gated by an explicit yes, not automatic.
    assert "confirm(" in js
    assert js.index("confirm(") < js.index("serverOcr(img")


def test_static_hosting_configs_send_security_headers():
    netlify = (ROOT / "netlify.toml").read_text()
    vercel = (ROOT / "vercel.json").read_text()
    for text in (netlify, vercel):
        assert "Content-Security-Policy" in text
        assert "frame-ancestors 'none'" in text
        assert "wasm-unsafe-eval" in text  # static mode still needs the in-browser OCR
