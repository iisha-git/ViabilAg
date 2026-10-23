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
