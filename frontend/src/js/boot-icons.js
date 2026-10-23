import { ICON } from "./icons.js";
const $ = (id) => document.getElementById(id);
$("ic4").innerHTML = ICON.sun; $("ic0").innerHTML = ICON.light; $("ic6").innerHTML = ICON.arrow;
document.querySelectorAll("[data-ic]").forEach(e => e.innerHTML = ICON[e.dataset.ic]);
