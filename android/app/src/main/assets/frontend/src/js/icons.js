// Small original line icons (24px grid, stroke only).
const s = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICON = {
  camera: s('<path d="M4 8h3l1.6-2h6.8L17 8h3v11H4z"/><circle cx="12" cy="13.5" r="3.6"/>'),
  text: s('<path d="M5 6h14M5 11h14M5 16h8"/>'),
  leaf: s('<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z"/><path d="M5 19c3-4 6-7 9-9"/>'),
  flask: s('<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3"/><path d="M7.5 15h9"/>'),
  drop: s('<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>'),
  sun: s('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19"/>'),
  book: s('<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h10"/>'),
  light: s('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>'),
  pen: s('<path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 3 3L8 19z"/>'),
  person: s('<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-4 3.6-6 7-6s6.2 2 7 6"/>'),
  arrow: s('<path d="M7 17L17 7M9 7h8v8"/>'),
  back: s('<path d="M15 5l-7 7 7 7"/>'),
  warn: s('<path d="M12 3L22 20H2z"/><path d="M12 10v4M12 17.2v.3"/>'),
  stop: s('<path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z"/><path d="M9 9l6 6M15 9l-6 6"/>'),
  copy: s('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>'),
  save: s('<path d="M12 3v11M7 10l5 5 5-5"/><path d="M4 20h16"/>'),
  swap: s('<path d="M4 8h13M14 4l4 4-4 4"/><path d="M20 16H7M10 12l-4 4 4 4"/>'),
  mic: s('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/>'),
  sound: s('<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>'),
  mute: s('<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
};
