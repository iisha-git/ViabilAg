// Look and feel. Three themes, chosen in Settings and remembered in this browser only (localStorage).
// Nothing about the choice is sent anywhere. This is a classic script (no inline code) so the strict CSP still applies.
(function () {
  var KEY = "biooasis-theme", DEFAULT = "lilac", BASE = "src/styles/themes/";
  var THEMES = {
    lilac:  { name: "Lilac Cloud",  note: "Soft, calm and premium",     color: "#EFE9FF", css: ["light-structure.css", "lilac.css"] },
    pop:    { name: "Sticker Pop",  note: "Playful, bold and loud",     color: "#FFF1B8", css: ["light-structure.css", "pop.css"] },
    aurora: { name: "Aurora Night", note: "Dark, glowing and techy",    color: "#0C0824", css: ["aurora.css"] }
  };
  function stored() { try { var v = localStorage.getItem(KEY); return THEMES[v] ? v : DEFAULT; } catch (e) { return DEFAULT; } }
  function link(href) { var l = document.createElement("link"); l.rel = "stylesheet"; l.href = href; l.setAttribute("data-theme-css", ""); return l; }
  function apply(id) {
    if (!THEMES[id]) id = DEFAULT;
    var head = document.head;
    document.querySelectorAll("link[data-theme-css]").forEach(function (n) { n.remove(); });
    head.appendChild(link(BASE + "fonts.css"));
    THEMES[id].css.forEach(function (f) { head.appendChild(link(BASE + f)); });
    // Desktop / tablet layout comes last so it wins on equal specificity.
    head.appendChild(link("src/styles/desktop.css"));
    document.documentElement.setAttribute("data-theme", id);
    var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute("content", THEMES[id].color);
    return id;
  }
  window.bioTheme = {
    list: THEMES,
    get: stored,
    set: function (id) { if (!THEMES[id]) return; try { localStorage.setItem(KEY, id); } catch (e) {} apply(id); }
  };
  apply(stored());
})();
