// Desktop-only polish: cursor glow on cards, gentle parallax on the hero scrapbook, count-up numbers,
// scroll progress, a little burst of drops when a result lands. Pure visuals: no data, no network, no storage.
import { mascot } from "./mascot.js";
const wide = window.matchMedia("(min-width:1024px)");
const calm = window.matchMedia("(prefers-reduced-motion:reduce)");
const root = document.documentElement;

// cursor glow on any card that has a glow layer
document.addEventListener("pointermove", e => {
  if (!wide.matches) return;
  const c = e.target.closest && e.target.closest(".sample,.how-step,.fact,.d-stat,.quick");
  if (c) { const r = c.getBoundingClientRect(); c.style.setProperty("--mx", (e.clientX - r.left) + "px"); c.style.setProperty("--my", (e.clientY - r.top) + "px"); }
  if (!calm.matches) {
    root.style.setProperty("--px", ((e.clientX / innerWidth - .5) * 2).toFixed(3));
    root.style.setProperty("--py", ((e.clientY / innerHeight - .5) * 2).toFixed(3));
  }
}, { passive: true });

// scroll progress bar
const bar = document.querySelector(".d-progress i");
function onScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  root.style.setProperty("--sp", max > 0 ? (scrollY / max).toFixed(4) : 0);
}
addEventListener("scroll", onScroll, { passive: true }); onScroll();

// count up numbers when they scroll into view
function countUp(el) {
  const to = +el.dataset.count; if (!to || calm.matches) return;
  const t0 = performance.now(), dur = 1100;
  (function tick(t) {
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(to * e);
    if (k < 1) requestAnimationFrame(tick);
  })(t0);
}
const io = new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) { countUp(x.target); io.unobserve(x.target); } }), { threshold: .6 });
document.querySelectorAll("[data-count]").forEach(el => io.observe(el));

// a small burst of drops from the ring when a result appears
const result = document.getElementById("v-result");
if (result) new MutationObserver(() => {
  if (!wide.matches || calm.matches || result.classList.contains("hidden")) return;
  const ring = document.getElementById("r-ring")?.getBoundingClientRect(); if (!ring) return;
  const cols = ["var(--teal)", "var(--coral)", "var(--c2,#3de8ff)", "var(--hl,#C6FF3D)"];
  for (let i = 0; i < 16; i++) {
    const d = document.createElement("i"); d.className = "d-drop";
    d.style.left = (ring.left + ring.width / 2) + "px"; d.style.top = (ring.top + ring.height / 2) + "px";
    d.style.background = cols[i % cols.length];
    d.style.setProperty("--dx", (Math.random() * 360 - 180) + "px"); d.style.setProperty("--dy", (-80 - Math.random() * 220) + "px"); d.style.setProperty("--dr", (Math.random() * 180 - 90) + "deg");
    d.style.animationDelay = (i * 45) + "ms";
    document.body.appendChild(d); setTimeout(() => d.remove(), 2400);
  }
}).observe(result, { attributes: true, attributeFilter: ["class"] });

const rd = document.getElementById("rd-dew"); if (rd) rd.innerHTML = mascot("think");
