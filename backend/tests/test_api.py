import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)
ROOT = Path(__file__).resolve().parents[2]
SAMPLES = json.loads((ROOT / "data" / "samples.json").read_text())


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


@pytest.mark.parametrize("s", SAMPLES, ids=lambda s: s["label"])
def test_samples_classify_to_their_class(s):
    r = client.post("/api/analyze", json={"text": s["text"]})
    j = r.json()
    assert j["status"] == "found"
    assert j["prediction"]["class"] == s["class"]
    # every claim has a source url
    for k in ("labelPoints", "research"):
        for fact in j["evidence"][k]:
            assert fact["source"]["url"].startswith("http")


def test_gibberish_abstains():
    r = client.post("/api/analyze", json={"text": "tomato ketchup recipe with onions garlic and plenty of salt to taste"})
    assert r.json()["status"] == "abstain"


def test_short_text_rejected():
    assert client.post("/api/analyze", json={"text": "hi"}).status_code == 422


def test_ph_bands():
    base = {"text": SAMPLES[0]["text"]}
    levels = {}
    for ph in (3.0, 6.0, 8.2):
        levels[ph] = client.post("/api/analyze", json=base | {"ph": ph}).json()["conditions"]["ph"]["level"]
    assert levels == {3.0: "warn", 6.0: "good", 8.2: "warn"}


def test_ph_out_of_range_rejected():
    assert client.post("/api/analyze", json={"text": SAMPLES[0]["text"], "ph": 20}).status_code == 422


def test_unknown_evidence_404():
    assert client.get("/api/evidence/nope").status_code == 404


def test_ocr_unavailable_or_bad_image_is_a_clean_error():
    r = client.post("/api/ocr", files={"file": ("x.png", b"not an image", "image/png")})
    assert r.status_code in (400, 501)  # 501: server OCR not installed, 400: not an image


def test_ocr_reads_a_rendered_label_when_installed():
    from backend.app.services import ocr
    if not ocr.available():
        pytest.skip("server OCR not installed")
    import io
    from PIL import Image, ImageDraw, ImageFont
    img = Image.new("RGB", (900, 120), "white")
    ImageDraw.Draw(img).text((20, 40), "Bacillus thuringiensis kurstaki", fill="black",
                             font=ImageFont.load_default(size=40))
    buf = io.BytesIO(); img.save(buf, "PNG")
    r = client.post("/api/ocr", files={"file": ("l.png", buf.getvalue(), "image/png")})
    assert r.status_code == 200 and "thuringiensis" in r.json()["text"].lower()


def test_serves_frontend():
    assert client.get("/").status_code in (200, 404)  # 404 only before the frontend exists
