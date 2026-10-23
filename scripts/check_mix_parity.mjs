// Checks the browser pair-matching (frontend/src/js/mixcheck.js) against the
// Python backend. Run:  node scripts/check_mix_parity.mjs
// (needs the backend running on :8000, or set API=...)
import { readFileSync } from "node:fs";

const API = process.env.API || "http://localhost:8000";
const pairs = JSON.parse(readFileSync(new URL("../data/evidence/pairs.json", import.meta.url)));

const httpFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  if (String(url).endsWith("pairs.json")) return { json: async () => pairs };
  return httpFetch(url, opts);
};
const mix = await import("../frontend/src/js/mixcheck.js");
await mix.load();

const cases = [
  ["T34 BIOCONTROL. Trichoderma asperellum strain T34, biological fungicide.",
   "TILT 25 EC systemic fungicide. Active ingredient: propiconazole 25% EC. Expiry date: 08/2024"],
  ["RootShield WP Biological Fungicide, Trichoderma harzianum strain KRL-AG2.",
   "Banner MAXX propiconazole fungicide for turf diseases."],
  ["BlightBan A506, Pseudomonas fluorescens A506 for fire blight suppression.",
   "KOCIDE copper hydroxide fungicide and bactericide for vegetables."],
  ["BotaniGard ES, live spores of Beauveria bassiana strain GHA. For whiteflies and aphids.",
   "Dithane M-45 mancozeb 75% WP protectant fungicide."],
  ["Trianum-P. Trichoderma harzianum T-22. For soil borne diseases.",
   "DiPel DF Biological Insecticide. Bacillus thuringiensis subsp. kurstaki."],
  ["Gentle hand soap with lavender oil and glycerin. Keep away from eyes.",
   "TILT 25 EC systemic fungicide, propiconazole 25%."],
];

cases.push(["DiPel DF biological insecticide for caterpillar pests.", "DiPel DF biological insecticide with Bacillus thuringiensis."]);
for (const [a,b] of [...cases]) cases.push([b,a]);

let bad = 0;
for (const [a, b] of cases) {
  const js = mix.mixCheck(a, b);
  const py = await (await httpFetch(API + "/api/mixcheck", { method: "POST",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text_a: a, text_b: b }) })).json();
  const same = js.status === py.status && js.reason === py.reason
    && (js.product_a.product?.id || null) === (py.product_a.product?.id || null)
    && (js.product_b.product?.id || null) === (py.product_b.product?.id || null)
    && js.findings.length === py.findings.length
    && js.findings.every((f, i) => f.rule_id === py.findings[i].rule_id)
    && JSON.stringify(js.product_b.actives) === JSON.stringify(py.product_b.actives)
    && (js.product_b.expiry?.iso || null) === (py.product_b.expiry?.iso || null);
  if (!same) bad++;
  console.log(same ? "ok  " : "FAIL", js.status.padEnd(11), (js.product_a.product?.id || "?").padEnd(14), "vs", (js.product_b.product?.id || js.product_b.actives[0]?.id || "?"));
  if (!same) console.log("  js:", JSON.stringify(js).slice(0, 300), "\n  py:", JSON.stringify(py).slice(0, 300));
}
process.exit(bad ? 1 : 0);
