// Wire format between the Android speech bridge (MainActivity.java) and Dew.
// The app sends plain strings through window.BioDewSpeech:
//   "result\t<transcript>"   speech was recognised
//   "cancelled"              listening was stopped (e.g. app went to background)
//   "<error-code>"           anything else, as a bare code
// Keep this file and MainActivity.jsSpeech() in step; scripts/check_speech_wire.mjs
// fails if they drift apart.
export const NO_MIC_CODES = ["unsupported", "unsupported-locale", "no-mic-permission"];
export const NO_MATCH_CODES = ["no-match", "network", "error"];

export function parseWire(data) {
  const d = String(data), i = d.indexOf("\t");
  return { kind: i < 0 ? d : d.slice(0, i), val: i < 0 ? "" : d.slice(i + 1) };
}

// -> "result" | "cancelled" | "noMic" | "noMatch"
export function classify(kind) {
  if (kind === "result") return "result";
  if (kind === "cancelled") return "cancelled";
  if (NO_MIC_CODES.includes(kind)) return "noMic";
  return "noMatch";
}
