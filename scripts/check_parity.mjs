// Checks the browser fallback scorer (frontend/src/js/model.js) against the Python backend.
// Run:  node scripts/check_parity.mjs   (needs the backend running on :8000, or set API=...)
import { readFileSync } from "node:fs";
import { predict } from "../frontend/src/js/model.js";

const API = process.env.API || "http://localhost:8000";
const model = JSON.parse(readFileSync(new URL("../ml/artifacts/model.json", import.meta.url)));
const samples = JSON.parse(readFileSync(new URL("../data/samples.json", import.meta.url)));
let bad = 0;
for (const s of samples) {
  const js = predict(s.text, model);
  const py = (await (await fetch(API + "/api/classify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: s.text }) })).json());
  const diff = Math.abs(js.probability - py.probability);
  const ok = js.class === py.class && diff < 1e-9;
  if (!ok) bad++;
  console.log(ok ? "ok  " : "FAIL", s.label.padEnd(32), js.class, js.probability.toFixed(6), "diff", diff.toExponential(1));
}
process.exit(bad ? 1 : 0);
