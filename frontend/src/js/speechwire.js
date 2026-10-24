// Wire format between the Android speech bridge (MainActivity.java) and Dew.
// The app sends plain strings through window.BioDewSpeech:
//   "result\t<transcript>"   speech was recognised
//   "partial\t<transcript>"  live partial transcript (voice-mode caption)
//   "speakdone"              the phone finished (or failed) speaking Dew's reply
//   "cancelled"              listening was stopped (e.g. app went to background)
//   "<error-code>"           anything else, as a bare code
// A second bridge, window.BioDewOcr, takes "ocr\t<base64 jpeg>" and answers
// "text\t<label text>" or "error\t<code>" (on-device ML Kit read).
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
