/* bioOasis service worker: makes the site installable, quick to open, and
   ALWAYS up to date without the user doing anything.
   Update strategy: network first for every own-file GET. When online you
   always see the newest deployed version - a plain reload is enough, no
   hard refresh or cache clearing. The cache is the offline fallback and is
   refreshed in the background on every successful load, so it converges on
   its own (no manual version bump needed when assets change).
   What it caches: ONLY this app's own static files (pages, css, js, fonts,
   images, bundled data).
   What it NEVER touches:
   - anything under /api/ (answers, photo uploads, weather) - always network;
   - non-GET requests (uploads, analyse, conditions POST with your location);
   - cross-origin requests (the OCR CDN, the weather API);
   - label photos: they are in-memory blob: URLs and never reach the network,
     so they are never seen here either.
   Cached files are public app code; nothing about you is stored. */
const VERSION = "biooasis-static-v16";
const ASSETS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "assets/config.js",
  "assets/fonts/fonts.css",
  "assets/fonts/bagel-fat-one-400.woff2",
  "assets/fonts/dm-sans-400.woff2",
  "assets/fonts/dm-sans-500.woff2",
  "assets/fonts/dm-sans-700.woff2",
  "assets/fonts/dm-serif-display-400.woff2",
  "assets/fonts/dm-serif-display-400-italic.woff2",
  "assets/fonts/fraunces-400.woff2",
  "assets/fonts/fraunces-400-italic.woff2",
  "assets/fonts/fraunces-500.woff2",
  "assets/fonts/fraunces-600.woff2",
  "assets/fonts/inter-400.woff2",
  "assets/fonts/inter-500.woff2",
  "assets/fonts/inter-600.woff2",
  "assets/fonts/plus-jakarta-sans-400.woff2",
  "assets/fonts/plus-jakarta-sans-600.woff2",
  "assets/fonts/plus-jakarta-sans-700.woff2",
  "assets/fonts/space-grotesk-500.woff2",
  "assets/fonts/space-grotesk-700.woff2",
  "assets/images/hero.jpg",
  "assets/images/farmer.jpg",
  "assets/images/bt.jpg",
  "assets/images/trichoderma.jpg",
  "assets/images/pseudomonas.jpg",
  "assets/images/beauveria.jpg",
  "assets/images/credits.json",
  "assets/data/evidence.json",
  "assets/data/rules.json",
  "assets/data/pairs.json",
  "assets/data/samples.json",
  "assets/data/model.json",
  "assets/data/metrics.json",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "src/styles/tokens.css",
  "src/styles/base.css",
  "src/styles/animations.css",
  "src/styles/components.css",
  "src/styles/desktop.css",
  "src/styles/themes/fonts.css",
  "src/styles/themes/light-structure.css",
  "src/styles/themes/lilac.css",
  "src/styles/themes/pop.css",
  "src/styles/themes/aurora.css",
  "src/js/theme.js",
  "src/js/main.js",
  "src/js/dew.js",
  "src/js/mixcheck.js",
  "src/js/sounds.js",
  "src/js/api.js",
  "src/js/model.js",
  "src/js/ocr.js",
  "src/js/mascot.js",
  "src/js/icons.js",
  "src/js/boot-icons.js",
  "src/js/pwa.js",
  "src/js/desktop-fx.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;          // uploads, analyses, conditions: straight to network
  if (url.origin !== self.location.origin) return;     // OCR CDN, weather API: straight to network
  if (url.pathname.startsWith("/api/")) return;        // answers, uploads, weather: never cached
  if (url.pathname === "/sw.js" || url.pathname.endsWith("/sw.js")) return;  // update checks must always see the newest worker

  // Every own-file GET: network first, cache is the offline fallback.
  // A plain reload always reaches the newest deploy; successful responses
  // are written through to the cache so offline keeps working and the
  // offline copy stays current by itself.
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(event.request, copy)); }
        return res;
      })
      .catch(() =>
        caches.match(event.request, { ignoreSearch: true })
          .then((r) => r || (event.request.mode === "navigate" ? caches.match("index.html") : undefined))
      )
  );
});
