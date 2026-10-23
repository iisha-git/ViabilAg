# Design system

Mobile first (design at 390 px), calm and friendly, never cluttered.

## Principles
1. **Progressive disclosure.** Short answer first. Details one tap away (tabs, "How sure is Dew?" sheet, "About" sheet). Nothing is removed, only tucked away.
2. **Every claim shows its source.** A small pill with the source name links to it.
3. **Cute but credible.** Dew the mascot reacts (hello, thinking, happy, unsure). Wording is plain and warm, evidence is exact.
4. **Honest states.** Stop, empty and error states are friendly and always say what to do next.

## Tokens (`frontend/src/styles/tokens.css`)
Forest `#0d1815` (background), cards `#14241f`, cream `#f3ecdc` (text), aqua `#3fc3aa` (primary), coral `#ff8f78` and amber `#e6a94a` (accents / warnings), blush `#f0a595` (cheeks).
Type: Fraunces (headings, serif), Inter (text).

## Mascot: Dew
Original SVG in `frontend/src/js/mascot.js`. Moods are drawn in code; animations (bob, blink, sprout sway, ripples, sparkles) are in `animations.css` and respect reduced-motion.

## Motion
Views rise in, facts reveal on scroll, the confidence ring fills, photos slowly zoom, buttons have a soft sheen. All disabled under `prefers-reduced-motion`.

## Images
Real photos from Wikimedia Commons (credits in `frontend/assets/images/credits.json`, shown in the app). They illustrate the organism or crop, not the product, and the app says so.


## Themes (v0.3.0)
Three themes live in `frontend/src/styles/themes/`: `lilac.css` (default), `pop.css`, `aurora.css`. Light themes share `light-structure.css`. All reuse the token names from `tokens.css` and re-map them (for light themes `--char` is the page colour and `--cream` is the text colour). `src/js/theme.js` (no inline code) loads the chosen theme's CSS and stores the choice in `localStorage`. To add a theme: add a CSS file, register it in `THEMES` in `theme.js` and a swatch in `main.js` (`SWATCH`).

## Screen sizes (v0.4.0)
- **Phone (under 760 px):** the single-column layout everything is designed around.
- **Tablet (760-1023 px):** same layout, column widens to 740 px.
- **Desktop (1024 px and up):** `src/styles/desktop.css` (loaded by `theme.js` after the theme CSS, so it wins on equal specificity). Column widens to 1180 px; `src/js/desktop-fx.js` adds visual-only polish (cursor glow, parallax, count-up, scroll bar), off below 1024 px and under reduced motion; desktop-only markup carries the class `d-only` and is hidden on phones; the result screen splits into summary (`.rsum`) and evidence (`.rdetail`) columns; the read screen puts photo and text side by side; the field checks go two-up; the home hero is two-column in the light themes and full-bleed in Aurora Night. Progressive disclosure (quick card, tabs, sheets) is unchanged - the desktop layout never shows more at once, it only rearranges.
