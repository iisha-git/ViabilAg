"""Dew's open-question replies, proxied through Google Gemini.

The API key lives ONLY in the server's GEMINI_API_KEY environment variable -
never in the app, the APK, or the repo. The app sends chat text plus the
recognized label text the user is asking about; photos are never sent. When
no key is configured the endpoint reports unavailable and the app keeps
using its built-in guided answers.
"""
import os
import re

import httpx

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")  # 3.8-flash free-tier latency measured 35-100s+; 3.6-flash ~1s
TIMEOUT_S = float(os.getenv("GEMINI_TIMEOUT_S", "45"))  # observed cold calls on 3.8-flash can run long

LANG_NAME = {"en": "English", "hi": "Hindi written in Devanagari script",
             "mr": "Marathi written in Devanagari script"}

# Per-turn language matching. The app's EN/HI/MR buttons set the default, but a
# question asked in another of the three languages - typed or speech-recognized,
# including romanized Hindi/Marathi from an English-mode recognizer - must be
# answered in THAT language. Mirrors the heuristic in frontend/src/js/dew.js.
_DEVANAGARI = re.compile(r"[ऀ-ॿ]")
_MR_DEVANAGARI = {"आहे", "आहेत", "नाही", "मी", "तू", "तुम्ही", "काय", "कसं", "कसा", "मला", "तुमचा", "तुमची", "तुमचे", "माझा", "माझी", "माझे", "माझ्या", "तुमच्या", "पाणी", "होय", "पाहिजे", "करतो", "करायचं", "कसे", "केव्हा", "कशी", "फवारायचे", "आणि", "वेळ"}
_ROMAN_HI = {"kya", "kyu", "kyun", "hai", "hain", "nahi", "nahin", "mujhe", "mera", "meri", "mere",
             "kaise", "kaisa", "kitna", "kitni", "paani", "dhup", "dhoop", "accha", "acha", "theek",
             "thik", "batao", "bata", "chahiye", "karna", "karo", "bolo", "suno", "aapka", "aapki",
             "tumhara", "tumhari", "hoon", "sakta", "sakti", "kare", "karen", "kab", "rakhna",
             "rakho", "lagana", "dalna", "bataye", "bataiye", "garam", "thanda", "kharab", "zyada"}
_ROMAN_MR = {"nako", "kasa", "kashi", "kay", "zala", "zali", "sanga", "sangitla", "majha", "majhi",
             "aahe", "ahe", "ahet", "pahije", "mhanje", "tumcha", "tumchi", "kara", "karat", "naahi"}


def detect_lang(message: str, fallback: str = "en") -> str:
    """Best-effort language of one user message: en, hi, or mr.

    Devanagari is decisive (Marathi marker words separate mr from hi). Roman
    text is matched against common Hindi/Marathi words; with no recognizable
    hint we assume English, and with no letters at all we keep the fallback.
    """
    if _DEVANAGARI.search(message):
        words = re.findall(r"[ऀ-ॿ]+", message)
        return "mr" if any(w in _MR_DEVANAGARI for w in words) else "hi"
    words = re.findall(r"[a-z']+", message.lower())
    if not words:
        return fallback
    mr = sum(1 for w in words if w in _ROMAN_MR)
    if mr >= 1 and mr >= len(words) * 0.2:
        return "mr"
    hi = sum(1 for w in words if w in _ROMAN_HI)
    if hi >= 1 and hi >= len(words) * 0.2:
        return "hi"
    return "en"

SYSTEM = """You are Dew, a small friendly water-drop mascot inside bioOasis, an app that helps farmers check biological (living) crop-treatment products such as Bt, Trichoderma, Pseudomonas and Beauveria.

Rules you must always follow:
- Reply in {lang}. If the user's latest message is clearly in a different one of these languages - English, Hindi, or Marathi, including romanized Hindi or Marathi - reply in the message's language instead, matching the user turn by turn. Always write Hindi and Marathi in Devanagari script, even when the user wrote them in roman letters. Keep it short: 1-4 sentences, warm and simple, no markdown, no bullet lists.
- Write for a conversation, not a report read aloud. Answer the latest question directly, with short complete sentences and real punctuation for pauses. Acknowledge a concern briefly when appropriate, without a stock greeting on every turn. Ask at most one useful follow-up. No stage directions, emotion tags, bracketed asides, acronym expansions in parentheses, or repeated initials. Keep scientific names and citations in the on-screen evidence rather than reciting them; keep every safety restriction and uncertainty in your answer. Do not claim human feelings or pretend you inspected a farm.
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
    lang = detect_lang(message, lang)
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
