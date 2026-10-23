// Browser mirror of backend/app/services/pairs.py: identify both products from
// label text, then apply curated, cited pair rules. Used in static mode (no
// backend) and inside the Android app. Keep in sync with the Python version;
// scripts/check_mix_parity.mjs checks both agree.
const D = "assets/data/";
let P = null;

export async function load() {
  P = await fetch(D + "pairs.json").then(r => r.json());
}

const PESTICIDE_WORDS = /\b(fungicide|insecticide|herbicide|pesticide|miticide|acaricide|bactericide|nematicide|weedicide|larvicide|molluscicide|rodenticide)\b/i;
const FORMULATIONS = ["WDG", "WSG", "WP", "WG", "ESO", "ES", "EC", "EW", "SC", "SE", "SL", "OD", "DF", "GR"];
const FORMULATION_RE = new RegExp("\\b(" + FORMULATIONS.join("|") + ")\\b");
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const EXPIRY_RE = /(?:expiry|expiration|expires|exp\.?|use\s*(?:by|before)|best\s*before|not\s*to\s*be\s*used\s*after)\s*(?:date)?\s*[:\-]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{1,2}[\/\-.]\d{4}|\d{1,2}\s+[A-Za-z]{3,9}\.?\s*,?\s*\d{2,4}|[A-Za-z]{3,9}\.?\s*\d{4})/i;

function wordHit(text, needle) {
  return new RegExp("(?<![\\w])" + needle.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\w])").test(text.toLowerCase());
}

export function identifyProduct(text) {
  let best = null, bestLen = 0;
  for (const [pid, p] of Object.entries(P.products)) {
    for (const fp of p.fingerprints) {
      if (fp.length > bestLen && wordHit(text, fp)) { best = { id: pid, ...p }; bestLen = fp.length; }
    }
  }
  return best;
}

export function detectActives(text) {
  const out = [];
  for (const [aid, a] of Object.entries(P.active_ingredients)) {
    if (a.names.some(n => wordHit(text, n))) out.push({ id: aid, name: a.display, type: a.type });
  }
  return out;
}

export function detectCategories(text, actives) {
  const cats = new Set(actives.map(a => a.type));
  for (const c of ["fungicide", "insecticide", "herbicide"]) if (wordHit(text, c)) cats.add(c);
  return [...cats].sort();
}

export function extractFormulation(text) {
  const m = text.match(FORMULATION_RE);
  return m ? m[1] : null;
}

function parseExpiry(raw) {
  const s = raw.trim().replace(",", "");
  let m = s.match(/^(\d{1,2})[\/\-.](\d{4})$/);
  if (m) { const mo = +m[1]; return mo >= 1 && mo <= 12 ? new Date(+m[2], mo - 1, 1) : null; }
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let [a, b, y] = [+m[1], +m[2], +m[3]]; if (y < 100) y += 2000;
    const [mo, d] = a <= 12 ? [a, b] : [b, a];
    return new Date(y, mo - 1, Math.min(d, 28));
  }
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?\s*(\d{2,4})$/);
  if (m) { const mo = MONTHS[m[2].slice(0, 3).toLowerCase()]; let y = +m[3]; if (y < 100) y += 2000; return mo ? new Date(y, mo - 1, 1) : null; }
  m = s.match(/^([A-Za-z]{3,9})\.?\s*(\d{4})$/);
  if (m) { const mo = MONTHS[m[1].slice(0, 3).toLowerCase()]; return mo ? new Date(+m[2], mo - 1, 1) : null; }
  return null;
}

export function extractExpiry(text) {
  const m = text.match(EXPIRY_RE);
  if (!m) return null;
  const d = parseExpiry(m[1]);
  const iso = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : null;
  return { raw: m[1], iso, expired: d ? d < new Date() : null };
}

export function describeProduct(text) {
  const actives = detectActives(text);
  return {
    product: identifyProduct(text),
    actives,
    categories: detectCategories(text, actives),
    formulation: extractFormulation(text),
    expiry: extractExpiry(text),
    looks_like_pesticide: PESTICIDE_WORDS.test(text),
  };
}

function otherMatches(ruleOther, b) {
  if (ruleOther.kind === "any_pesticide") {
    if (b.actives.length) return b.actives[0].name;
    if (b.looks_like_pesticide || b.product) return "a pesticide";
    return null;
  }
  if (ruleOther.kind === "category") return b.categories.includes(ruleOther.category) ? ruleOther.category : null;
  if (ruleOther.kind === "active_ingredient") {
    for (const a of b.actives) if (ruleOther.any_of.includes(a.id)) return a.name;
  }
  return null;
}

export function mixCheck(textA, textB) {
  const a = describeProduct(textA), b = describeProduct(textB);
  const findings = [];
  if (a.product) {
    for (const rule of P.rules) {
      if (!rule.bio.includes(a.product.id)) continue;
      const hit = otherMatches(rule.other, b);
      if (hit) findings.push({ rule_id: rule.id, verdict: rule.verdict,
        headline: rule.headline.replace("{ai}", hit), scope: rule.scope,
        what_tested: rule.what_tested, source: rule.source });
    }
  }
  const status = findings.some(f => f.verdict === "conflict") ? "conflict" : findings.length ? "limited" : "no_evidence";
  let reason = null;
  if (!a.product) reason = "product_a_unknown";
  else if (status !== "no_evidence") reason = null;
  else if (b.product || b.actives.length || b.looks_like_pesticide) reason = "no_pair_evidence";
  else reason = "product_b_unknown";
  return { status, reason, product_a: a, product_b: b, findings,
    disclaimer: "Product matches come from the words on the scanned labels, not from a product database or a lab test. Compatibility findings are product-specific. bioOasis never recommends doses, mixing recipes or spray timings." };
}
