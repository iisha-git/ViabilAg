// Speech is a separate presentation of the reply. Never change the visible
// evidence or drop safety qualifiers to make a shorter spoken answer.
export function spokenText(value, lang = "en") {
  let s = String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, "")
    .replace(/\s+\d+\)\s+/g, " ")
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\[(?:\d+[\s,;–-]*)+\]/g, " ")
    .replace(/\[(?:laughs?|sighs?|whispers?|excited|curious|serious|pause)\]/gi, " ")
    // The common duplicate: Bt immediately followed by its Latin expansion.
    .replace(/\bBt\s*[\[(]Bacillus\s+thuringiensis[\])]/gi, "Bt")
    // Other parentheses may contain a restriction or a dose. Keep the words,
    // but don't ask a TTS engine to pronounce the bracket punctuation.
    .replace(/[()[\]{}]/g, ", ")
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, "")
    .replace(/\s+\d+\)\s+/g, " ")
    .replace(/[*_`#]/g, "")
    .replace(/\s+[-–—]\s+/g, ", ")
    .replace(/\bB\s*\.?\s*T\b\.?/gi, "Bt")
    .replace(/\bBt\b/g, { en: "bee tee", hi: "बी टी", mr: "बी टी" }[lang] || "bee tee")
    .replace(/\bpH\b/g, lang === "en" ? "pee aitch" : "पी एच")
    .replace(/[,;:]\s*([.!?।])/g, "$1")
    .replace(/([.!?।])\s*[,;:]+/g, "$1 ")
    .replace(/[,;:](?:\s*[,;:])+/g, ",")
    .replace(/\s+([,.!?।])/g, "$1")
    .replace(/([.!?।])(?=[\p{L}])/gu, "$1 ")
    .replace(/\s+/g, " ").replace(/^[,;:\s]+|[,;:\s]+$/g, "").trim();
  if (s && !/[.!?।]$/.test(s)) s += ".";
  return s;
}

export function speechParts(text) {
  // A full stop inside a decimal is not a sentence boundary. No slice(1500):
  // cutting a reply can remove the caution at its end.
  const sentences = String(text).match(/.*?(?:[!?।]+|\.(?!\d)|$)(?:\s+|$)/gu)?.filter(x => x.trim()) || [];
  return sentences.flatMap(sentence => {
    const words = sentence.trim().split(/\s+/), out = [];
    let chunk = "";
    for (const word of words) {
      if (chunk && chunk.length + word.length > 260) { out.push(chunk); chunk = ""; }
      chunk += (chunk ? " " : "") + word;
    }
    if (chunk) out.push(chunk);
    return out;
  });
}

export function speechMood(text) {
  if (/not |don't|do not|cannot|unknown|no evidence|नहीं|नाही|नका|मत |नये/i.test(text)) return "unsure";
  if (/[?？]/.test(text)) return "think";
  return "hello";
}

export function chooseVoice(voices, tag) {
  const language = tag.split("-")[0];
  return voices.filter(v => v.localService && v.lang.toLowerCase().split(/[-_]/)[0] === language)
    .sort((a, b) => Number(b.lang.toLowerCase() === tag.toLowerCase()) - Number(a.lang.toLowerCase() === tag.toLowerCase()) || a.name.localeCompare(b.name))[0];
}
