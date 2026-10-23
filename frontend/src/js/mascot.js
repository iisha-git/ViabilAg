// Dew, the bioOasis mascot: an original SVG drawing (made for this project, no third-party art).
// Moods: "hello" (default), "think", "happy", "unsure".
const MOUTH = {
  hello: '<path d="M88 160 Q100 172 112 160" fill="none" stroke="#12302a" stroke-width="4" stroke-linecap="round"/>',
  happy: '<path d="M84 156 Q100 182 116 156 Z" fill="#12302a"/><path d="M92 164 Q100 172 108 164" fill="#f0a595"/>',
  think: '<ellipse cx="100" cy="164" rx="6" ry="7" fill="#12302a"/>',
  unsure: '<path d="M86 164 q7 -8 14 0 t14 0" fill="none" stroke="#12302a" stroke-width="4" stroke-linecap="round"/>',
};

export function mascot(mood = "hello", cls = "") {
  const extras = {
    think: `<g class="glass"><circle cx="152" cy="108" r="17" fill="rgba(243,236,220,.12)" stroke="#f3ecdc" stroke-width="5"/><path d="M164 121 L182 139" stroke="#f3ecdc" stroke-width="6" stroke-linecap="round"/></g>`,
    happy: `<path class="spark" d="M42 70 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4z"/><path class="spark s2" d="M162 54 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z"/><path class="spark s3" d="M168 150 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z"/>`,
    unsure: `<text x="156" y="104" font-family="Fraunces,Georgia,serif" font-size="46" font-style="italic" fill="#e6a94a">?</text><path class="sweat" d="M58 96 q-7 12 0 17 q7 -5 0 -17z" fill="#9fe4d6"/>`,
  }[mood] || "";
  return `<svg class="dew ${mood === "unsure" ? "unsure" : ""} ${cls}" viewBox="0 0 200 230" role="img" aria-label="Dew, the bioOasis water-drop mascot">
  <ellipse class="ripple" cx="100" cy="212" rx="60" ry="10"/><ellipse class="ripple r2" cx="100" cy="212" rx="60" ry="10"/><ellipse class="ripple r3" cx="100" cy="212" rx="60" ry="10"/>
  <ellipse cx="100" cy="212" rx="44" ry="7" fill="rgba(0,0,0,.35)"/>
  <g class="bobber">
    <g class="sprout"><path d="M100 36 Q99 18 100 8" stroke="#2a8d7c" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M100 14 Q78 0 66 12 Q80 24 100 14Z" fill="#59d1a3"/><path d="M100 12 Q122 -4 136 6 Q122 22 100 12Z" fill="#3fc3aa"/></g>
    <path d="M100 30 C100 30 36 104 36 152 a64 64 0 0 0 128 0 C164 104 100 30 100 30Z" fill="url(#dewGrad)"/>
    <path d="M62 128 Q60 100 82 76" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="7" stroke-linecap="round"/>
    <circle cx="68" cy="146" r="4" fill="rgba(255,255,255,.5)"/>
    <g class="eye"><ellipse cx="78" cy="140" rx="9" ry="11" fill="#12302a"/><circle cx="75" cy="136" r="3.4" fill="#fff"/></g>
    <g class="eye b"><ellipse cx="122" cy="140" rx="9" ry="11" fill="#12302a"/><circle cx="119" cy="136" r="3.4" fill="#fff"/></g>
    <circle cx="62" cy="158" r="8" fill="#f0a595" opacity=".6"/><circle cx="138" cy="158" r="8" fill="#f0a595" opacity=".6"/>
    ${MOUTH[mood] || MOUTH.hello}
    ${extras}
  </g></svg>`;
}

// Shared gradient (inserted once into the page).
export const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<linearGradient id="dewGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6fe0c8"/><stop offset="1" stop-color="#23806f"/></linearGradient></defs></svg>`;

export const CLOUD = `<svg class="cloud" viewBox="0 0 120 70" aria-hidden="true"><path d="M30 60 a20 20 0 0 1 2 -40 a26 26 0 0 1 50 -4 a22 22 0 0 1 10 44z" fill="#2f4760"/><path d="M40 60 v0" stroke="#9fe4d6" stroke-width="3" stroke-linecap="round" opacity=".6"/></svg>`;
