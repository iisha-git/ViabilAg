// Contract check: the Android bridge and Dew must agree on the wire format.
// Run: node scripts/check_speech_wire.mjs
import { readFileSync } from "node:fs";
import { parseWire, classify, NO_MIC_CODES, NO_MATCH_CODES } from "../frontend/src/js/speechwire.js";

const java = readFileSync(new URL("../android/app/src/main/java/com/viabilag/biooasis/MainActivity.java", import.meta.url), "utf8");
let bad = 0;
const fail = m => { console.error("FAIL: " + m); bad++; };

// 1. Parsing and classification behave as the page expects.
const cases = [
  ["result\tHello Dew", "result", "Hello Dew"],
  ["result\twith\ta tab", "result", "with\ta tab"],
  ["cancelled", "cancelled", ""],
  ["unsupported", "noMic", ""], ["unsupported-locale", "noMic", ""], ["no-mic-permission", "noMic", ""],
  ["no-match", "noMatch", ""], ["network", "noMatch", ""], ["error", "noMatch", ""],
];
for (const [wire, cls, val] of cases) {
  const p = parseWire(wire);
  if (classify(p.kind) !== cls || p.val !== val) fail(`wire ${JSON.stringify(wire)} -> ${JSON.stringify(p)} / ${classify(p.kind)}`);
}

// 2. The Java side encodes results as "result\t<text>" and errors as bare codes.
if (!/wire = "result\\t" \+ value;/.test(java)) fail('MainActivity must send results as "result\\t" + text');
if (!/"onError"\.equals\(kind\)\) wire = value;/.test(java)) fail("MainActivity must send errors as the bare code");
if (/postMessage\(kind \+/.test(java)) fail("MainActivity must not post the raw internal kind (onResult/onError)");

// 3. Every error code the Java side can emit is known to the page.
const known = new Set([...NO_MIC_CODES, ...NO_MATCH_CODES]);
const codes = new Set([
  ...[...java.matchAll(/jsSpeech\("onError",\s*"([^"]+)"\)/g)].map(m => m[1]),
  ...[...java.matchAll(/code = "([^"]+)"/g)].map(m => m[1]),
]);
for (const c of codes) if (!known.has(c)) fail(`Java emits unknown error code "${c}"`);
if (!/jsSpeech\("onResult"/.test(java)) fail("Java no longer reports results");
if (!/jsSpeech\("cancelled"/.test(java)) fail("Java no longer reports cancellation");

// 3b. Voice-mode additions: partials, speech completion, and the OCR bridge.
if (!/else if \("onPartial"\.equals\(kind\)\) wire = "partial\\t" \+ value;/.test(java)) fail('MainActivity must send partials as "partial\\t" + text');
if (!/jsSpeech\("speakdone", ""\)/.test(java)) fail('MainActivity must report utterance completion as "speakdone"');
if (!java.includes('addWebMessageListener(web, "BioDewOcr"')) fail('MainActivity lacks the BioDewOcr bridge');
if (!/postMessage\("text\\t"/.test(java)) fail('BioDewOcr must answer with "text\\t" + label text');
if (!/EXTRA_PARTIAL_RESULTS, true/.test(java)) fail('recognizer must request partial results');

// 4. Android 11+ package visibility for speech recognizers is declared.
const manifest = readFileSync(new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8");
if (!manifest.includes("android.speech.RecognitionService")) fail("manifest lacks the RecognitionService <queries> entry");
if (!manifest.includes("android.permission.RECORD_AUDIO")) fail("manifest lacks RECORD_AUDIO");

// 5. The website must allow its own microphone.
for (const f of ["vercel.json", "netlify.toml", "backend/app/security.py"]) {
  const t = readFileSync(new URL("../" + f, import.meta.url), "utf8");
  if (/microphone=\(\)/.test(t)) fail(`${f} blocks the microphone`);
  if (!/microphone=\(self\)/.test(t)) fail(`${f} does not allow microphone=(self)`);
}

if (bad) process.exit(1);
console.log(`speech wire contract ok (${cases.length} cases, ${codes.size} Java error codes)`);
