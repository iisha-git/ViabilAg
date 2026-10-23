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


def test_dew_validation():
    assert client.post("/api/dew", json={"message": ""}).status_code == 422
    assert client.post("/api/dew", json={"message": "x", "lang": "fr"}).status_code == 422
