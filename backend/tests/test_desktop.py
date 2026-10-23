"""The desktop polish script must stay purely visual: no network, no storage, no inline scripts."""
from pathlib import Path

FE = Path(__file__).resolve().parents[2] / "frontend"


def test_desktop_fx_is_visual_only():
    js = (FE / "src/js/desktop-fx.js").read_text()
    for banned in ("fetch(", "XMLHttpRequest", "localStorage", "sessionStorage", "indexedDB", "navigator.geolocation", "sendBeacon", "eval("):
        assert banned not in js


def test_desktop_fx_is_cached_and_not_inline():
    assert "src/js/desktop-fx.js" in (FE / "sw.js").read_text()
    html = (FE / "index.html").read_text()
    assert 'src="src/js/desktop-fx.js"' in html
    assert "d-only" in html


def test_desktop_only_elements_hidden_by_default():
    css = (FE / "src/styles/desktop.css").read_text()
    assert css.lstrip().split("*/", 1)[1].lstrip().startswith(".d-only{display:none}")
