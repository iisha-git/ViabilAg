"""Dew's open-question replies, proxied through Google Gemini.

The API key lives ONLY in the server's GEMINI_API_KEY environment variable -
never in the app, the APK, or the repo. The app sends chat text plus the
recognized label text the user is asking about; photos are never sent. When
no key is configured the endpoint reports unavailable and the app keeps
using its built-in guided answers.
"""
import os

import httpx

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")  # 3.8-flash free-tier latency measured 35-100s+; 3.6-flash ~1s
TIMEOUT_S = float(os.getenv("GEMINI_TIMEOUT_S", "45"))  # observed cold calls on 3.8-flash can run long

LANG_NAME = {"en": "English", "hi": "Hindi written in Devanagari script",
             "mr": "Marathi written in Devanagari script"}

SYSTEM = """You are Dew, a small friendly water-drop mascot inside bioOasis, an app that helps farmers check biological (living) crop-treatment products such as Bt, Trichoderma, Pseudomonas and Beauveria.

Rules you must always follow:
- Reply only in {lang}. Keep it short: 1-4 sentences, warm and simple, no markdown, no bullet lists.
- Product or farming claims must come from the FACTS below or be clearly marked as general caution. Never invent doses, mixing ratios, spray intervals, prices, or survival percentages.
- If you do not have evidence for something, say you do not know and suggest asking an agronomist. Honest "I don't know" is a feature of this app.
- Never ask for or repeat personal data, keys, or passwords.
"""


def available() -> bool:
    return bool(os.getenv("GEMINI_API_KEY"))


async def reply(message: str, lang: str, history: list[dict], context: dict) -> str:
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        raise RuntimeError("no-key")
    parts = [SYSTEM.replace("{lang}", LANG_NAME.get(lang, LANG_NAME["en"]))]
    name = context.get("name")
    if name:
        parts.append(f"The product the user scanned this session: {name} (type: {context.get('cls') or 'unknown'}).")
    facts = [f for f in (context.get("facts") or []) if isinstance(f, str)][:8]
    if facts:
        parts.append("FACTS from the product label and cited research:\n- " + "\n- ".join(facts))
    if context.get("mix"):
        parts.append(f"Latest two-product check the user ran: {context['mix']}")

    contents = []
    for h in history[-8:]:
        role = "user" if h.get("role") == "user" else "model"
        text = str(h.get("text", ""))[:1000]
        if text:
            contents.append({"role": role, "parts": [{"text": text}]})
    contents.append({"role": "user", "parts": [{"text": message[:1000]}]})

    body = {
        "system_instruction": {"parts": [{"text": "\n\n".join(parts)}]},
        "contents": contents,
        "generationConfig": {
            # 3.8-flash is a thinking model: reasoning shares this budget, so a
            # small cap truncates the visible answer mid-word. 1024 leaves room
            # for thought plus the 1-4 sentence reply we ask for.
            # (thinkingConfig/thinkingBudget 0 was tried and hangs this model.)
            "maxOutputTokens": 1024,
            "temperature": 0.4,
        },
    }
    async with httpx.AsyncClient(timeout=TIMEOUT_S) as client:
        r = await client.post(
            GEMINI_URL.format(model=MODEL),
            params={"key": key},
            json=body,
        )
        r.raise_for_status()
        d = r.json()
    cands = d.get("candidates") or []
    text = "".join(p.get("text", "") for p in (cands[0].get("content", {}).get("parts") or [])).strip()
    if not text:
        raise RuntimeError("empty-reply")
    return text
