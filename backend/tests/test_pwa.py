"""Installable-app (PWA) guarantees and their privacy boundaries.

Run with the rest of the suite: python -m pytest -q backend
"""
import json
import re
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FRONTEND = ROOT / "frontend"
MANIFEST = json.loads((FRONTEND / "manifest.webmanifest").read_text())
SW = (FRONTEND / "sw.js").read_text()
HTML = (FRONTEND / "index.html").read_text()


def _png_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", f"{path.name} is not a PNG"
    assert data[12:16] == b"IHDR"
    w, h = struct.unpack(">II", data[16:24])
    return w, h


# ---------- manifest ----------

def test_manifest_is_installable():
    assert MANIFEST["display"] == "standalone"
    assert MANIFEST["name"] and MANIFEST["short_name"]
    assert MANIFEST["start_url"] and MANIFEST["scope"]
    assert MANIFEST["theme_color"] and MANIFEST["background_color"]


def test_manifest_icons_exist_and_match_declared_sizes():
    icons = MANIFEST["icons"]
    assert any(i["sizes"] == "192x192" for i in icons)
    assert any(i["sizes"] == "512x512" for i in icons)
    assert any(i.get("purpose") == "maskable" for i in icons)
    for icon in icons:
        path = FRONTEND / icon["src"]
        assert path.exists(), f"missing icon {icon['src']}"
        w, h = _png_size(path)
        assert f"{w}x{h}" == icon["sizes"], f"{icon['src']}: file is {w}x{h}, manifest says {icon['sizes']}"


def test_page_links_manifest_and_registers_sw_externally():
    assert '<link rel="manifest" href="manifest.webmanifest">' in HTML
    assert '<script src="src/js/pwa.js"></script>' in HTML
    assert "serviceWorker" in (FRONTEND / "src/js/pwa.js").read_text()


# ---------- service worker privacy ----------

def test_sw_never_caches_api_or_uploads_or_location():
    assert 'url.pathname.startsWith("/api/")' in SW      # answers, uploads, weather: always network
    assert 'event.request.method !== "GET"' in SW        # POST /api/conditions carries coordinates; never cached
    assert "url.origin !== self.location.origin" in SW   # third parties (OCR CDN, weather) untouched


def test_sw_precache_list_is_static_only_and_every_file_exists():
    m = re.search(r"const ASSETS = \[(.*?)\];", SW, re.S)
    assert m, "ASSETS list not found in sw.js"
    assets = re.findall(r'"([^"]+)"', m.group(1))
    assert len(assets) > 20
    for a in assets:
        assert not a.startswith("/api"), f"API path in precache list: {a}"
        assert "://" not in a, f"cross-origin URL in precache list: {a}"
        if a == "./":
            continue
        assert (FRONTEND / a).exists(), f"precached file missing: {a}"


def test_sw_cache_is_versioned_and_old_caches_are_removed():
    assert re.search(r'const VERSION = "biooasis-static-v\d+"', SW)
    assert "caches.delete" in SW
