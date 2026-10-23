// Tiny soft sounds, generated with WebAudio (no audio files). Off means off:
// nothing plays until a real tap, and the toggle lives in Settings.
let ctx = null;
let enabled = localStorage.getItem("biooasis-sound") !== "off";

export const isEnabled = () => enabled;
export function setEnabled(v) {
  enabled = v;
  localStorage.setItem("biooasis-sound", v ? "on" : "off");
}

function tone(freq, t0, dur, vol = 0.05, type = "sine") {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

function play(notes) {
  if (!enabled) return;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    const t = ctx.currentTime + 0.01;
    notes.forEach(([f, dt, dur, vol]) => tone(f, t + dt, dur, vol));
  } catch { /* no audio: stay silent */ }
}

export const tap = () => play([[660, 0, 0.07, 0.035]]);
export const step = () => play([[523, 0, 0.09, 0.04], [659, 0.09, 0.11, 0.04]]);
export const scan = () => play([[784, 0, 0.06, 0.03], [1047, 0.07, 0.08, 0.03]]);
// Caution and unknown never get a cheerful cue: soft low notes only.
export const caution = () => play([[330, 0, 0.12, 0.045], [262, 0.13, 0.16, 0.045]]);
export const hmm = () => play([[294, 0, 0.14, 0.04]]);
export const copied = () => play([[880, 0, 0.06, 0.035]]);
