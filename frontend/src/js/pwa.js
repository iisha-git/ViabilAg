// Registers the service worker so the site can be installed ("Add to Home
// Screen") and opens faster next time. Needs https (or localhost); on plain
// http this quietly does nothing and the site works as before.
if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").catch(function () { /* offline-first is a bonus, never a blocker */ });
  });
}
