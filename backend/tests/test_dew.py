"""Dew proxy endpoint: key stays server-side, 503 without it, guarded inputs."""
from fastapi.testclient import TestClient

from backend.app import main
from backend.app.services import dewchat

client = TestClient(main.app)

BODY = {"message": "Can I store this in the fridge?", "lang": "en",
        "history": [{"role": "user", "text": "hi"}], "context": {"name": "Bt-k", "cls": "bio"}}


def test_dew_503_without_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert client.post("/api/dew", json=BODY).status_code == 503


def test_dew_proxies_reply(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")

    async def fake_reply(message, lang, history, context):
        assert lang == "en" and history[0]["text"] == "hi"
        return "Yes, keep it cool per the label."

    monkeypatch.setattr(dewchat, "reply", fake_reply)
    r = client.post("/api/dew", json=BODY)
    assert r.status_code == 200
    assert r.json()["reply"] == "Yes, keep it cool per the label."


def test_dew_gemini_error_becomes_502(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")

    async def boom(*args, **kwargs):
        raise RuntimeError("upstream down")

    monkeypatch.setattr(dewchat, "reply", boom)
    assert client.post("/api/dew", json=BODY).status_code == 502


def test_dew_gemini_429_becomes_429(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")

    async def quota(*args, **kwargs):
        import httpx
        req = httpx.Request("POST", "https://example.invalid")
        res = httpx.Response(429, request=req)
        raise httpx.HTTPStatusError("quota", request=req, response=res)

    monkeypatch.setattr(dewchat, "reply", quota)
    r = client.post("/api/dew", json=BODY)
    assert r.status_code == 429
    assert "quota" in r.json()["detail"].lower()


def test_dew_gemini_non429_http_error_becomes_502(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")

    async def overloaded(*args, **kwargs):
        import httpx
        req = httpx.Request("POST", "https://example.invalid")
        res = httpx.Response(503, request=req)
        raise httpx.HTTPStatusError("overloaded", request=req, response=res)

    monkeypatch.setattr(dewchat, "reply", overloaded)
    assert client.post("/api/dew", json=BODY).status_code == 502


def test_dew_validation():
    assert client.post("/api/dew", json={"message": ""}).status_code == 422
    assert client.post("/api/dew", json={"message": "x", "lang": "fr"}).status_code == 422


def test_dew_detect_lang():
    d = dewchat.detect_lang
    # Devanagari is decisive; Marathi markers separate mr from hi
    assert d("क्या मैं इसे धूप में रख सकता हूँ?") == "hi"
    assert d("हे उन्हाळ्यात टिकते का? मला सांगा") == "mr"
    # Romanized Hindi/Marathi (English-mode speech recognizer output)
    assert d("kya main ise garam shed me rakh sakta hoon?") == "hi"
    assert d("mujhe batao yeh dhoop me kharab hota hai kya") == "hi"
    assert d("mala sanga he unhat tikta ka nako") == "mr"
    # English, and mostly-English Hinglish below the threshold
    assert d("Can I store this in the fridge?") == "en"
    assert d("what is the shelf life of this paani based spray") == "en"
    # No letters at all keeps the fallback
    assert d("???", "hi") == "hi"
    assert d("", "mr") == "mr"


def test_dew_reply_instructs_detected_language(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    captured = {}

    class FakeResp:
        def raise_for_status(self): pass
        def json(self):
            return {"candidates": [{"content": {"parts": [{"text": "ठीक है"}]}}]}

    class FakeClient:
        def __init__(self, **kw): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def post(self, url, params=None, json=None):
            captured["json"] = json
            return FakeResp()

    monkeypatch.setattr(dewchat.httpx, "AsyncClient", FakeClient)
    import asyncio
    # English UI selected, but the question is romanized Hindi: the system
    # instruction must ask for Hindi, not English.
    out = asyncio.run(dewchat.reply("kya main ise dhoop me rakh sakta hoon?", "en", [], {}))
    assert out == "ठीक है"
    sys_prompt = captured["json"]["system_instruction"]["parts"][0]["text"]
    assert "Hindi written in Devanagari" in sys_prompt
    assert "English. If" not in sys_prompt.split("Reply in ")[1][:20]


def test_dew_endpoint_returns_effective_lang(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")

    async def fake_reply(message, lang, history, context):
        return "ठीक है, शाम को छिड़काव करें।"

    monkeypatch.setattr(dewchat, "reply", fake_reply)
    r = client.post("/api/dew", json={**BODY, "lang": "en",
                                      "message": "kya yeh dhoop me kharab hota hai kya"})
    assert r.status_code == 200
    assert r.json()["lang"] == "hi"
    r = client.post("/api/dew", json=BODY)
    assert r.json()["lang"] == "en"
