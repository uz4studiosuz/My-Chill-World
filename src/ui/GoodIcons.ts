import { t } from '../i18n/i18n';

/**
 * Goods drawn as small shaded pictures (not emoji stickers): a loaf of bread, stacked logs, a steel ingot… Every
 * picture is an SVG with its own gradients, a soft shadow and a highlight, so it reads like an item in a shop.
 */

/** Shared pieces: the soft shadow under every item. */
const SHADOW = '<ellipse cx="32" cy="55" rx="21" ry="4.5" fill="#000" opacity=".28"/>';

/** Each picture on a 64×64 board; `§` becomes a unique suffix so the gradients of two pictures never mix. */
const ART: Record<string, string> = {
  food: `<defs><radialGradient id="a§" cx=".4" cy=".25" r=".9"><stop offset="0" stop-color="#f7c983"/><stop offset=".55" stop-color="#d98a3d"/><stop offset="1" stop-color="#8f4e1d"/></radialGradient><linearGradient id="b§" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbe2b6"/><stop offset="1" stop-color="#e2b277"/></linearGradient></defs>${SHADOW}
    <path d="M8 44c0-15 10-26 24-26s24 11 24 26c0 4-3 6-7 6H15c-4 0-7-2-7-6z" fill="url(#a§)"/>
    <path d="M10 46c0 2 2 4 5 4h34c3 0 5-2 5-4" fill="none" stroke="#7a3f14" stroke-width="2" opacity=".5"/>
    <path d="M20 26c3 4 3 9 1 13M30 22c3 5 3 11 1 16M40 24c3 4 3 10 1 15" fill="none" stroke="url(#b§)" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M16 28c4-5 9-8 15-8" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".35"/>`,
  wood: `<defs><linearGradient id="a§" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a6436"/><stop offset="1" stop-color="#5a3518"/></linearGradient><radialGradient id="b§"><stop offset="0" stop-color="#f3d39b"/><stop offset=".6" stop-color="#d9a866"/><stop offset="1" stop-color="#a8733a"/></radialGradient></defs>${SHADOW}
    <rect x="14" y="36" width="40" height="15" rx="7.5" fill="url(#a§)"/><ellipse cx="14" cy="43.5" rx="6" ry="7.5" fill="url(#b§)"/><ellipse cx="14" cy="43.5" rx="3" ry="4" fill="none" stroke="#a8733a" stroke-width="1"/>
    <rect x="22" y="22" width="34" height="15" rx="7.5" fill="url(#a§)"/><ellipse cx="22" cy="29.5" rx="6" ry="7.5" fill="url(#b§)"/><ellipse cx="22" cy="29.5" rx="3" ry="4" fill="none" stroke="#a8733a" stroke-width="1"/>
    <rect x="8" y="22" width="12" height="15" rx="6" fill="url(#a§)" opacity="0"/>
    <path d="M30 26h20M24 40h22" stroke="#3e230e" stroke-width="1.4" opacity=".45" stroke-linecap="round"/>`,
  stone: `<defs><radialGradient id="a§" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#d6dade"/><stop offset=".6" stop-color="#9aa1a8"/><stop offset="1" stop-color="#5f666d"/></radialGradient><radialGradient id="b§" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#c3c8cd"/><stop offset="1" stop-color="#6b7279"/></radialGradient></defs>${SHADOW}
    <path d="M6 50l5-14 11-5 9 6 2 13z" fill="url(#b§)"/>
    <path d="M28 51l3-19 12-9 13 6 3 14-6 8z" fill="url(#a§)"/>
    <path d="M16 51l4-10 9-2 7 6-1 6z" fill="url(#a§)"/>
    <path d="M33 31l10-7 10 5" fill="none" stroke="#fff" stroke-width="2" opacity=".45" stroke-linecap="round"/>`,
  iron: `<defs><linearGradient id="a§" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9eef3"/><stop offset=".5" stop-color="#a9b4bf"/><stop offset="1" stop-color="#6a7682"/></linearGradient><linearGradient id="b§" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7f8a96"/><stop offset="1" stop-color="#4c5560"/></linearGradient></defs>${SHADOW}
    <path d="M10 48l6-14h32l6 14z" fill="url(#b§)"/><path d="M16 34l4-8h24l4 8z" fill="url(#a§)"/>
    <path d="M10 48l6-14h32l6 14z" fill="none" stroke="#3d4650" stroke-width="1" opacity=".5"/>
    <path d="M22 29h18" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/>`,
  steel: `<defs><linearGradient id="a§" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe0ee"/><stop offset=".5" stop-color="#7e93a6"/><stop offset="1" stop-color="#455669"/></linearGradient></defs>${SHADOW}
    <path d="M8 20h48v6H36v16h20v6H8v-6h20V26H8z" fill="url(#a§)"/><path d="M8 20h48" stroke="#fff" stroke-width="1.5" opacity=".6"/>`,
  coal: `<defs><radialGradient id="a§" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#5b6370"/><stop offset=".5" stop-color="#262a31"/><stop offset="1" stop-color="#0d0f12"/></radialGradient></defs>${SHADOW}
    <path d="M9 50l4-11 10-4 7 6-2 9z" fill="url(#a§)"/><path d="M27 51l2-14 11-7 12 5 3 11-6 6z" fill="url(#a§)"/><path d="M20 38l6-12 10-2 4 8-9 8z" fill="url(#a§)"/>
    <path d="M30 33l9-6M23 30l5-4M44 34l6 3" stroke="#9fb3d1" stroke-width="1.6" opacity=".55" stroke-linecap="round"/>`,
  planks: `<defs><linearGradient id="a§" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1cf96"/><stop offset="1" stop-color="#c89452"/></linearGradient><linearGradient id="b§" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c08848"/><stop offset="1" stop-color="#8d5a26"/></linearGradient></defs>${SHADOW}
    <path d="M6 44l30-10 22 6-30 10z" fill="url(#a§)"/><path d="M6 44v5l22 7v-6z" fill="url(#b§)"/><path d="M28 50v6l30-10v-6z" fill="#a8723a"/>
    <path d="M6 36l30-10 22 6-30 10z" fill="url(#a§)"/><path d="M6 36v5l22 7v-6z" fill="url(#b§)"/><path d="M28 42v6l30-10v-6z" fill="#a8723a"/>
    <path d="M12 37l24-8M18 40l24-8" stroke="#a46d33" stroke-width="1" opacity=".55"/>`,
  bricks: `<defs><linearGradient id="a§" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e98a6a"/><stop offset="1" stop-color="#b24a2f"/></linearGradient><linearGradient id="b§" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9d3d25"/><stop offset="1" stop-color="#6e2614"/></linearGradient></defs>${SHADOW}
    <rect x="8" y="40" width="22" height="11" rx="1.5" fill="url(#a§)"/><rect x="32" y="40" width="22" height="11" rx="1.5" fill="url(#a§)"/>
    <rect x="20" y="28" width="22" height="11" rx="1.5" fill="url(#a§)"/><rect x="26" y="16" width="22" height="11" rx="1.5" fill="url(#b§)" opacity="0"/>
    <path d="M8 46h22M32 46h22M20 34h22" stroke="#7a2a16" stroke-width="1" opacity=".35"/><path d="M10 41h18M34 41h18M22 29h18" stroke="#ffd2bf" stroke-width="1.3" opacity=".6"/>`,
  grain: `<defs><linearGradient id="a§" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7dd8a"/><stop offset="1" stop-color="#c99a2e"/></linearGradient></defs>${SHADOW}
    <path d="M32 54V16M32 54l-12-30M32 54l12-30" stroke="#a9842c" stroke-width="2.2" stroke-linecap="round"/>
    ${[[32, 14], [32, 22], [32, 30], [20, 22], [22, 30], [44, 22], [42, 30]].map(([x, y]) => `<ellipse cx="${x - 3}" cy="${y}" rx="3" ry="5" transform="rotate(-25 ${x - 3} ${y})" fill="url(#a§)"/><ellipse cx="${x + 3}" cy="${y}" rx="3" ry="5" transform="rotate(25 ${x + 3} ${y})" fill="url(#a§)"/>`).join('')}
    <path d="M27 50h10" stroke="#8a6a1e" stroke-width="5" stroke-linecap="round"/>`,
  flour: `<defs><radialGradient id="a§" cx=".35" cy=".35" r=".9"><stop offset="0" stop-color="#fffdf7"/><stop offset=".7" stop-color="#e8dfcc"/><stop offset="1" stop-color="#bfb196"/></radialGradient></defs>${SHADOW}
    <path d="M16 52c-4 0-6-3-5-8l4-20c1-4 4-6 8-6h18c4 0 7 2 8 6l4 20c1 5-1 8-5 8z" fill="url(#a§)"/>
    <path d="M22 18c0-4 4-8 10-8s10 4 10 8" fill="#efe6d3" stroke="#bfb196" stroke-width="1"/><path d="M22 18h20" stroke="#8a6a3a" stroke-width="3" stroke-linecap="round"/>
    <path d="M32 44V30M32 36l-4-4M32 36l4-4M32 41l-4-4M32 41l4-4" stroke="#c99a2e" stroke-width="2" stroke-linecap="round"/>`,
  milk: `<defs><linearGradient id="a§" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#eef3f8"/><stop offset="1" stop-color="#b9c7d6"/></linearGradient><linearGradient id="b§" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5aa6e8"/><stop offset="1" stop-color="#2c6fb3"/></linearGradient></defs>${SHADOW}
    <path d="M26 8h12v8l6 9v25c0 3-2 5-5 5H25c-3 0-5-2-5-5V25l6-9z" fill="url(#a§)" stroke="#9fb0c2" stroke-width="1"/>
    <rect x="25" y="5" width="14" height="6" rx="2" fill="url(#b§)"/><rect x="20" y="32" width="24" height="12" fill="url(#b§)" opacity=".85"/>
    <path d="M24 26v22" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".9"/>`,
  cotton: `<defs><radialGradient id="a§" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d6d9de"/></radialGradient></defs>${SHADOW}
    <path d="M32 54V36" stroke="#6b4a2a" stroke-width="3" stroke-linecap="round"/><path d="M20 40l12 6 12-6-4 8h-16z" fill="#7a5532"/>
    <circle cx="24" cy="30" r="10" fill="url(#a§)"/><circle cx="40" cy="30" r="10" fill="url(#a§)"/><circle cx="32" cy="22" r="11" fill="url(#a§)"/><circle cx="32" cy="35" r="9" fill="url(#a§)"/>`,
  garments: `<defs><linearGradient id="a§" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6ea8f0"/><stop offset="1" stop-color="#2f62b8"/></linearGradient></defs>${SHADOW}
    <path d="M22 10l-14 8 5 11 6-3v26h26V26l6 3 5-11-14-8c-1 4-4 6-8 6s-7-2-8-6z" fill="url(#a§)" stroke="#244c8f" stroke-width="1"/>
    <path d="M24 11c1 4 4 6 8 6s7-2 8-6" fill="none" stroke="#1d3f78" stroke-width="2"/><path d="M22 30v18" stroke="#fff" stroke-width="2" opacity=".35" stroke-linecap="round"/>`,
  furniture: `<defs><linearGradient id="a§" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c98c50"/><stop offset="1" stop-color="#7d4b1f"/></linearGradient><linearGradient id="b§" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9a066"/><stop offset="1" stop-color="#a86a32"/></linearGradient></defs>${SHADOW}
    <rect x="20" y="8" width="24" height="26" rx="3" fill="url(#a§)"/><rect x="24" y="12" width="16" height="4" rx="1" fill="#e9bf8a" opacity=".6"/>
    <path d="M14 34h36l-3 6H17z" fill="url(#b§)"/><path d="M18 40v14M46 40v14M22 40v10M42 40v10" stroke="#6a3c17" stroke-width="3.2" stroke-linecap="round"/>`,
  feed: `<defs><linearGradient id="a§" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffe17a"/><stop offset="1" stop-color="#e3a91c"/></linearGradient><linearGradient id="b§" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8fd36a"/><stop offset="1" stop-color="#3f8a2e"/></linearGradient></defs>${SHADOW}
    <ellipse cx="32" cy="30" rx="10" ry="21" fill="url(#a§)"/>
    <path d="M24 18h16M23 25h18M23 32h18M24 39h16M27 12v36M32 10v40M37 12v36" stroke="#c88d10" stroke-width=".9" opacity=".7"/>
    <path d="M32 54c-10-4-16-16-14-30 6 6 10 16 14 30zM32 54c10-4 16-16 14-30-6 6-10 16-14 30z" fill="url(#b§)"/>`,
  money: `<defs><radialGradient id="a§" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#fff2b3"/><stop offset=".55" stop-color="#f2b33d"/><stop offset="1" stop-color="#b57514"/></radialGradient><linearGradient id="b§" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d99a28"/><stop offset="1" stop-color="#8f5a0c"/></linearGradient></defs>${SHADOW}
    ${[48, 42, 36, 30].map((y) => `<ellipse cx="26" cy="${y + 3}" rx="15" ry="5" fill="url(#b§)"/><ellipse cx="26" cy="${y}" rx="15" ry="5" fill="url(#a§)"/>`).join('')}
    <ellipse cx="44" cy="45" rx="13" ry="13" fill="url(#b§)"/><circle cx="43" cy="43" r="12" fill="url(#a§)"/><circle cx="43" cy="43" r="8.5" fill="none" stroke="#b57514" stroke-width="1.4"/>
    <text x="43" y="48" text-anchor="middle" font-size="13" font-weight="900" font-family="system-ui,sans-serif" fill="#8f5a0c">$</text>`,
  car: `<defs><linearGradient id="a§" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7a6b"/><stop offset="1" stop-color="#b7271c"/></linearGradient><linearGradient id="b§" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe9ff"/><stop offset="1" stop-color="#6aa6d6"/></linearGradient></defs>${SHADOW}
    <path d="M6 44v-7c0-3 2-5 5-5h5l6-9c1-2 3-3 5-3h12c2 0 4 1 5 3l6 9h3c3 0 5 2 5 5v7c0 2-1 3-3 3H9c-2 0-3-1-3-3z" fill="url(#a§)"/>
    <path d="M20 32l5-8h7v8zM35 32v-8h6l5 8z" fill="url(#b§)"/>
    <circle cx="18" cy="47" r="6" fill="#23272e"/><circle cx="18" cy="47" r="2.6" fill="#aab4be"/><circle cx="46" cy="47" r="6" fill="#23272e"/><circle cx="46" cy="47" r="2.6" fill="#aab4be"/>
    <path d="M10 37h4M52 37h3" stroke="#ffe08a" stroke-width="3" stroke-linecap="round"/>`,
};
ART.logs = ART.wood;
ART.cars = ART.car;

let seq = 0;

/** The picture of a good as an SVG string (`size` in pixels). Unknown goods get a plain crate. */
export function goodIcon(good: string, size = 28): string {
  const art = ART[good] ?? CRATE;
  const id = `g${(seq++).toString(36)}`;
  return `<svg class="gi" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">${art.replace(/§/g, id)}</svg>`;
}

const CRATE = `<defs><linearGradient id="a§" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9a866"/><stop offset="1" stop-color="#94602c"/></linearGradient></defs>${SHADOW}
  <rect x="12" y="18" width="40" height="34" rx="3" fill="url(#a§)"/><path d="M12 30h40M12 41h40M24 18v34M40 18v34" stroke="#6e4319" stroke-width="1.5" opacity=".6"/>`;

/** Goods by their name as the player reads it (in the chosen language), to put the picture next to any label. */
const NAMES: Record<string, string> = {
  Money: 'money', Food: 'food', Wood: 'wood', Stone: 'stone', Iron: 'iron', Coal: 'coal', Planks: 'planks', Bricks: 'bricks', Grain: 'grain',
  Flour: 'flour', Milk: 'milk', Cotton: 'cotton', Clothes: 'garments', Furniture: 'furniture', Steel: 'steel', Feed: 'feed', Cars: 'car', Logs: 'logs',
};
let byLabel: Map<string, string> | null = null, lang = '';
export function goodOfLabel(label: string): string | undefined {
  const key = t('Food') + t('Wood');
  if (!byLabel || lang !== key) { lang = key; byLabel = new Map(Object.entries(NAMES).flatMap(([en, g]) => [[en.toLowerCase(), g], [t(en).toLowerCase(), g]])); }
  return byLabel.get(label.trim().toLowerCase());
}

/** Put a good's picture before a label's text when the label names a good (Food, Wood, Bricks…). */
export function labelWithGood(e: HTMLElement, label: string, size = 18) {
  const g = goodOfLabel(label);
  e.textContent = label;
  if (g) { e.insertAdjacentHTML('afterbegin', goodIcon(g, size)); e.classList.add('gi-lab'); }
}
