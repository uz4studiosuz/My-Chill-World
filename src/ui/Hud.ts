import { ToolId } from '../build/BuildTool';
import { IS_TOUCH } from '../config';
import { BUILDINGS, BuildingKind } from '../buildings/BuildingTypes';
import { ROAD_COST, ROUNDABOUT_COST } from '../roads/RoadNetwork';
import { el, icon, IconName } from './dom';
import { t } from '../i18n/i18n';

type Category = 'roads' | 'buildings' | 'services' | 'business' | 'production';

interface ToolItem {
  tool: ToolId;
  cat: Category;
  name: string;
  desc: string;
  money: number;
  stone: number;
  wood: number;
  perTile?: boolean;
  tag: string;
  icon: IconName;
}

const b = (tool: BuildingKind & ToolId, cat: Category, tag: string, desc: string, ic: IconName): ToolItem => {
  const d = BUILDINGS[tool];
  return { tool, cat, name: d.name, desc, money: d.money, stone: d.stone, wood: d.wood, tag, icon: ic };
};

const ITEMS: ToolItem[] = [
  { tool: 'road', cat: 'roads', name: 'Road', desc: 'Two-lane road with sidewalks. Over water it becomes a bridge.', ...ROAD_COST[2], wood: 0, perTile: true, tag: 'Cars, power, water', icon: 'road' },
  { tool: 'roundabout', cat: 'roads', name: 'Roundabout', desc: 'Place it on a junction — roads connect to the middle of each side.', ...ROUNDABOUT_COST, wood: 0, tag: '3×3 · no lights', icon: 'roundabout' },
  { tool: 'path', cat: 'roads', name: 'Footpath', desc: 'Free walking path. People walk faster on paths than on grass.', money: 0, stone: 0, wood: 0, perTile: true, tag: 'Free · pedestrians', icon: 'path' },
  { tool: 'canal', cat: 'roads', name: 'Irrigation Canal', desc: 'Dig from a river or lake to a crop farm — farms need water to grow.', money: 8, stone: 0, wood: 0, perTile: true, tag: 'Water for farms', icon: 'canal' },
  b('townhall', 'buildings', 'New city', 'Found a new city with its own Town Hall, treasury and citizens. Select a Town Hall to build for that city.', 'buildings'),
  b('house', 'buildings', 'One family', 'Home for one family (up to 10 people). Needs a road.', 'house'),
  b('watertower', 'buildings', 'Water for 160', 'Clean drinking water. Without it people get sick.', 'watertower'),
  b('park', 'buildings', 'Green space', 'A park with a pond and benches. People recover faster in a green town.', 'orchard'),
  b('parking', 'buildings', '8 spaces', 'Commuters park here when their workplace is nearby.', 'parking'),
  b('cemetery', 'buildings', '16 graves', 'Resting place for deceased citizens. Families buy graves. Can be upgraded.', 'cemetery'),
  b('school', 'services', '40 pupils', 'Children aged 6–17 study here. Educated adults earn 50% more.', 'school'),
  b('university', 'services', '30 students', 'Young adults with a school diploma study for 4 years and become specialists with a degree.', 'school'),
  b('police', 'services', 'Safety', 'Officers cut down fights, accidents and murders in the city.', 'jobs'),
  b('hospital', 'services', 'Heals people', 'Doctors and nurses treat the sick. Reduces deaths from illness, fights and accidents.', 'heart'),
  b('weddinghall', 'services', 'Weddings', 'Young couples can only marry and start families if the town has one.', 'heart'),
  b('market', 'business', 'Shopping', 'Bazaar: families spend money on food, clothes and goods. The town takes 20% business tax.', 'food'),
  b('carmarket', 'business', 'Sells cars', 'Families buy their cars here once they have saved enough.', 'car'),
  b('bank', 'business', 'Finance', 'Pays business tax to the town and employs skilled people.', 'coin'),
  b('gasstation', 'business', 'Fuel', 'Sells fuel to the town\'s drivers and pays business tax.', 'energy'),
  b('office', 'business', '24 jobs', 'Workplace with parking spaces in front.', 'office'),
  b('construction', 'business', 'Builders', 'Builders work here. Buildings are completed faster when the city has a construction company.', 'quarry'),
  b('factory', 'production', 'Industry', 'Many jobs and a high turnover — a big business tax payer. Needs lots of power.', 'production'),
  b('carfactory', 'production', 'Cars', 'Assembles cars: the best-paying workplace and the largest business tax payer.', 'car'),
  b('woodcutter', 'production', '3 jobs · wood', 'Near a forest. Workers fell trees bit by bit and carry logs to the power plant.', 'woodcutter'),

  b('powerplant', 'production', '+90 energy/day', 'Burns wood. Power reaches only buildings connected to it by road.', 'powerplant'),
  b('farm', 'production', '+90 food/day', 'Crop field (3×3). Needs water from a canal or rain. Grows March–October.', 'farm'),
  b('orchard', 'production', '+30 food/day', 'Fruit trees — best harvest in summer and autumn.', 'orchard'),
  b('ranch', 'production', '+35 food/day', 'Fenced pasture with cattle (3×3). Produces all year.', 'ranch'),
  b('quarry', 'production', '8 jobs · stone', 'Must touch mountains. Trucks bring stone to the Town Hall; with no road, miners carry it on foot.', 'quarry'),
];

const CATS: { id: Category; label: string; icon: IconName }[] = [
  { id: 'roads', label: 'Roads', icon: 'roads' },
  { id: 'buildings', label: 'Town', icon: 'buildings' },
  { id: 'services', label: 'Services', icon: 'heart' },
  { id: 'business', label: 'Business', icon: 'coin' },
  { id: 'production', label: 'Production', icon: 'production' },
];

const CAT_DESC: Record<Category, string> = {
  roads: 'Roads, paths and canals connect everything.',
  buildings: 'Housing and the basics of a town.',
  services: 'Schools, hospitals and the institutions people need.',
  business: 'Shops and companies earn money and pay business tax.',
  production: 'Food, wood, energy, stone and industry.',
};

const BASE_HINTS: Partial<Record<ToolId, string>> = {
  pan: IS_TOUCH ? 'Drag to move · Pinch to zoom · Tap a person or building' : 'Drag to move · Scroll to zoom · Q/E rotate · Click a person or building',
  bulldoze: 'Drag over roads, paths, canals and buildings to remove them (50% refund)',
};

export interface HudStats {
  money: number; daily: number; stone: number; wood: number; food: number; foodDaily: number;
  powered: number; water: number; population: number; workers: number; workforce: number;
  dateText: string; seasonIcon: string; timeOfDay: number; broke: boolean;
  cityName: string; cities: number;
}

export interface HudHandlers {
  setTool: (t: ToolId) => void;
  undo: () => void;
  rotate: (dir: number) => void;
  setSpeed: (s: number) => void;
  openMenu: () => void;
  openStats: () => void;
  cycleCity: () => void;
  confirmBuild: () => void;
  cancelBuild: () => void;
}

export const SPEEDS = [0, 1, 2, 3, 10];

export class Hud {

  readonly root: HTMLDivElement;
  private tool: ToolId = 'pan';
  private speedBtns: HTMLButtonElement[] = [];
  private undoBtn: HTMLButtonElement;
  private moveBtn: HTMLButtonElement;
  private removeBtn: HTMLButtonElement;
  private catBtns = new Map<Category, HTMLButtonElement>();
  private cards = new Map<ToolId, HTMLButtonElement>();
  private drawer: HTMLDivElement;
  private drawerCat: Category | null = null;
  private hint: HTMLDivElement;
  private toastEl: HTMLDivElement;
  private stat: Record<string, HTMLSpanElement> = {};
  private chip: Record<string, HTMLButtonElement> = {};
  private dayBar = el('div', 'daybar');
  private toastTimer = 0;
  private lastMoney = 0;
  private lastStone = 0;
  private lastWood = 0;
  private modal?: HTMLDivElement;
  private pendingEl: HTMLDivElement;
  private pendingText: HTMLSpanElement;
  private descEl?: HTMLDivElement;

  constructor(parent: HTMLElement, private h: HudHandlers, private thumbs: Map<string, string>) {
    this.root = el('div', 'hud');

    const top = el('div', 'topbar');
    top.append(this.iconButton('menu', t('Menu'), h.openMenu), this.iconButton('stats', t('Statistics'), h.openStats));
    const chips = el('div', 'chips');
    for (const [key, ic, title] of [
      ['city', 'buildings', 'City you are building for (click to switch)'],
      ['money', 'coin', 'Town money (balance per day)'],
      ['stone', 'stone', 'Stone'],
      ['wood', 'wood', 'Wood (building material and fuel)'],
      ['food', 'food', 'Food (everyone eats 1 per day)'],
      ['energy', 'energy', 'Energy supplied'],
      ['water', 'water', 'Drinking water supplied'],
      ['pop', 'people', 'Population'],
      ['jobs', 'jobs', 'Employed / workforce'],
      ['day', 'calendar', 'Date and time'],
    ] as const) {
      const chip = el('button', 'chip');
      chip.title = t(title);
      chip.innerHTML = icon(ic);
      chip.addEventListener('click', key === 'city' ? h.cycleCity : h.openStats);
      if (key === 'city') chip.classList.add('city');
      const v = el('span', 'v');
      chip.appendChild(v);
      this.stat[key] = v;
      this.chip[key] = chip;
      if (key === 'day') chip.appendChild(this.dayBar);
      chips.appendChild(chip);
    }
    top.appendChild(chips);

    const corner = el('div', 'corner');
    const speeds = el('div', 'speeds');
    SPEEDS.forEach((s) => {
      const btn = el('button', 'sbtn');
      btn.innerHTML = s === 0 ? icon('pause') : `${s}×`;
      btn.setAttribute('aria-label', s === 0 ? t('Pause') : t('Speed {n}', { n: s }));
      btn.addEventListener('click', () => h.setSpeed(s));
      this.speedBtns.push(btn);
      speeds.appendChild(btn);
    });
    const rot = el('div', 'speeds');
    for (const dir of [1, -1]) {
      const btn = el('button', 'sbtn');
      btn.innerHTML = icon(dir > 0 ? 'rotL' : 'rotR');
      btn.setAttribute('aria-label', dir > 0 ? t('Rotate left') : t('Rotate right'));
      btn.addEventListener('click', () => h.rotate(dir));
      rot.appendChild(btn);
    }
    corner.append(speeds, rot);

    this.drawer = el('div', 'drawer');

    const bar = el('div', 'toolbar');
    this.moveBtn = this.toolButton('pan', t('Move'));
    this.moveBtn.addEventListener('click', () => { this.closeDrawer(); h.setTool('pan'); });
    bar.append(this.moveBtn, el('div', 'sep'));
    for (const c of CATS) {
      const btn = this.toolButton(c.icon, t(c.label));
      btn.classList.add('cat');
      btn.addEventListener('click', () => this.toggleDrawer(c.id));
      this.catBtns.set(c.id, btn);
      bar.appendChild(btn);
    }
    bar.appendChild(el('div', 'sep'));
    this.removeBtn = this.toolButton('bulldoze', t('Remove'));
    this.removeBtn.addEventListener('click', () => { this.closeDrawer(); h.setTool('bulldoze'); });
    this.undoBtn = this.toolButton('undo', t('Undo'));
    this.undoBtn.addEventListener('click', h.undo);
    bar.append(this.removeBtn, this.undoBtn);

    this.hint = el('div', 'hint');
    this.toastEl = el('div', 'toast');

    this.pendingEl = el('div', 'pending');
    this.pendingText = el('span', 'ptext');
    const okBtn = el('button', 'pbtn ok');
    okBtn.innerHTML = icon('check') + `<span>${t('Build')}</span>`;
    okBtn.addEventListener('click', h.confirmBuild);
    const noBtn = el('button', 'pbtn no');
    noBtn.innerHTML = icon('close') + `<span>${t('Cancel')}</span>`;
    noBtn.addEventListener('click', h.cancelBuild);
    this.pendingEl.append(this.pendingText, okBtn, noBtn);

    this.root.append(top, corner, this.hint, this.toastEl, this.pendingEl, this.drawer, bar);
    parent.appendChild(this.root);
  }

  private iconButton(name: IconName, label: string, onClick: () => void) {
    const btn = el('button', 'rbtn');
    btn.innerHTML = icon(name);
    btn.setAttribute('aria-label', label);
    btn.title = label;
    btn.addEventListener('click', onClick);
    return btn;
  }

  private toolButton(name: IconName, label: string) {
    const btn = el('button', 'tbtn');
    btn.innerHTML = icon(name) + `<span>${label}</span>`;
    return btn;
  }

  private toggleDrawer(cat: Category) {
    if (this.drawerCat === cat) return this.closeDrawer();
    this.drawerCat = cat;
    this.drawer.replaceChildren();
    const info = CATS.find((c) => c.id === cat)!;
    const title = el('div', 'drawer-title');
    title.innerHTML = icon(info.icon) + `<span>${t(info.label)}</span>`;
    const row = el('div', 'cards');
    this.descEl = el('div', 'drawer-desc');
    this.descEl.textContent = t(CAT_DESC[cat]);
    for (const it of ITEMS.filter((i) => i.cat === cat)) row.appendChild(this.card(it));
    this.drawer.append(title, row, this.descEl);
    this.drawer.classList.add('show');
    this.catBtns.forEach((btn, c) => btn.classList.toggle('open', c === cat));
    this.refreshCards();
  }

  private closeDrawer() {
    this.drawerCat = null;
    this.drawer.classList.remove('show');
    this.catBtns.forEach((btn) => btn.classList.remove('open'));
  }

  private card(it: ToolItem) {
    const btn = el('button', 'card');
    const img = el('div', 'card-img');
    const thumb = this.thumbs.get(it.tool);
    if (thumb) img.style.backgroundImage = `url(${thumb})`;
    else img.innerHTML = icon(it.icon);
    const name = el('b', '');
    name.textContent = t(it.name);
    const tag = el('small', 'tag');
    tag.textContent = t(it.tag);
    const cost = el('div', 'cost');
    const parts = [];
    if (it.money) parts.push(`${icon('coin')}${it.money}`);
    if (it.stone) parts.push(`${icon('stone')}${it.stone}`);
    if (it.wood) parts.push(`${icon('wood')}${it.wood}`);
    cost.innerHTML = parts.length ? parts.join(' ') + (it.perTile ? `<i>/${t('tile')}</i>` : '') : t('Free');
    btn.title = t(it.desc);
    const showDesc = () => { if (this.descEl) this.descEl.textContent = t(it.desc); };
    btn.addEventListener('mouseenter', showDesc);
    btn.addEventListener('focus', showDesc);
    btn.append(img, name, tag, cost);
    btn.addEventListener('click', () => {
      this.h.setTool(it.tool);
      this.closeDrawer();
    });
    this.cards.set(it.tool, btn);
    return btn;
  }

  private refreshCards() {
    for (const it of ITEMS) {
      const c = this.cards.get(it.tool);
      if (!c) continue;
      c.classList.toggle('poor', this.lastMoney < it.money || this.lastStone < it.stone || this.lastWood < it.wood);
      c.classList.toggle('active', this.tool === it.tool);
    }
  }

  setActive(tool: ToolId) {
    this.tool = tool;
    this.closeDrawer();
    this.moveBtn.classList.toggle('active', tool === 'pan');
    this.removeBtn.classList.toggle('active', tool === 'bulldoze');
    const item = ITEMS.find((i) => i.tool === tool);
    this.catBtns.forEach((btn, cat) => {
      const on = item?.cat === cat;
      const c = CATS.find((x) => x.id === cat)!;
      btn.classList.toggle('active', on);
      btn.innerHTML = icon(on ? item!.icon : c.icon) + `<span>${on ? t(item!.name) : t(c.label)}</span>`;
    });
    this.refreshCards();
    this.setHint(null);
  }

  setSpeed(s: number) {
    this.speedBtns.forEach((btn, i) => btn.classList.toggle('active', SPEEDS[i] === s));
  }

  /** Show the confirm / cancel bar for a build that is waiting. */
  setPending(info: { text: string; ok: boolean } | null) {
    this.pendingEl.classList.toggle('show', !!info);
    this.hint.style.visibility = info ? 'hidden' : '';
    if (info) this.pendingText.textContent = info.text;
  }

  setUndoEnabled(on: boolean) {
    this.undoBtn.disabled = !on;
  }

  setHint(text: string | null) {
    const item = ITEMS.find((i) => i.tool === this.tool);
    const base = BASE_HINTS[this.tool] ?? item?.desc ?? '';
    this.hint.textContent = text ?? t(base);
  }

  setStats(s: HudStats) {
    const sign = s.daily >= 0 ? '+' : '';
    this.stat.money.innerHTML = `$${fmt(s.money)} <small class="${s.daily >= 0 ? 'pos' : 'neg'}">${sign}${fmt(s.daily)}</small>`;
    this.stat.city.textContent = s.cities > 1 ? `${s.cityName} ▾` : s.cityName;
    this.stat.stone.textContent = fmt(s.stone);
    this.stat.wood.textContent = fmt(s.wood);
    this.stat.food.innerHTML = `${fmt(s.food)} <small class="${s.foodDaily >= 0 ? 'pos' : 'neg'}">${s.foodDaily >= 0 ? '+' : ''}${fmt(s.foodDaily)}</small>`;
    this.stat.energy.textContent = `${Math.round(s.powered * 100)}%`;
    this.stat.water.textContent = `${Math.round(s.water * 100)}%`;
    this.chip.money.classList.toggle('warn', s.broke);
    this.chip.energy.classList.toggle('warn', s.powered < 0.8);
    this.chip.water.classList.toggle('warn', s.water < 0.9);
    this.chip.food.classList.toggle('warn', s.food < s.population * 2);
    this.chip.wood.classList.toggle('warn', s.wood < 15);
    this.stat.pop.textContent = fmt(s.population);
    this.stat.jobs.textContent = `${s.workers}/${s.workforce}`;
    const mins = Math.floor(s.timeOfDay * 24 * 60);
    this.stat.day.textContent = `${s.seasonIcon} ${s.dateText} · ${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    this.dayBar.style.width = `${Math.round(s.timeOfDay * 100)}%`;
    this.lastMoney = s.money;
    this.lastStone = s.stone;
    this.lastWood = s.wood;
    if (this.drawerCat) this.refreshCards();
  }

  toast(msg: string) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), 2600);
  }

  /** Full-screen notice (bankruptcy). */
  showModal(title: string, text: string, buttons: { label: string; primary?: boolean; onClick: () => void }[]) {
    this.modal?.remove();
    const m = el('div', 'modal');
    const p = el('div', 'panel');
    const h = el('h1', '');
    h.textContent = title;
    const tx = el('p', '');
    tx.textContent = text;
    p.append(h, tx);
    for (const b of buttons) {
      const btn = el('button', `mbtn${b.primary ? ' primary' : ''}`);
      btn.textContent = b.label;
      btn.addEventListener('click', () => { m.remove(); this.modal = undefined; b.onClick(); });
      p.appendChild(btn);
    }
    m.appendChild(p);
    this.root.appendChild(m);
    this.modal = m;
  }

  dispose() {
    clearTimeout(this.toastTimer);
    this.root.remove();
  }
}

const fmt = (n: number) => Math.floor(n).toLocaleString('en-US');
