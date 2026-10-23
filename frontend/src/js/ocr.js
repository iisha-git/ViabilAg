// Reads text from a label photo. Order: browser OCR (tesseract.js, needs no server),
// then - ONLY IF THE USER SAYS YES - the backend's /api/ocr when it is available.
// Big phone photos are shrunk first: faster, and OCR does not need 12 megapixels.
import { serverOcr, getMode } from "./api.js";

const MAX_SIDE = 1800;
// Pinned exact version + SRI hash: a moving @5 tag (or a compromised CDN) must
// not be able to swap the code that reads photos. The worker and core files are
// loaded by tesseract.js from the same pinned version's folder.
const TESS_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
const TESS_INTEGRITY = "sha384-GJqSu7vueQ9qN0E9yLPb3Wtpd7OrgK8KmYzC8T1IysG1bcvxvIO4qtYR/D3A991F";
const OCR_TIMEOUT_MS = 90000;

let tessPromise;
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  tessPromise ||= new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = TESS_URL; s.integrity = TESS_INTEGRITY; s.crossOrigin = "anonymous";
    s.onload = () => res(window.Tesseract);
    s.onerror = () => { tessPromise = null; rej(new Error("tesseract.js failed to load")); };
    document.head.appendChild(s);
  });
  return tessPromise;
}

export async function shrink(file) {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    if (k === 1) return file;
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(b => r(b || file), "image/jpeg", 0.9));
  } catch { return file; }
}

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

// The app says photos are read on your device, so the server fallback must never
// fire silently: ask first, and a "no" simply means the photo stays put.
function askServerUpload() {
  return window.confirm(
    "Dew can't read this photo on your device. Send it to the bioOasis server to read it there instead? " +
    "The photo is used once, for this read only, and deleted right after - it is never stored or logged."
  );
}

export async function readLabel(file, onProgress, onStatus = () => {}) {
  const img = await shrink(file);
  try {
    onStatus("Loading the reader...");
    const T = await withTimeout(loadTesseract(), 20000);
    const r = await withTimeout(T.recognize(img, "eng", {
      logger: m => { if (m.status === "recognizing text") onProgress(m.progress); else onStatus(m.status + "..."); },
    }), OCR_TIMEOUT_MS);
    return r.data.text.trim();
  } catch {
    if (getMode() !== "api" || !askServerUpload()) throw new Error("ocr-unavailable");
    try { onStatus("Trying the server reader..."); return await serverOcr(img instanceof File ? img : new File([img], "label.jpg", { type: "image/jpeg" })); }
    catch { throw new Error("ocr-unavailable"); }
  }
}
