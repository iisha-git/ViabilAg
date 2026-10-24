// Only explicit guide requests take a shortcut. Topic words inside a full
// farming question must never replace its meaning with a canned answer.
const PHRASES = {
  sun: ["sun", "sunlight", "uv", "dhup", "dhoop", "धूप", "सूर्यप्रकाश"],
  water: ["water", "ph", "paani", "pani", "पानी", "पाणी"],
  mix: ["mix", "mix two products", "tank mix", "दो प्रोडक्ट मिलाएँ", "दो प्रोडक्ट मिलाएं", "दोन प्रोडक्ट मिसळा"],
  scan: ["scan", "label", "photo", "scan a label", "check a label", "लेबल जाँचें", "लेबल जांचें", "लेबल तपासा"],
  what: ["help", "what can you do", "what can you do for me", "how can you help", "how can you help me",
    "आप क्या कर सकते हो", "आप क्या कर सकते हैं", "तुम क्या कर सकते हो", "ड्यू क्या कर सकता है",
    "तू काय करू शकतोस", "तुम्ही काय करू शकता", "ड्यू काय करू शकतो"],
  thanks: ["thank you", "thanks", "shukriya", "dhanyavad", "धन्यवाद", "शुक्रिया", "आभार"],
  greet: ["hi", "hello", "hey", "namaste", "नमस्ते", "नमस्कार", "हाय", "हॅलो"],
};

export function normalizeGuideRequest(text) {
  return String(text).normalize("NFC").toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

const GUIDE_REQUESTS = new Map(Object.entries(PHRASES)
  .flatMap(([key, phrases]) => phrases.map(p => [normalizeGuideRequest(p), key])));

export function guideIntent(text) {
  return GUIDE_REQUESTS.get(normalizeGuideRequest(text)) || null;
}

// --- Topical triggers for Dew's grounded caterpillar/Bt conversation ---
// Unlike the generic words that caused the old routing bug, a specific pest
// or organism word makes the topic unambiguous: any sentence containing it
// really is about it. Matching is whole-word on the normalized text, so
// inflections must be listed explicitly.

const _CATERPILLAR = new Set([
  "caterpillar", "caterpillars", "कैटरपिलर", "कॅटरपिलर",
  "अळी", "अळ्या", "अळ्यांना", "अळ्यांपासून", "अळ्यांमुळे",
]);

const _SPRAY_WORDS = new Set(["spray", "spraying", "sprays", "फवारणी", "छिड़काव", "छिड़कें", "फवारा", "फवारायचे", "फवारायचं", "फवारणीची"]);
const _HOW_WORDS = new Set(["how", "when", "procedure", "timing", "schedule", "dose", "dosage", "time",
  "कब", "कैसे", "प्रक्रिया", "विधि", "तरीका", "मात्रा", "समय",
  "केव्हा", "कसं", "कसे", "कशी", "पद्धत", "वेळ"]);

function _tokens(text) {
  return normalizeGuideRequest(text).split(" ").filter(Boolean);
}

export function pestIntent(text) {
  return _tokens(text).some(t => _CATERPILLAR.has(t)) ? "caterpillar" : null;
}

export function btIntent(text) {
  const n = normalizeGuideRequest(text);
  return n.includes("bacillus thuringiensis") || _tokens(text).includes("bt") ? "bt" : null;
}

// A how/when-to-spray question. Without a spray word it still counts when the
// conversation is already about Bt ("and the perfect time?"), handled by the
// caller passing topicIsBt.
const NON_BT_PRODUCT_WORDS = [
  "weedicide", "herbicide", "glyphosate", "fungicide",
  "तणनाशक", "खरपतवार", "बुरशीनाशक", "फफूंदनाशक", "कवकनाशक",
];

// A procedure/timing question that names a non-Bt product class must not get
// the Bt spray guide; it is an open question for the AI.
export function nonBtProductIntent(text) {
  const t = ` ${String(text || "").toLowerCase()} `;
  return NON_BT_PRODUCT_WORDS.some((w) => t.includes(` ${w}`) || t.includes(`${w} `) || t.includes(` ${w} `));
}

export function sprayHowIntent(text, topicIsBt = false) {
  const toks = _tokens(text);
  const hasHow = toks.some(t => _HOW_WORDS.has(t));
  if (!hasHow) return false;
  if (toks.some(t => _SPRAY_WORDS.has(t))) return true;
  return topicIsBt;
}
