// Run: node scripts/check_dew_fallback.mjs
// Regression: an AI CONNECTION failure must not show the "I don't have
// evidence" line (genuine uncertainty). It shows a clear connection message
// with a Retry chip; Retry asks the same question again. Static mode (no
// backend) keeps the honest no-evidence fallback.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { guideIntent, pestIntent, btIntent, sprayHowIntent, nonBtProductIntent } from '../frontend/src/js/dewroute.js';

let src = readFileSync(new URL('../frontend/src/js/dew.js', import.meta.url), 'utf8')
  .replace(/^import .*;$/mg, '').replace(/^export /mg, '')
  .replace(/function renderLog\(\) \{[\s\S]*?\n\}/, 'function renderLog() {}')
  .replace(/function renderLangs\(\) \{[\s\S]*?\n\}/, 'function renderLangs() {}')
  .replace(/function thinkingBubble\(\) \{[\s\S]*?\n\}/, 'function thinkingBubble() { return () => {}; }')
  .replace(/function say\(msg, chips = null, tag = null, quiet = false, spoken = null\) \{[\s\S]*?\n\}/,
    'function say(msg, chips = null, tag = null) { recorded.push({ kind: "say", text: txt(msg), chips: chips ? chips(lang) : null, tag }); }')
  .replace(/function note\(msg\) \{[\s\S]*?\n\}/,
    'function note(msg) { recorded.push({ kind: "note", text: txt(msg) }); }')
  .replace(/let ctx = .*;/, 'let ctx = { getContext: () => ({}), openScan: () => {}, openMix: () => {} };');

const recorded = [];
let mode = 'api';
let calls = 0;
let behavior = 'throw';
let throwStatus = 502;
const api = {
  getMode: () => mode,
  dewChat: async () => {
    calls++;
    if (behavior === 'throw') throw Object.assign(new Error('HTTP ' + throwStatus), { status: throwStatus });
    if (behavior === 'empty') return { reply: '  ' };
    return { reply: 'Namaste! Bt can help with caterpillars.', lang: 'en' };
  },
};
const sandbox = {window: {}, 
  guideIntent, pestIntent, btIntent, sprayHowIntent, nonBtProductIntent, api, recorded,
  snd: { isEnabled: () => false, tap: () => {}, step: () => {} },
  mascot: () => '', ICON: {}, parseWire: () => ({}), classify: () => '', readLabel: async () => '',
  localStorage: { getItem: () => 'en', setItem: () => {} },
  document: { getElementById: () => ({ innerHTML: '', placeholder: '' }), createElement: () => ({}) },
};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const Lref = vm.runInContext('L', sandbox);
const says = () => recorded.filter(r => r.kind === 'say');

for (const lg of ['en', 'hi', 'mr']) {
  recorded.length = 0; calls = 0; behavior = 'throw'; throwStatus = 502; mode = 'api';
  vm.runInContext(`lang = "${lg}"; aiNoticeShown = true; busy = false; lastQuestion = null;`, sandbox);
  await vm.runInContext('aiReply("hello dude")', sandbox);
  const s = says();
  assert.equal(s.length, 1, `${lg}: one reply bubble on failure`);
  assert.equal(s[0].text, Lref[lg].aiDownMsg, `${lg}: connection message, not no-evidence`);
  assert.ok(!s[0].text.includes(Lref.en.fallback.slice(0, 20)), `${lg}: no-evidence text absent`);
  assert.equal(s[0].chips[0], Lref[lg].retry, `${lg}: first chip is Retry`);
  assert.notEqual(s[0].tag, 'local', `${lg}: not tagged built-in guide`);

  // quota exhaustion (429): clear quota message, no Retry chip
  recorded.length = 0; calls = 0; behavior = 'throw'; throwStatus = 429;
  await vm.runInContext('aiReply("hello dude")', sandbox);
  const sq = says();
  assert.equal(sq[0].text, Lref[lg].quotaMsg, `${lg}: 429 shows quota message`);
  assert.ok(!sq[0].chips.includes(Lref[lg].retry), `${lg}: 429 offers no Retry chip`);
  throwStatus = 502;

  // empty AI reply is also a connection failure
  recorded.length = 0; calls = 0; behavior = 'empty';
  await vm.runInContext('aiReply("hello again")', sandbox);
  assert.equal(says()[0].text, Lref[lg].aiDownMsg, `${lg}: empty reply also connection message`);

  // Retry asks the same question again and shows the answer when it succeeds
  recorded.length = 0; calls = 0; behavior = 'ok';
  await vm.runInContext('reply(L[lang].retry)', sandbox); // typed Retry routes to retryAi
  await new Promise(r => setTimeout(r, 20));
  assert.equal(calls, 1, `${lg}: retry re-sent the last question`);
  const s2 = says();
  assert.equal(s2.at(-1).text, 'Namaste! Bt can help with caterpillars.', `${lg}: retried answer shown`);
  assert.equal(s2.at(-1).tag, 'ai', `${lg}: retried answer tagged Dew AI`);
  assert.ok(!recorded.some(r => r.text === Lref[lg].retry), `${lg}: Retry never printed as a message`);
}

// Static mode (no backend): genuine no-evidence fallback is kept
recorded.length = 0; calls = 0; mode = 'static';
vm.runInContext('lang = "en"; busy = false; aiOffNoted = true;', sandbox);
await vm.runInContext('aiReply("hello dude")', sandbox);
assert.equal(says()[0].text, Lref.en.fallback, 'static mode keeps honest fallback');
assert.equal(says()[0].tag, 'local', 'static fallback tagged built-in guide');
assert.equal(calls, 0, 'static mode never calls the API');

console.log('dew fallback checks passed');
