---
trigger: glob
globs: "frontend/**/*.js, frontend/**/*.css, frontend/index.html"
description: Frontend conventions (no framework, no build step)
---
- Plain ES modules. No framework, bundler or npm dependency without an ADR.
- Colours, fonts, radii come from `src/styles/tokens.css`. No hard-coded colours in components.
- Progressive disclosure: short answer first, details in tabs or sheets. Never remove information, move it one tap away.
- Respect `prefers-reduced-motion`. Keep tap targets at least 44px.
- Escape any text inserted with innerHTML (use `esc()` in main.js).
- If you change scoring logic in `src/js/model.js`, run `node scripts/check_parity.mjs`.
