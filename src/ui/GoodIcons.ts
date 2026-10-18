import { t } from '../i18n/i18n';
/** Town ledger illustrations: consistent ink outlines, no bitmap or gradient assets. */
const ART: Record<string, string> = {
  "food": "<path d=\"M8 39c0-15 10-23 24-23s24 8 24 23v9H8zM20 24l-3 9M32 21l-3 10M44 24l-3 9M8 41h48\"/>",
  "wood": "<path d=\"M16 27h33a8 8 0 0 1 0 16H16M22 19h23a7 7 0 0 1 7 7\"/><ellipse cx=\"16\" cy=\"35\" rx=\"8\" ry=\"8\"/><circle cx=\"16\" cy=\"35\" r=\"3\"/><path d=\"M30 31h18M31 38h11\"/>",
  "stone": "<path d=\"m9 45 5-19 16-10 17 7 8 22-23 7zM14 26l18 9 15-12M32 35v17\"/>",
  "iron": "<path d=\"m9 45 7-18 8-9h17l8 9 7 18zM16 27h33M24 18l-2 9M41 18l3 9\"/>",
  "steel": "<path d=\"M10 15h44v8H38v19h16v8H10v-8h16V23H10zM14 19h36M30 27v12\"/>",
  "coal": "<path d=\"m8 48 3-14 12-7 10 9-4 14zm24 1 3-20 13-5 10 17-7 10M18 28l5-14 13 3 5 9M36 30l10 10 12 1\"/>",
  "planks": "<path d=\"m8 25 30-12 18 8-30 12zm0 0v8l18 8 30-12v-8M8 39v7l18 8 30-12v-7M26 33v8M26 48v6M19 25l20-8\"/>",
  "bricks": "<path d=\"M9 35h46v15H9zM21 20h23v15H21zM32 35v15M9 42h46M21 27h23\"/>",
  "grain": "<path d=\"M32 53V12M32 24c-9 0-13-5-13-11 8 0 13 5 13 11zm0 0c9 0 13-5 13-11-8 0-13 5-13 11zm0 13c-9 0-13-5-13-11 8 0 13 5 13 11zm0 0c9 0 13-5 13-11-8 0-13 5-13 11zM24 48h16\"/>",
  "flour": "<path d=\"m22 18-5-8h30l-5 8 9 29c1 5-3 7-8 7H21c-5 0-9-2-8-7zM22 18h20M32 43V29M32 35l-6-5M32 39l6-5\"/>",
  "milk": "<path d=\"M25 8h14v10l7 11v22H18V29l7-11zM25 14h14M18 33h28M18 44h28M30 37h4\"/>",
  "cotton": "<path d=\"M32 54V39M32 45l-10-4M32 48l10-4M21 36c-15 0-15-20-3-20 0-15 28-15 28 0 12 0 12 20-3 20-3 9-19 9-22 0z\"/>",
  "garments": "<path d=\"m22 12-14 9 6 12 7-4v23h22V29l7 4 6-12-14-9c-3 8-17 8-20 0zM25 43h14\"/>",
  "furniture": "<path d=\"M20 32V12h24v20M25 18h14M14 33h36v8H14zM18 41v13M46 41v13M23 41v9M41 41v9\"/>",
  "feed": "<path d=\"M23 43c-9-8-6-30 9-33 15 3 18 25 9 33M32 54C13 50 9 37 11 29c14 2 20 11 21 25zm0 0c19-4 23-17 21-25-14 2-20 11-21 25zM27 20h10M25 27h14M32 16v20\"/>",
  "money": "<rect x=\"9\" y=\"18\" width=\"46\" height=\"28\" rx=\"3\"/><circle cx=\"32\" cy=\"32\" r=\"8\"/><path d=\"M15 25h3M46 39h3M32 27v10M35 29h-4c-4 0-4 3 0 3h2c4 0 4 3 0 3h-4\"/>",
  "car": "<path d=\"M8 41V30l8-3 7-12h20l7 12 6 3v11H8M16 27h34M33 16v11\"/><circle cx=\"19\" cy=\"42\" r=\"6\"/><circle cx=\"47\" cy=\"42\" r=\"6\"/><path d=\"M9 33h6M50 33h5\"/>",
  "water": "<path d=\"M32 9S15 29 15 39a17 17 0 0 0 34 0C49 29 32 9 32 9zM23 39c0 6 4 9 9 9\"/>",
  "energy": "<path d=\"M36 7 14 35h16l-2 22 22-30H34z\"/>",
  "logs": "<path d=\"M16 27h33a8 8 0 0 1 0 16H16M22 19h23a7 7 0 0 1 7 7\"/><ellipse cx=\"16\" cy=\"35\" rx=\"8\" ry=\"8\"/><circle cx=\"16\" cy=\"35\" r=\"3\"/><path d=\"M30 31h18M31 38h11\"/>",
  "cars": "<path d=\"M8 41V30l8-3 7-12h20l7 12 6 3v11H8M16 27h34M33 16v11\"/><circle cx=\"19\" cy=\"42\" r=\"6\"/><circle cx=\"47\" cy=\"42\" r=\"6\"/><path d=\"M9 33h6M50 33h5\"/>"
};
const CRATE = '<rect x="12" y="16" width="40" height="36" rx="2"/><path d="M12 28h40M12 40h40M23 16v36M41 16v36"/>';
export function goodIcon(good: string, size = 28): string {
  return `<svg class="gi" viewBox="0 0 64 64" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 47h40v8H12z" fill="currentColor" opacity=".07" stroke="none"/>${ART[good] ?? CRATE}</svg>`;
}
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
