// Talks to the backend when it exists, and falls back to doing the same work in the
// browser (model.js) when it does not, so the app also works on static hosting.
import * as local from "./model.js";
import * as mix from "./mixcheck.js";

// Set only in frontend/assets/config.js. A URL query parameter must never pick the
// backend: a crafted link could otherwise send label text to someone else's server.
const BASE = (window.BIOOASIS_API || "").replace(/\/$/, "");
let mode = "unknown"; // "api" | "static"

async function json(url, opts) {
  const r = await fetch(BASE + url, opts);
  if (!r.ok) throw Object.assign(new Error(`${r.status}`), { status: r.status, body: await r.json().catch(() => ({})) });
  return r.json();
}

export async function init() {
  try {
    const h = await json("/api/health");
    mode = h.status === "ok" ? "api" : "static";
  } catch { mode = "static"; }
  if (mode === "static") { await local.load(); await mix.load(); }
  return mode;
}
export const getMode = () => mode;

export async function samples() {
  return mode === "api" ? json("/api/samples") : local.samples();
}

export async function modelInfo() {
  return mode === "api" ? json("/api/model") : local.modelInfo();
}

export async function analyze({ text, ph, lat, lon }) {
  if (mode === "api") {
    return json("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, ph: ph ?? null, lat: lat ?? null, lon: lon ?? null }) });
  }
  return local.analyze({ text, ph, lat, lon });
}

export async function conditions(cls, { ph, lat, lon }) {
  if (mode === "api") {
    // POST, not GET: coordinates in a URL end up in server access logs and
    // browser history. In a request body they do not.
    return json("/api/conditions", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cls, ph: ph ?? null, lat: lat ?? null, lon: lon ?? null }) });
  }
  return local.conditions(cls, { ph, lat, lon });
}

export async function serverOcr(file) {
  if (mode !== "api") throw new Error("no backend");
  const fd = new FormData(); fd.append("file", file);
  return (await json("/api/ocr", { method: "POST", body: fd })).text;
}

export async function dewChat(payload) {
  if (mode !== "api") throw new Error("no backend");
  return (await json("/api/dew", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload) })).reply;
}

export async function mixcheck({ textA, textB }) {
  if (mode === "api") {
    return json("/api/mixcheck", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text_a: textA, text_b: textB }) });
  }
  return mix.mixCheck(textA, textB);
}
