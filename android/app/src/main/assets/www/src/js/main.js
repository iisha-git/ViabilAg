import * as api from "./api.js";
import { readLabel } from "./ocr.js";
import { mascot, DEFS, CLOUD } from "./mascot.js";
import { ICON } from "./icons.js";
import * as snd from "./sounds.js";
import * as dew from "./dew.js";

const $ = (id) => document.getElementById(id);

// Short on-screen note for diagnostics sent by the Android shell (e.g. what the
// scan tap triggered). Harmless on the website: nothing ever calls it there.
window.bioNativeNote = msg => {
  let t = document.getElementById("native-toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "native-toast";
    t.style.cssText = "position:fixed;left:50%;bottom:88px;transform:translateX(-50%);background:#21312b;color:#f3ecdc;padding:8px 16px;border-radius:999px;font-size:13px;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.25);transition:opacity .3s";
    document.body.appendChild(t);
  }
  t.textContent = String(msg);
  t.style.opacity = "1";
  clearTimeout(t._h);
  t._h = setTimeout(() => { t.style.opacity = "0"; }, 2600);
};
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const IMG = "assets/images/";
const CLASS_IMG = { bt: "bt.jpg", trichoderma: "trichoderma.jpg", pseudomonas: "pseudomonas.jpg", beauveria: "beauveria.jpg" };
const state = { samples: [], credits: {}, current: null, cls: null, loc: null, mix: null, fileTarget: "a" };

/* ---------- boot ---------- */
document.body.insertAdjacentHTML("afterbegin", DEFS);
$("hero-dew").innerHTML = mascot("hello");
for (const [id, k] of [["ico-cam", "camera"], ["ico-cam2", "camera"], ["ico-cam3", "camera"], ["ico-back1", "back"], ["ico-back2", "back"], ["ico-back3", "back"], ["ico-back4", "back"], ["ico-back5", "back"], ["ico-back6", "back"], ["ico-back-dew", "back"], ["ico-swap", "swap"]]) $(id).innerHTML = ICON[k];
$("how").innerHTML = [
  ["camera", "Snap the label", "Front or back of the bottle or packet. No label at hand? Tap a real sample below."],
  ["text", "Dew reads it", "The text is read right on your device, and you can fix any word it got wrong."],
  ["leaf", "Evidence, with sources", "What labels and research say about keeping the living organisms alive. Every line links to where it came from."],
].map(([i, t, p]) => `<div class="how-step reveal"><div class="how-ico">${ICON[i]}</div><div><h3>${t}</h3><p>${p}</p></div></div>`).join("");

(async () => {
  const mode = await api.init();
  $("mode").className = "mode " + (mode === "api" ? "on" : "");
  $("mode").innerHTML = `<i></i>${mode === "api" ? "Connected to the bioOasis backend" : "Static mode: running fully in your browser (no backend found)"}${window.BIOOASIS_VERSION ? " · v" + window.BIOOASIS_VERSION : ""}`;
  state.credits = await fetch(IMG + "credits.json").then(r => r.json()).catch(() => ({}));
  state.samples = await api.samples();
  renderSamples(); renderWhy(); renderCredits(); observeReveal();
  const h = location.hash.match(/^#demo-(\d)$/);
  if (h && state.samples[+h[1]]) pickSample(state.samples[+h[1]]);
})();

/* ---------- views ---------- */
const VIEWS = ["home", "read", "result", "stop", "mixscan", "mixconfirm", "mixresult", "dew"];
function show(v) {
  VIEWS.forEach(n => $("v-" + n).classList.toggle("hidden", n !== v));
  const el = $("v-" + v); el.style.animation = "none"; void el.offsetWidth; el.style.animation = "";
  window.scrollTo({ top: 0, behavior: "instant" });
  document.querySelectorAll(".progress-dots").forEach(p => [...p.children].forEach((d, i) => {
    const n = { read: 2, result: 3, stop: 3 }[v] ?? 0;
    d.classList.toggle("on", i < n); d.classList.toggle("now", i === n - 1);
  }));
  if (v === "home") observeReveal();
}

/* ---------- home ---------- */
function credit(key) {
  const c = state.credits[key];
  return c ? `${c.title.replace(/\.jpe?g$/i, "")} / ${c.author} / ${c.license}` : "";
}
function renderSamples() {
  const names = { bt: ["Bacterial insecticide", "Bt spray"], trichoderma: ["Root-protecting fungus", "Trichoderma"], pseudomonas: ["Helpful bacterium", "Pseudomonas"], beauveria: ["Insect-hunting fungus", "Beauveria"] };
  $("carousel").innerHTML = state.samples.map(s => `
    <button class="sample" data-id="${s.id}" aria-label="Try the ${esc(s.label)} label excerpt">
      <img src="${IMG + CLASS_IMG[s.class]}" alt="" loading="lazy">
      <span class="go">${ICON.arrow}</span>
      <span class="meta"><div class="kind">${names[s.class][0]}</div><div class="nm">${esc(s.label.replace(/\s*\(.*\)/, ""))}</div></span>
    </button>`).join("");
  $("carousel").onclick = e => { const b = e.target.closest(".sample"); if (b) pickSample(state.samples.find(s => s.id == b.dataset.id)); };
}
function renderWhy() {
  $("why-img").src = IMG + "farmer.jpg";
  $("why-cred").textContent = "Photo: " + credit("farmer");
}
function renderCredits() {
  const rows = Object.values(state.credits).map(c => `<li><b>${esc(c.title.replace(/\.jpe?g$/i, ""))}</b> by ${esc(c.author)}, ${esc(c.license)}. <a href="${esc(c.source_url)}" target="_blank" rel="noopener">Source</a></li>`).join("");
  $("credits-list").innerHTML = rows +
    `<li><b>Dew</b> (the mascot) and all icons: original artwork made for this project.</li>
     <li><b>Fraunces</b> and <b>Inter</b> fonts: SIL Open Font License 1.1.</li>
     <li>Photos show the kind of organism or crop, not the actual product. They are illustrations, not label evidence.</li>`;
}
$("open-credits").onclick = $("open-credits2").onclick = () => $("credits").showModal();
$("close-credits").onclick = () => $("credits").close();

function observeReveal() {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .12 });
  document.querySelectorAll(".reveal:not(.in)").forEach(el => io.observe(el));
}

/* ---------- read ---------- */
function toRead({ img, text = "", reading = false }) {
  show("read");
  const box = $("scanbox");
  box.classList.toggle("hidden", !img);
  if (img) $("preview").src = img;
  $("scanline").classList.toggle("hidden", !reading);
  $("reading").classList.toggle("hidden", !reading);
  $("ocrtext").value = text;
  $("ocrtext").disabled = reading;
  $("identify").disabled = reading;
  $("hint").textContent = ""; $("hint").className = "hint";
  $("reading-dew").innerHTML = mascot("think");
  $("ocrbar").style.width = "0%";
}
function pickSample(s) { state.current = s; toRead({ text: s.text }); }

function setPreview(f) {
  if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
  state.previewUrl = URL.createObjectURL(f);
  return state.previewUrl;
}
$("file").addEventListener("change", async (ev) => {
  const f = ev.target.files[0]; if (!f) return;
  if (state.fileTarget === "b") return readPhotoB(f);
  if (state.fileTarget === "chat") return dew.handlePhoto(f);
  toRead({ img: setPreview(f), reading: true });
  try {
    const text = await readLabel(f,
      p => { $("ocrbar").style.width = Math.round(p * 100) + "%"; $("ocrnote").textContent = `Dew is reading the label... ${Math.round(p * 100)}%`; },
      msg => { $("ocrnote").textContent = "Dew: " + msg; });
    $("scanline").classList.add("hidden"); $("reading").classList.add("hidden");
    $("ocrtext").disabled = false; $("identify").disabled = false;
    if (text) { $("ocrtext").value = text.replace(/[ \t]*\n(?!\n)/g, " "); $("hint").textContent = "Check the words below. Fix anything the camera got wrong."; }
    else emptyRead("Dew could not find any words in that photo. Try a sharper, closer shot in good light, or type the label text yourself.");
  } catch {
    emptyRead("Dew could not read the photo here (the reader needs an internet connection the first time). You can type or paste the label text instead.");
  }
});
function emptyRead(msg) {
  $("scanline").classList.add("hidden"); $("reading").classList.add("hidden");
  $("ocrtext").disabled = false; $("identify").disabled = false;
  $("hint").className = "hint nudge"; $("hint").textContent = msg;
}
for (const id of ["go-photo", "go-photo2"]) $(id).onclick = () => { state.fileTarget = "a"; $("file").click(); };
$("go-photo-b").onclick = () => { state.fileTarget = "b"; $("file").click(); snd.tap(); };
$("back-read").onclick = () => show("home");
$("back-result").onclick = $("again").onclick = () => { $("file").value = ""; snd.tap(); show("home"); };
$("back-stop").onclick = () => show("read");
$("stop-edit").onclick = () => show("read");
$("stop-new").onclick = () => { $("file").value = ""; show("home"); };

$("identify").onclick = async () => {
  const text = $("ocrtext").value.trim();
  if (text.length < 30) {
    $("hint").className = "hint nudge";
    $("hint").textContent = `Dew needs a little more text to work with (${text.length}/30 characters so far).`;
    $("ocrtext").focus(); return;
  }
  $("identify").disabled = true; $("identify").textContent = "Thinking...";
  try {
    const res = await api.analyze({ text });
    state.cls = res.prediction.class;
    res.status === "found" ? renderResult(res) : renderStop(res);
  } catch (e) {
    $("hint").className = "hint nudge"; $("hint").textContent = "Something went wrong talking to the app. Try again.";
  } finally { $("identify").disabled = false; $("identify").textContent = "Identify this product"; }
};

/* ---------- result ---------- */
const factHtml = f => `<div class="fact reveal"><p>${esc(f.text)}</p><a class="src-pill" href="${esc(f.source.url)}" target="_blank" rel="noopener">${ICON.arrow.replace("<svg", '<svg width="13" height="13"')}${esc(f.source.name)}</a></div>`;

function renderResult(res, navigate = true) {
  const e = res.evidence, pct = Math.round(res.prediction.probability * 100);
  state.result = res;
  $("r-img").src = IMG + CLASS_IMG[res.prediction.class];
  $("r-kind").textContent = e.kind; $("r-name").textContent = e.name; $("r-org").textContent = e.organism;
  $("r-pcred").textContent = "Photo: " + credit(res.prediction.class) + " (illustrates the organism type, not your product)";
  $("r-pct").textContent = pct + "%";
  // short version first: one cited line + two chips; everything else is one tap away in the tabs
  const key = e.research[0];
  $("q-text").textContent = key.text;
  $("q-src").innerHTML = srcPill(key.source);
  $("q-chips").innerHTML =
    `<span class="chip">${ICON.leaf}<span><b>Goes after</b> ${esc(e.targets)}</span></span>`;
  $("r-labels").innerHTML = e.labelPoints.map(factHtml).join("");
  $("r-research").innerHTML = e.research.map(factHtml).join("");
  const c = res.common; $("r-common").innerHTML = [c.context, c.water, c.jarTest].map(factHtml).join("");
  $("n-labels").textContent = e.labelPoints.length; $("n-research").textContent = e.research.length;
  $("r-disclaimer").textContent = res.disclaimer;
  $("r-dew").innerHTML = mascot("happy");
  $("ph").value = ""; $("phmsg").innerHTML = ""; $("wxmsg").innerHTML = ""; $("wxbtn").lastChild.textContent = " Use my location";
  selectTab("labels");
  $("mix-go").onclick = openMixScan;
  if (navigate) show("result");
  $("r-ring").style.strokeDashoffset = 264;
  setTimeout(() => $("r-ring").style.strokeDashoffset = 264 - 264 * res.prediction.probability, 80);
  observeReveal();
}

const srcPill = s => `<a class="src-pill" href="${esc(s.url)}" target="_blank" rel="noopener">${ICON.arrow.replace("<svg", '<svg width="13" height="13"')}${esc(s.name)}</a>`;

/* ---------- tabs ---------- */
function selectTab(name) {
  document.querySelectorAll(".tab").forEach(t => t.setAttribute("aria-selected", String(t.dataset.tab === name)));
  ["labels", "research", "field", "why"].forEach(n => $("p-" + n).classList.toggle("hidden", n !== name));
  observeReveal();
}
$("tabs").addEventListener("click", ev => {
  const t = ev.target.closest(".tab"); if (!t) return;
  selectTab(t.dataset.tab);
  if (window.innerWidth < 1024) {
    t.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    const top = $("tabs").getBoundingClientRect().top + scrollY - 6;
    if (scrollY > top) window.scrollTo({ top, behavior: "smooth" });
  }
});

/* ---------- sheets (learn more) ---------- */
async function openGuess() {
  const r = state.result, info = await api.modelInfo().catch(() => null);
  const m = info?.measured;
  const rank = r.prediction.ranking.map(x => `<li><b>${esc(({bt:"Bt",trichoderma:"Trichoderma",pseudomonas:"Pseudomonas",beauveria:"Beauveria"})[x.class] || x.class)}</b> ${Math.round(x.probability * 100)}%</li>`).join("");
  $("guess-body").innerHTML = `
    <div class="sdew">${mascot("think")}</div>
    <h3 class="serif">How sure is Dew?</h3>
    <p>Dew compared your label text with what it learned from <b>${m ? m.n_documents : 26} real public product labels</b>, and its best guess is <b>${esc(r.evidence.name)}</b> at <b>${Math.round(r.prediction.probability * 100)}%</b>. Below <b>${Math.round(r.prediction.threshold * 100)}%</b> Dew stops and tells you instead of guessing.</p>
    ${m ? `<div class="stats"><div class="stat"><b>${(m.loo_accuracy * 100).toFixed(1)}%</b><span>right when each label is hidden once (leave-one-out)</span></div><div class="stat"><b>${(m.holdout_accuracy * 100).toFixed(1)}%</b><span>right on one unseen hold-out set of 7</span></div></div>` : ""}
    <p><b>Please read this as "early prototype", not "accurate".</b> It is a small model that learned four product types. It does not predict whether a spray survives, and it has not seen every brand in a shop. The sources on the result page carry the weight, not this number.</p>
    <details class="more"><summary>All four guesses, side by side</summary><div><ul style="margin-left:18px;color:var(--cream-dim);font-size:14.5px">${rank}</ul></div></details>
    <details class="more"><summary>How the model works</summary><div><p>Words and word pairs from the label are weighted (TF-IDF) and scored by a logistic regression. The same math runs in the backend (Python) and in the browser (JavaScript). The code, the data and the measured results are in the project folder (<b>docs/data-and-ml.md</b>).</p></div></details>
    <button class="btn ghost" style="margin-top:12px;width:100%" data-close>Got it</button>`;
  $("sheet-guess").showModal();
}
async function openAbout() {
  $("about-body").innerHTML = `
    <div class="sdew">${mascot("hello")}</div>
    <h3 class="serif">About bioOasis</h3>
    <p>An early prototype from a college AI project (team ViabilAg). It helps check a <b>biological spray</b> (a product made of living organisms) before it goes in the tank.</p>
    <p>It shows <b>published evidence with its source</b> next to every line. It does not tell anyone what to spray, and it never shows a survival number, because we do not have lab data for that yet.</p>
    <details class="more"><summary>What is real, what is not</summary><div><p><b>Real:</b> label reading (OCR), a small ML model trained on 26 real public labels, evidence from cited sources, water pH and weather checks.<br><b>Not built:</b> survival prediction, a product database, user accounts.</p></div></details>
    <details class="more"><summary>Where the data comes from</summary><div><p>Real labels from EPA, CDMS and manufacturers (DiPel, XenTari, Javelin, Thuricide, RootShield, Trianum-P, T34, PlantShield, Asperello, Howler, BlightBan A506, Cedomon, BotaniGard, Mycotrol, Naturalis). The full list with links is in <b>data/sources.csv</b> in the project.</p></div></details>
    <button class="btn ghost" style="margin-top:12px;width:100%" data-close>Close</button>`;
  $("sheet-about").showModal();
}
$("open-guess").onclick = openGuess;
$("open-about").onclick = openAbout;

/* ---------- settings: look and feel ---------- */
const SWATCH = { lilac: ["#EFE9FF", "#6C4DF6", "#FF7A59"], pop: ["#FFF1B8", "#FF5A36", "#8C6BFF"], aurora: ["#0C0824", "#C6FF3D", "#FF5FD2"] };
function openSettings() {
  const cur = window.bioTheme.get();
  $("settings-body").innerHTML = `
    <div class="sdew">${mascot("happy")}</div>
    <h3 class="serif">Settings</h3>
    <p>Pick a look. Same content in all of them.</p>
    <div class="themes" role="radiogroup" aria-label="Theme">${Object.entries(window.bioTheme.list).map(([id, t]) => `
      <button class="theme-opt" role="radio" aria-checked="${id === cur}" data-theme-id="${id}">
        <span class="sw">${SWATCH[id].map(c => `<i style="background:${c}"></i>`).join("")}</span>
        <span class="tx"><b>${t.name}</b><small>${t.note}</small></span>
        <span class="tick" aria-hidden="true"></span>
      </button>`).join("")}</div>
    <div class="sound-row">
      <span class="tx"><b>Sounds</b><small>Soft taps and step chimes. Off means fully silent.</small></span>
      <button class="chip-btn" id="sound-toggle" role="switch" aria-checked="${snd.isEnabled()}">${snd.isEnabled() ? "On" : "Off"}</button>
    </div>
    <p class="fine">Your choices are saved on this device only. Nothing is sent anywhere.</p>
    <button class="btn ghost" style="margin-top:12px;width:100%" data-close>Done</button>`;
  $("sound-toggle").onclick = () => {
    const on = !snd.isEnabled(); snd.setEnabled(on);
    $("sound-toggle").textContent = on ? "On" : "Off";
    $("sound-toggle").setAttribute("aria-checked", String(on));
    if (on) snd.tap();
  };
  $("sheet-settings").showModal();
}
$("open-settings").onclick = openSettings;
$("settings-body").addEventListener("click", e => {
  const b = e.target.closest("[data-theme-id]"); if (!b) return;
  window.bioTheme.set(b.dataset.themeId);
  $("settings-body").querySelectorAll("[data-theme-id]").forEach(x => x.setAttribute("aria-checked", String(x === b)));
});
document.addEventListener("click", ev => {
  if (ev.target.closest("[data-close]")) ev.target.closest("dialog").close();
  else if (ev.target.tagName === "DIALOG") ev.target.close();   // tap outside the sheet
});

/* ---------- stop ---------- */
function renderStop(res) {
  $("stop-dew").innerHTML = mascot("unsure") + CLOUD;
  $("stop-tips").innerHTML = [
    ["light", "Retake the photo in good light, close and sharp, so every word is readable."],
    ["pen", "Fix any words Dew misread. Tap 'Edit the text' to change them."],
    ["person", "Still not sure? Ask an agronomist before you mix or spray."],
  ].map(([i, t]) => `<div class="tip">${ICON[i]}<span>${t}</span></div>`).join("");
  show("stop");
}

/* ---------- conditions ---------- */
const condHtml = (a) => `<span class="lv ${a.level || ""}">${a.level === "good" ? "Looks fine." : a.level === "warn" ? "Heads up." : ""}</span>${esc(a.text)}<br><a class="src-pill" href="${esc(a.source.url)}" target="_blank" rel="noopener">${esc(a.source.name)}</a>`;
let phTimer;
$("ph").addEventListener("input", () => {
  clearTimeout(phTimer);
  phTimer = setTimeout(async () => {
    const v = parseFloat($("ph").value);
    if (isNaN(v) || v < 0 || v > 14) { $("phmsg").innerHTML = isNaN(v) ? "" : '<div class="empty">pH goes from 0 to 14. Check the number on your strip or meter.</div>'; return; }
    const r = await api.conditions(state.cls, { ph: v });
    $("phmsg").innerHTML = r.ph ? condHtml(r.ph) : "";
  }, 250);
});
$("wxbtn").onclick = () => {
  const el = $("wxmsg"); el.innerHTML = "Getting your location...";
  if (!navigator.geolocation) { el.innerHTML = '<div class="empty">This browser cannot share a location, so no weather check.</div>'; return; }
  navigator.geolocation.getCurrentPosition(async pos => {
    const r = await api.conditions(state.cls, { lat: pos.coords.latitude, lon: pos.coords.longitude });
    const w = r.weather;
    if (!w || w.error) { el.innerHTML = `<div class="empty">${esc(w?.error || "Weather lookup failed.")}</div>`; return; }
    const uv = w.uv_index != null ? `, UV index ${Number(w.uv_index)}` : "";
    el.innerHTML = `Right now: ${Number(w.temperature_c)}°C, humidity ${Number(w.humidity_pct)}%${uv}.<br>` +
      (w.flag ? `<span class="lv warn">Heads up.</span>${esc(w.flag.text)}<br><a class="src-pill" href="${esc(w.flag.source.url)}" target="_blank" rel="noopener">${esc(w.flag.source.name)}</a>` : esc(w.no_flag_text)) +
      `<br><a class="src-pill" href="${esc(w.source.url)}" target="_blank" rel="noopener">${esc(w.source.name)}</a>`;
  }, () => { el.innerHTML = '<div class="empty">No location shared, so no weather check. That is fine, everything else still works.</div>'; });
};

/* ================= mix check ================= */
function openMixScan() {
  const a = state.result?.evidence;
  state.mix = { textA: $("ocrtext").value.trim(), textB: "", res: null, names: null };
  $("mix-a-reminder").innerHTML = a
    ? `You already scanned <b>${esc(a.name)}</b>. Now add the label of the product you want to use with it.`
    : "Add the label of the second product.";
  $("mixtext").value = ""; $("hint-b").textContent = ""; $("hint-b").className = "hint";
  $("scanbox-b").classList.add("hidden"); $("reading-b").classList.add("hidden");
  $("reading-dew-b").innerHTML = mascot("think");
  $("mix-samples").innerHTML = state.samples.map(sm =>
    `<button class="chip-btn" data-sid="${sm.id}">${esc(sm.label.replace(/\s*\(.*\)/, ""))}</button>`).join("");
  $("mix-samples").onclick = e => {
    const b = e.target.closest("[data-sid]"); if (!b) return;
    const sm = state.samples.find(x => x.id == b.dataset.sid);
    $("mixtext").value = sm.text; snd.tap();
    $("hint-b").className = "hint"; $("hint-b").textContent = `Loaded the ${sm.label.replace(/\s*\(.*\)/, "")} excerpt. You can edit it.`;
  };
  snd.step();
  show("mixscan");
}

async function readPhotoB(f) {
  show("mixscan");
  $("scanbox-b").classList.remove("hidden");
  $("preview-b").src = setPreview(f);
  $("scanline-b").classList.remove("hidden");
  $("reading-b").classList.remove("hidden");
  $("ocrbar-b").style.width = "0%";
  try {
    const text = await readLabel(f,
      pr => { $("ocrbar-b").style.width = Math.round(pr * 100) + "%"; $("ocrnote-b").textContent = `Dew is reading the label... ${Math.round(pr * 100)}%`; },
      msg => { $("ocrnote-b").textContent = "Dew: " + msg; });
    $("scanline-b").classList.add("hidden"); $("reading-b").classList.add("hidden");
    if (text) {
      $("mixtext").value = text.replace(/[ \t]*\n(?!\n)/g, " ");
      $("hint-b").className = "hint"; $("hint-b").textContent = "Check the words below. Fix anything the camera got wrong.";
      snd.scan();
    } else {
      $("hint-b").className = "hint nudge";
      $("hint-b").textContent = "Dew could not find any words in that photo. Try a sharper, closer shot in good light, or type the label text yourself.";
    }
  } catch {
    $("scanline-b").classList.add("hidden"); $("reading-b").classList.add("hidden");
    $("hint-b").className = "hint nudge";
    $("hint-b").textContent = "Dew could not read the photo here. You can type or paste the label text instead.";
  }
}

$("back-mixscan").onclick = () => { snd.tap(); show("result"); };
$("back-mixconfirm").onclick = () => { snd.tap(); show("mixscan"); };
$("back-mixresult").onclick = () => { snd.tap(); show("mixconfirm"); };

$("mix-read").onclick = async () => {
  const textB = $("mixtext").value.trim();
  if (textB.length < 30) {
    $("hint-b").className = "hint nudge";
    $("hint-b").textContent = `Dew needs a little more text to work with (${textB.length}/30 characters so far).`;
    $("mixtext").focus(); return;
  }
  $("mix-read").disabled = true; $("mix-read").textContent = "Thinking...";
  try {
    const res = await api.mixcheck({ textA: state.mix.textA, textB });
    state.mix.textB = textB; state.mix.res = res;
    state.mix.names = {
      a: res.product_a.product?.name || $("r-name").textContent || "Product 1",
      b: res.product_b.product?.name || "",
    };
    renderConfirm(res);
    snd.step();
    show("mixconfirm");
  } catch {
    $("hint-b").className = "hint nudge";
    $("hint-b").textContent = "Something went wrong talking to the app. Try again.";
  } finally { $("mix-read").disabled = false; $("mix-read").textContent = "Read this product"; }
};

function fieldLine(label, value, extra = "") {
  return `<div class="fline"><span class="fl">${label}</span><span class="fv${value ? "" : " none"}">${value ? esc(value) : "Not on the label"}</span>${extra}</div>`;
}

function productTag(tag, side, data, name) {
  const p = data.product;
  const kind = p ? `${esc(p.kind)} · ${esc(p.organism)}`
    : data.actives.length ? `Mentions ${data.actives.map(a => esc(a.name)).join(", ")}`
    : data.categories.length ? `Looks like a ${data.categories.map(esc).join("/")} label`
    : "Dew could not recognise this product";
  const exp = data.expiry;
  const expExtra = exp?.expired === true ? `<span class="exp-flag">date has passed</span>` : "";
  return `
  <div class="ptag ${tag}" id="ptag-${side}">
    <div class="hole"></div>
    <label class="ptag-label">${side === "a" ? "First product" : "Second product"}</label>
    <input class="ptag-name" id="name-${side}" value="${esc(name)}" placeholder="Type the product name" aria-label="${side === "a" ? "First product name" : "Second product name"}">
    <div class="ptag-kind">${kind}</div>
    ${fieldLine("Formulation", data.formulation)}
    ${fieldLine("Expiry", exp ? exp.raw : null, expExtra)}
  </div>`;
}

function renderConfirm(res) {
  $("confirm-cards").innerHTML = `
    <div class="ptags">
      ${productTag("a", "a", res.product_a, state.mix.names.a)}
      <div class="plink" aria-hidden="true"><span class="dots"></span><span class="q">?</span><span class="dots"></span></div>
      ${productTag("b", "b", res.product_b, state.mix.names.b)}
    </div>
    <p class="fine" style="margin-top:12px">Matching uses the label text you scanned, not these names. The names only fill in the summary you can share.</p>
    ${(res.product_a.expiry?.expired || res.product_b.expiry?.expired) ? `<p class="fine" style="color:var(--amber)">A date on one label has passed. That is all this means - it does not prove a product is fake, or that its organisms are dead.</p>` : ""}`;
}

$("mix-check-now").onclick = () => {
  state.mix.names = { a: $("name-a").value.trim(), b: $("name-b").value.trim() };
  renderMixResult(state.mix.res, state.mix.names);
  show("mixresult");
};

const VERDICT = {
  conflict: { mood: "unsure", cls: "conflict", icon: "stop", title: "Hold on. A label warns against this mix.",
    cta: "Review both labels or ask an agronomist before you mix.", sound: () => snd.caution() },
  limited: { mood: "think", cls: "limited", icon: "warn", title: "There is some evidence, but not a clear answer.",
    cta: "Check with an agronomist or dealer before you mix.", sound: () => snd.hmm() },
  no_evidence: { mood: "unsure", cls: "unknown", icon: "warn", title: "Dew can't confirm this combination.",
    cta: "Take the question below to an agronomist or dealer.", sound: () => snd.hmm() },
};

function dealerCard(res, names) {
  const a = res.product_a, b = res.product_b;
  const descA = [names.a || "Product 1", a.product?.organism, a.formulation].filter(Boolean).join(" · ");
  const bBits = [b.product?.organism, b.actives.length ? "mentions " + b.actives.map(x => x.name).join(", ") : null, b.formulation].filter(Boolean);
  const descB = [(names.b || (b.product ? b.product.name : "a product Dew could not recognise")), ...bBits].filter(Boolean).join(" · ");
  const found = res.findings.length
    ? "bioOasis found this on a cited label: " + res.findings[0].headline + " Source: " + res.findings[0].source.url
    : "bioOasis found no product-specific compatibility evidence for this pair.";
  return `Mix question from bioOasis (college prototype)

Product 1: ${descA}
Product 2: ${descB}

What I want to know: can these exact two products be tank mixed or used together, and is there tested guidance for these exact products and formulations?

${found}

bioOasis is a prototype and may have misread a label. Please verify before use.`;
}

function renderMixResult(res, names) {
  const v = VERDICT[res.status];
  const reasonText = {
    product_a_unknown: "Dew could not recognise the first product, and compatibility findings are always product-specific, so there is nothing honest to match against.",
    product_b_unknown: "The second label did not name a product or ingredient Dew knows, so no evidence could be matched.",
    no_pair_evidence: "Dew read both products, but none of the cited labels or sources it holds cover this exact pair.",
  }[res.reason];
  const findings = [...res.findings].sort((x, y) => (x.verdict === "conflict" ? -1 : 0) - (y.verdict === "conflict" ? -1 : 0));
  const card = dealerCard(res, names);
  $("mix-action").innerHTML = `
    <div class="verdict ${v.cls}">
      <div class="verdict-dew">${mascot(v.mood)}</div>
      <div class="verdict-badge">${ICON[v.icon]}</div>
      <div class="eyebrow">${{ conflict: "A real warning", limited: "Thin evidence", no_evidence: "Not enough evidence" }[res.status]}</div>
      <h2 class="block-title">${v.title}</h2>
      <div class="pairline"><span>${esc(names.a || "Product 1")}</span><span class="plus">+</span><span>${esc(names.b || "Product 2")}</span></div>
      <div class="verdict-cta">${ICON.person}<b>${v.cta}</b></div>
    </div>

    ${findings.length ? `<div class="findings">
      ${findings.map(f => `
        <div class="finding ${f.verdict}">
          <div class="f-head">${ICON[f.verdict === "conflict" ? "stop" : "warn"]}<b>${esc(f.headline)}</b></div>
          <p>${esc(f.scope)}</p>
          <p class="fine">${esc(f.what_tested)}</p>
          <a class="src-pill" href="${esc(f.source.url)}" target="_blank" rel="noopener">${ICON.arrow.replace("<svg", '<svg width="13" height="13"')}${esc(f.source.name)}</a>
        </div>`).join("")}
    </div>` : `<p class="block-sub" style="margin:18px 0">${esc(reasonText || "")}</p>`}

    ${res.status === "limited" ? `<div class="truth-note">${ICON.flask} A jar test or a "physically compatible" claim only shows the liquids mix. It does not show the living organisms survive.</div>` : ""}

    <div class="slip">
      <div class="slip-top">Take this with you</div>
      <textarea id="dealer-card" spellcheck="false" aria-label="Summary to show an agronomist or dealer">${esc(card)}</textarea>
      <div class="cta-row">
        <button class="btn primary" id="copy-card"><span style="width:18px;display:contents">${ICON.copy}</span> Copy the summary</button>
        <button class="btn ghost" id="save-card"><span style="width:18px;display:contents">${ICON.save}</span> Save as file</button>
      </div>
      <p class="fine">Copies to your clipboard or downloads a small text file on this device. Nothing is sent anywhere.</p>
    </div>

    <p class="conf-note">${esc(res.disclaimer)}</p>
    <div class="cta-row" style="margin-top:16px">
      <button class="btn ghost" id="mix-again">Start over</button>
    </div>`;
  $("copy-card").onclick = async () => {
    const t = $("dealer-card").value;
    try { await navigator.clipboard.writeText(t); $("copy-card").innerHTML = "Copied"; }
    catch {
      $("dealer-card").select(); document.execCommand("copy");
      $("copy-card").innerHTML = "Copied";
    }
    snd.copied();
  };
  $("save-card").onclick = () => {
    const blob = new Blob([$("dealer-card").value], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "biooasis-mix-question.txt";
    a.click(); URL.revokeObjectURL(a.href);
    snd.copied();
  };
  $("mix-again").onclick = () => { $("file").value = ""; state.mix = null; snd.tap(); show("home"); };
  v.sound();
  observeReveal();
}

/* ---------- dew chat ---------- */
dew.init({
  getContext: () => ({
    cls: state.cls,
    name: state.correction || state.result?.evidence?.name || null,
    mixExpiry: state.mix?.res ? [state.mix.res.product_a.expiry, state.mix.res.product_b.expiry].find(e => e?.expired)?.raw || null : null,
    facts: state.result?.evidence ? [...state.result.evidence.labelPoints, ...state.result.evidence.research].slice(0, 6).map(f => f.text) : [],
    mix: state.mix?.res ? `${state.mix.names?.a || "Product A"} + ${state.mix.names?.b || "Product B"}: ${state.mix.res.status}` : null,
  }),
  openScan: () => { state.fileTarget = "a"; show("read"); },
  openMix: () => {
    if (state.result) openMixScan();
    else { state.fileTarget = "a"; show("read"); }
  },
  openResult: () => { if (state.result) show("result"); },
  showDew: () => show("dew"),
  exitDew: () => { snd.tap(); show("home"); },
  pickLabel: () => { state.fileTarget = "chat"; $("file").click(); },
  onAnalyzed: (text, res) => { state.mix = null; state.result = res; state.cls = res.prediction.class; $("ocrtext").value = text; renderResult(res, false); },
  onCorrection: (name) => { state.correction = name; if (state.mix?.names) state.mix.names.a = name; },
});
$("dew-hero").innerHTML = mascot("hello", "big");
for (const [id, k] of [["dew-attach", "camera"], ["dew-mic", "mic"], ["dew-send", "arrow"]]) $(id).innerHTML = ICON[k];
