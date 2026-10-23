// Browser fallback: the same classifier + evidence logic as backend/app/services/*.py,
// used only when there is no backend (static hosting). Keep in sync with the Python;
// scripts/check_parity.mjs checks both give the same probabilities.
const D = "assets/data/";
let M, E, R, S, X;

export async function load() {
  [M, E, R, S, X] = await Promise.all(["model", "evidence", "rules", "samples", "metrics"].map(n => fetch(D + n + ".json").then(r => r.json())));
}
export const samples = () => S;
export const modelInfo = () => ({ ...M.meta, threshold: M.threshold, classes: M.classes,
  measured: { holdout_accuracy: X.holdout_accuracy, loo_accuracy: X.loo_accuracy, n_documents: X.n_documents, class_counts: X.class_counts } });

export function tokenize(text) {
  const toks = text.toLowerCase().match(/\b\w\w+\b/gu) || [];
  const feats = toks.slice();
  for (let i = 0; i < toks.length - 1; i++) feats.push(toks[i] + " " + toks[i + 1]);
  return feats;
}

export function predict(text, model = M) {
  const counts = new Map();
  for (const t of tokenize(text)) {
    const idx = model.vocabulary[t];
    if (idx !== undefined) counts.set(idx, (counts.get(idx) || 0) + 1);
  }
  const x = new Map(); let norm = 0;
  for (const [i, c] of counts) { const v = (1 + Math.log(c)) * model.idf[i]; x.set(i, v); norm += v * v; }
  norm = Math.sqrt(norm) || 1;
  const logits = model.classes.map((_, ci) => {
    let s = model.intercept[ci];
    for (const [i, v] of x) s += (v / norm) * model.coef[ci][i];
    return s;
  });
  const mx = Math.max(...logits);
  const exps = logits.map(l => Math.exp(l - mx));
  const sum = exps.reduce((a, b) => a + b, 0);
  const ranking = model.classes.map((c, i) => ({ class: c, probability: exps[i] / sum })).sort((a, b) => b.probability - a.probability);
  const best = ranking[0];
  return { class: best.class, probability: best.probability, threshold: model.threshold,
    abstain: best.probability < model.threshold, ranking, known_terms: counts.size };
}

function phAdvice(ph) {
  if (!(ph >= 0 && ph <= 14)) return null;
  for (const b of R.ph.bands) {
    if (b.max_exclusive !== undefined && ph < b.max_exclusive) return { level: b.level, text: b.text, source: R.ph.source };
    if (b.max_inclusive !== undefined && ph <= b.max_inclusive) return { level: b.level, text: b.text, source: R.ph.source };
  }
  return null;
}

async function weather(cls, lat, lon) {
  try {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,uv_index&timezone=auto`;
    const c = (await (await fetch(u)).json()).current;
    const w = { temperature_c: c.temperature_2m, humidity_pct: c.relative_humidity_2m, uv_index: c.uv_index, observed_at: c.time,
      source: { name: "Open-Meteo forecast API", url: "https://open-meteo.com/en/docs" } };
    let flag = null;
    for (const f of R.weather.flags) {
      if (f.class !== cls) continue;
      const v = f.metric === "temperature_c" ? w.temperature_c : w.uv_index;
      if (v != null && v >= f.app_threshold) flag = { text: f.text, source: f.source };
    }
    return { ...w, flag, no_flag_text: R.weather.no_flag_text };
  } catch { return { error: "Weather lookup failed (needs internet)." }; }
}

export async function conditions(cls, { ph, lat, lon }) {
  const out = {};
  if (ph != null) out.ph = phAdvice(ph);
  if (lat != null && lon != null) out.weather = await weather(cls, lat, lon);
  return out;
}

export async function analyze({ text, ph, lat, lon }) {
  const prediction = predict(text);
  const ev = E.classes[prediction.class];
  const disclaimer = "Evidence, not spray orders. The product-type guess is a small ML model; the sources carry the weight. When unsure, ask an agronomist.";
  if (prediction.abstain || !ev) return { status: "abstain", prediction, disclaimer,
    message: "Not enough evidence for this product. Check with an agronomist before you mix or spray." };
  return { status: "found", prediction, evidence: ev, common: E.common, disclaimer,
    conditions: await conditions(prediction.class, { ph, lat, lon }) };
}
