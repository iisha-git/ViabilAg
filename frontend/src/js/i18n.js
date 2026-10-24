/* Shared platform language: English / Hindi / Marathi.
   Dew's chat keeps its own richer dictionary in dew.js; this module owns the
   platform chrome and stays in sync with Dew through the "biolang" listener
   list and the shared storage keys. Product names, numbers and citations are
   never translated. No external translation service is used. */
(() => {
  const KEYS = ["biooasis-lang", "biooasis-dew-lang"];
  const NAMES = { en: "English", hi: "हिन्दी", mr: "मराठी" };
  const D = {
    en: {
      "settings.title": "Settings",
      "settings.look": "Pick a look. Same content in all of them.",
      "settings.language": "Language",
      "settings.languageNote": "Menus and buttons. Product names and study text stay as printed.",
      "settings.sounds": "Sounds",
      "settings.soundsNote": "Soft taps and step chimes. Off means fully silent.",
      "settings.privacy": "Your choices are saved on this device only. Nothing is sent anywhere.",
      "settings.done": "Done",
      "on": "On",
      "off": "Off",
      "theme.lilac.note": "Soft, calm and premium",
      "theme.pop.note": "Playful, bold and loud",
      "theme.aurora.note": "Dark, glowing and techy"
    },
    hi: {
      "settings.title": "सेटिंग्स",
      "settings.look": "एक लुक चुनें। हर लुक में सामग्री वही रहती है।",
      "settings.language": "भाषा",
      "settings.languageNote": "मेनू और बटन। प्रोडक्ट के नाम और शोध का मूल पाठ छपे रूप में रहता है।",
      "settings.sounds": "आवाज़",
      "settings.soundsNote": "हल्की टैप और चरण-ध्वनियाँ। बंद यानी पूरी शांति।",
      "settings.privacy": "आपकी पसंद सिर्फ इसी डिवाइस पर सहेजी जाती है। कहीं नहीं भेजी जाती।",
      "settings.done": "हो गया",
      "on": "चालू",
      "off": "बंद",
      "theme.lilac.note": "नरम, शांत और प्रीमियम",
      "theme.pop.note": "चुलबुला, बोल्ड और ज़ोरदार",
      "theme.aurora.note": "डार्क, चमकीला और टेकी"
    },
    mr: {
      "settings.title": "सेटिंग्ज",
      "settings.look": "एक लुक निवडा. प्रत्येक लुकमध्ये मजकूर तोच असतो.",
      "settings.language": "भाषा",
      "settings.languageNote": "मेनू आणि बटणे. प्रोडक्टची नावे आणि संशोधन मजकूर छापील स्वरूपातच राहतो.",
      "settings.sounds": "आवाज",
      "settings.soundsNote": "सौम्य टॅप आणि पायरी-घंटा. बंद म्हणजे पूर्ण शांतता.",
      "settings.privacy": "तुमची निवड फक्त याच डिव्हाइसवर जतन होते. कुठेही पाठवली जात नाही.",
      "settings.done": "झाले",
      "on": "चालू",
      "off": "बंद",
      "theme.lilac.note": "सौम्य, शांत आणि प्रीमियम",
      "theme.pop.note": "छट्ट्याचा, ठळक आणि जोरदार",
      "theme.aurora.note": "गडद, चमकदार आणि तंत्रज"
    }
  };
  let lang = localStorage.getItem("biooasis-lang") || localStorage.getItem("biooasis-dew-lang") || "en";
  if (!D[lang]) lang = "en";
  const listeners = [];
  function t(k) { const v = (D[lang] && D[lang][k]) ?? D.en[k]; return v == null ? k : v; }
  function set(l) {
    if (!D[l] || l === lang) return;
    lang = l;
    KEYS.forEach(k => localStorage.setItem(k, l));
    apply(document);
    listeners.forEach(f => { try { f(l); } catch (_) {} });
  }
  function apply(root) {
    (root || document).querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
    (root || document).querySelectorAll("[data-i18n-ph]").forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  }
  window.bioI18n = { t, set, apply, names: NAMES, langs: Object.keys(NAMES), onChange: f => listeners.push(f) };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => apply(document));
  else apply(document);
  Object.defineProperty(window.bioI18n, "lang", { get: () => lang });
})();
