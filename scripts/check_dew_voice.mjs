// Run: node scripts/check_dew_voice.mjs
// Regression for the reported voice bug: tapping the mic must ALWAYS stop
// Dew talking first (even while busy fetching an answer), and Dew must never
// start speaking while a mic session is still listening.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { guideIntent, pestIntent, btIntent, sprayHowIntent, nonBtProductIntent } from '../frontend/src/js/dewroute.js';

let src = readFileSync(new URL('../frontend/src/js/dew.js', import.meta.url), 'utf8')
  .replace(/^import .*;$/mg, '').replace(/^export /mg, '')
  .replace(/function renderLog\(\) \{[\s\S]*?\n\}/, 'function renderLog() {}')
  .replace(/function renderLangs\(\) \{[\s\S]*?\n\}/, 'function renderLangs() {}')
  .replace(/function thinkingBubble\(\) \{[\s\S]*?\n\}/, 'function thinkingBubble() { return () => {}; }')
  .replace(/function listeningBubble\(\) \{[\s\S]*?\n\}/, 'function listeningBubble() { return () => {}; }')
  .replace(/function say\(msg, chips = null, tag = null, quiet = false\) \{[\s\S]*?\n\}/,
    'function say(msg, chips, tag, quiet) { recorded.push({ text: txt(msg), quiet: !!quiet }); }')
  .replace(/function note\(msg\) \{[\s\S]*?\n\}/, 'function note(msg) {}')
  .replace(/function userSay\(text, img\) \{[\s\S]*?\n\}/, 'function userSay(text) { recorded.push({ user: text }); }')
  .replace(/let ctx = .*;/, 'let ctx = { getContext: () => ({}), openScan: () => {}, openMix: () => {} };');

const recorded = [];
const nativePosts = [];
const synth = { cancelCount: 0, speakCount: 0,
  cancel() { this.cancelCount++; }, speak() { this.speakCount++; } };
let lastSR = null;
function MockSR() { lastSR = this; this.started = false; this.start = () => { this.started = true; }; this.stop = () => {}; }
const api = { getMode: () => 'api', dewChat: async () => ({ reply: 'ok' }) };
const sandbox = {
  guideIntent, pestIntent, btIntent, sprayHowIntent, nonBtProductIntent, api, recorded,
  SpeechRecognition: MockSR, speechSynthesis: synth,
  SpeechSynthesisUtterance: function (t) { this.text = t; },
  // window mirrors the same objects, like a real browser global
  window: { SpeechRecognition: MockSR, speechSynthesis: synth },
  snd: { isEnabled: () => false, tap: () => {}, step: () => {} },
  mascot: () => '', ICON: {}, parseWire: (d) => ({ kind: d.split('\t')[0], val: d.split('\t').slice(1).join('\t') }),
  classify: (k) => k === 'result' ? 'result' : k,
  readLabel: async () => '',
  localStorage: { getItem: () => 'en', setItem: () => {} },
  document: { getElementById: () => ({ innerHTML: '', placeholder: '' }), createElement: () => ({}) },
};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

// 1) Browser path, not busy: mic tap cancels TTS, then starts listening.
//    (code reads both the window.* property and the bare browser global)
vm.runInContext('busy = false; listening = false; voiceTurn = true;', sandbox);
synth.cancelCount = 0;
vm.runInContext('mic()', sandbox);
assert.equal(synth.cancelCount, 1, 'mic tap cancels browser TTS');
assert.ok(lastSR && lastSR.started, 'recognizer started after cancel');

// 2) While listening, speak() must stay silent (never talk over the user).
synth.speakCount = 0;
vm.runInContext('speak("some answer")', sandbox);
assert.equal(synth.speakCount, 0, 'no speech while mic session is active');
// Recognition ends (user finished): speech is allowed again.
lastSR.onend();
vm.runInContext('speak("some answer")', sandbox);
assert.equal(synth.speakCount, 1, 'speech resumes after listening ends');

// 3) Busy (answer in flight) + mic tap: still stops TTS, does not crash or
//    start a second recognizer.
vm.runInContext('busy = true; listening = false;', sandbox);
synth.cancelCount = 0; lastSR = null;
vm.runInContext('mic()', sandbox);
assert.equal(synth.cancelCount, 1, 'busy mic tap still cancels TTS');
assert.equal(lastSR, null, 'busy mic tap does not start recognizer');

// 4) Repeated mis-hearing: first miss speaks once, repeats go quiet, a
//    successful hear resets the counter (natural conversation, no robot loop).
vm.runInContext('busy = false; listening = false; missCount = 0;', sandbox);
recorded.length = 0; synth.speakCount = 0;
vm.runInContext('misheard()', sandbox);
assert.equal(recorded.length, 1, 'first miss shows the line');
assert.equal(recorded[0].quiet, false, 'first miss may be spoken once');
vm.runInContext('misheard(); misheard();', sandbox);
assert.equal(recorded.length, 2, 'later misses do not stack identical bubbles');
assert.equal(recorded[1].quiet, true, 'later misses are not spoken aloud');
vm.runInContext('heard("test")', sandbox);
assert.equal(vm.runInContext('missCount', sandbox), 0, 'successful hear resets misses');
const lastUser = recorded; // heard pushes a user bubble via userSay -> not recorded here

// 5) Native bridge path: mic tap posts stopspeak before start.
sandbox.window.SpeechRecognition = undefined; sandbox.window.speechSynthesis = undefined;
sandbox.SpeechRecognition = undefined; sandbox.speechSynthesis = undefined;
sandbox.window.BioDewSpeech = { postMessage: (m) => nativePosts.push(m), onmessage: null };
vm.runInContext('busy = false; listening = false;', sandbox);
nativePosts.length = 0;
vm.runInContext('mic()', sandbox);
assert.deepEqual(nativePosts, ['stopspeak', 'start\ten-IN'], 'native: stopspeak then start');
// native result ends listening and speech is allowed again
vm.runInContext('window.BioDewSpeech.onmessage({ data: "result\\tmera sawal" })', sandbox);
assert.equal(vm.runInContext('listening', sandbox), false, 'native result ends listening');

console.log('dew voice interrupt checks pass');
