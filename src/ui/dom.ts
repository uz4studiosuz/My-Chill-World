export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (e instanceof HTMLButtonElement) e.type = 'button';
  return e;
}

const svg = (inner: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

const ICONS = {
  pan: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
  road1: '<path d="M8 2v20M16 2v20"/>',
  road2: '<path d="M4 2v20M20 2v20M12 3v4M12 10v4M12 17v4"/>',
  house: '<path d="M3 11l9-7 9 7M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  quarry: '<path d="M3 20l5-9 4 5 3-4 6 8z"/><path d="M14 3l5 5M19 3l-6 6"/>',
  bulldoze: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  undo: '<path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3"/>',
  rotL: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"/>',
  rotR: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2s1 1.6 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6.5V8M12 16v1.5"/>',
  stone: '<path d="M4 16l3-7 6-3 6 4 1 7-8 3z"/><path d="M7 9l5 3 7-2M12 12l0 8"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2c2.8.3 5 2.4 5 5.8"/>',
  jobs: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V4h6v3M3 13h18"/>',
  stats: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  roads: '<path d="M7 3L3 21M17 3l4 18M12 4v3M12 10v4M12 17v3"/>',
  buildings: '<path d="M3 21h18M5 21V8l6-4v17M11 9h8v12M14 12h2M14 16h2M7 11h2M7 15h2"/>',
  gallery: '<path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 22V12M21 7l-9 5-9-5"/>',
  roundabout: '<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  office: '<rect x="6" y="3" width="12" height="18"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
  parking: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 17V7h4a3 3 0 010 6H9"/>',
  cow: '<path d="M5 10h12v6H5zM17 9h3v4h-3M7 16v3M15 16v3M5 10L3 8"/>',
  road: '<path d="M4 2v20M20 2v20M12 3v4M12 10v4M12 17v3"/>',
  path: '<path d="M8 21c0-6 8-6 8-12 0-3-2-6-2-6"/><circle cx="7" cy="8" r="1"/><circle cx="17" cy="16" r="1"/>',
  school: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>',
  production: '<path d="M3 21V10l6 4V10l6 4V6l6-3v18z"/>',
  wood: '<rect x="3" y="8" width="18" height="8" rx="4"/><circle cx="7" cy="12" r="2"/>',
  food: '<path d="M12 7c-3-3-8-1-8 4 0 5 4 10 8 10s8-5 8-10c0-5-5-7-8-4z"/><path d="M12 7c0-2 1-4 3-5"/>',
  energy: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  woodcutter: '<path d="M14 4l6 6-3 3-6-6zM11 7L3 21"/>',
  powerplant: '<path d="M3 21V11l5 3v-3l5 3V4h4v17z"/><path d="M15 2v2"/>',
  farm: '<path d="M12 21V8M12 12c-3 0-5-2-5-5 3 0 5 2 5 5zM12 12c3 0 5-2 5-5-3 0-5 2-5 5zM12 17c-3 0-5-2-5-5 3 0 5 2 5 5zM12 17c3 0 5-2 5-5-3 0-5 2-5 5z"/>',
  orchard: '<circle cx="12" cy="9" r="6"/><path d="M12 15v6M10 8h.01M14 10h.01"/>',
  ranch: '<path d="M3 21V9h18v12M3 13h18M3 17h18M7 9v12M17 9v12"/>',
  heart: '<path d="M12 21s-8-5-8-11a4 4 0 018-1 4 4 0 018 1c0 6-8 11-8 11z"/>',
  car: '<path d="M5 16V11l2-5h10l2 5v5M3 16h18M7 19v-3M17 19v-3"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
};

export type IconName = keyof typeof ICONS;
export const icon = (name: IconName) => svg(ICONS[name]);
