import { Sample } from '../sim/History';
import { drawChart, Series } from './Chart';
import { el, icon, IconName, hoverBusy } from './dom';
import { t } from '../i18n/i18n';

/** A block of a statistics page built by the game (key figures, rows, shares). */
export interface StatSection {
  title: string;
  kpis?: [string, string, string, boolean?][];
  rows?: [string, string, boolean?][];
  bars?: [string, number, string][];
  note?: string;
}

export interface StatsSnapshot {
  /** Extra pages and blocks (production, energy, finance…). */
  pages: Partial<Record<Tab, StatSection[]>>;
  labour: { kind: string; name: string; workers: number; jobs: number; prio: 'high' | 'normal' | 'low'; wage: number; factor: number; publicJob: boolean }[];
  wageAuto: boolean;
  unemployed: number;
  cityName: string;
  cities: number;
  happiness: number;
  taxRate: number;
  loan: number;
  iron: number;
  mayor: string;
  cityList: { name: string; pop: number; money: number; happiness: number; net: number; active: boolean }[];
  services: [string, number][];
  businesses: { owned: number; total: number };
  money: number;
  stone: number;
  wood: number;
  food: number;
  foodRate: number;
  energyDemand: number;
  energyCapacity: number;
  powered: number;
  water: number;
  population: number;
  families: number;
  carsOwned: number;
  people: { men: number; women: number; boys: number; girls: number; babies: number; elders: number; students: number; workers: number; workforce: number; hungry: number; sick: number };
  jobs: number;
  schoolSeats: number;
  freeHomes: number;
  balance: { incomeTax: number; foodSales: number; propertyTax: number; businessTax: number; utilities: number; publicWages: number; upkeep: number; net: number; fares?: number; services?: number };
  buildings: Record<string, number>;
  roads: { total: number; bridges: number; roundabouts: number; signals: number; footpaths: number; canals: number };
  traffic: { cars: number; trucks: number; walkers: number; parked: number };
  animals: { cows: number; sheep: number; herds: number };
  trees: number;
  hasHall: boolean;
  deathsYesterday: number;
  history: Sample[];
}

type Tab = 'overview' | 'people' | 'jobs' | 'economy' | 'production' | 'energy' | 'finance' | 'cities' | 'traffic' | 'nature';
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'overview', label: 'Overview', icon: 'stats' },
  { id: 'people', label: 'People', icon: 'people' },
  { id: 'jobs', label: 'Jobs', icon: 'jobs' },
  { id: 'economy', label: 'Economy', icon: 'coin' },
  { id: 'production', label: 'Production', icon: 'production' },
  { id: 'energy', label: 'Energy & water', icon: 'energy' },
  { id: 'finance', label: 'Bank & trade', icon: 'globe' },
  { id: 'cities', label: 'Cities', icon: 'buildings' },
  { id: 'traffic', label: 'Traffic', icon: 'roads' },
  { id: 'nature', label: 'Nature', icon: 'cow' },
];

const C = { blue: '#6fb6ff', green: '#7be08f', amber: '#f2b33d', red: '#ff7a6e', violet: '#b9a3e0', gray: '#aab4be', pink: '#f28cb8', brown: '#c98a5a' };

/** Statistics drawer: KPIs, warnings, budget and history charts. */
export class StatsPanel {
  private root: HTMLDivElement;
  private body: HTMLDivElement;
  private tabBtns = new Map<Tab, HTMLButtonElement>();
  private tab: Tab = 'overview';
  private last = '';
  private tabScroll = new Map<Tab, number>();
  visible = false;
  private title!: HTMLElement;

  constructor(parent: HTMLElement, private get: () => StatsSnapshot, private setPriority: (kind: string, prio: 'high' | 'normal' | 'low') => void = () => {}, private setWage: (kind: string, step: number) => void = () => {}) {
    this.root = el('div', 'stats');
    const head = el('div', 'stats-head');
    const title = el('b', '');
    this.title = title;
    title.textContent = t('Statistics');
    const close = el('button', 'info-x');
    close.innerHTML = icon('close');
    close.setAttribute('aria-label', t('Close'));
    close.addEventListener('click', () => this.hide());
    head.append(title, close);
    const tabs = el('div', 'stats-tabs');
    for (const tb of TABS) {
      const b = el('button', 'stab');
      b.innerHTML = icon(tb.icon) + `<span>${t(tb.label)}</span>`;
      b.addEventListener('click', () => { this.tab = tb.id; this.render(); });
      this.tabBtns.set(tb.id, b);
      tabs.appendChild(b);
    }
    this.body = el('div', 'stats-body');
    this.root.append(head, tabs, this.body);
    parent.appendChild(this.root);
  }

  /** The window element (it can be shown inside the town hall window). */
  get element() { return this.root; }

  toggle() {
    if (this.visible) this.hide();
    else this.show();
  }

  /** Show one page (inside the town hall window the page buttons are hidden). */
  openTab(tab: string) {
    if (TABS.some((x) => x.id === tab)) this.tab = tab as Tab;
    this.last = '';
    this.show();
  }

  show() {
    this.visible = true;
    this.root.classList.add('show');
    this.render();
  }

  hide() {
    this.visible = false;
    this.root.classList.remove('show');
  }

  render() {
    if (!this.visible) return;
    if (hoverBusy(this.root)) return;
    this.tabBtns.forEach((b, id) => b.classList.toggle('active', id === this.tab));
    const s = this.get();
    // nothing changed: keep the page as it is (no flicker)
    const key = `${this.tab}|${JSON.stringify(s)}`;
    if (key === this.last) return;
    this.last = key;
    this.title.textContent = `${t('Statistics')} · ${s.cityName}`;
    const currentScroll = this.body.scrollTop;
    if (currentScroll > 0) this.tabScroll.set(this.tab, currentScroll);
    const scroll = this.tabScroll.get(this.tab) ?? 0;
    this.body.replaceChildren();
    const charts: [HTMLCanvasElement, Series[], (n: number) => string][] = [];
    const chart = (title: string, series: Series[], format: (n: number) => string = num) => {
      const box = el('div', 'chart');
      const head = el('div', 'chart-head');
      const tt = el('span', '');
      tt.textContent = title;
      const legend = el('span', 'legend');
      legend.innerHTML = series.map((x) => `<i style="background:${x.color}"></i>${x.label}`).join(' ');
      head.append(tt, legend);
      const c = el('canvas', '');
      box.append(head, c);
      this.body.appendChild(box);
      charts.push([c, series, format]);
    };
    const series = (key: keyof Sample) => s.history.map((x) => (x[key] as number) ?? 0);
    const p = s.people;
    const daysOfFood = s.population ? s.food / s.population : 99;

    switch (this.tab) {
      case 'overview': {
        this.kpis([
          [t('People'), num(s.population), t('{a} families · {b} free homes', { a: s.families, b: s.freeHomes })],
          [t('Employment'), pct(p.workforce ? p.workers / p.workforce : 1), t('{a}/{b} working', { a: p.workers, b: p.workforce })],
          [t('Money'), `$${num(s.money)}`, `${sign(s.balance.net)}$${num(Math.abs(s.balance.net))} ${t('yesterday')}`, s.balance.net >= 0],
          [t('Food'), num(s.food), t('{n} days of food', { n: daysOfFood.toFixed(1) }), daysOfFood > 3],
          [t('Energy'), pct(s.powered), t('{a} made / {b} needed', { a: num(s.energyCapacity), b: num(s.energyDemand) }), s.powered > 0.95],
          [t('Water'), pct(s.water), t('drinking water'), s.water > 0.99],
          [t('Happiness'), pct(s.happiness / 100), s.happiness >= 60 ? t('people are content') : s.happiness >= 45 ? t('could be better') : t('people are leaving'), s.happiness >= 45],
          [t('Iron'), num(s.iron), t('for industry')],
          [t('Mayor'), s.mayor || '—', ''],
        ]);
        this.notes(s);
        chart(t('Population'), [{ label: t('People'), color: C.blue, values: series('pop') }]);
        chart(t('Happiness'), [{ label: '%', color: C.pink, values: series('happy') }], (n) => `${Math.round(n)}%`);
        chart(t('Money'), [{ label: t('Money'), color: C.amber, values: series('money') }], (n) => `$${short(n)}`);
        break;
      }
      case 'people': {
        this.kpis([
          [t('People'), num(s.population), t('{n} families', { n: s.families })],
          [t('Workers'), num(p.workers), t('of {a} able · {b} jobs', { a: p.workforce, b: s.jobs })],
          [t('Pupils'), num(p.students), t('{n} school places', { n: s.schoolSeats })],
          [t('Hungry / sick'), `${p.hungry} / ${p.sick}`, t('{n} died yesterday', { n: s.deathsYesterday }), p.hungry + p.sick === 0],
        ]);
        this.bars(t('Who lives here'), [
          [t('Men'), p.men, C.blue], [t('Women'), p.women, C.pink], [t('Boys'), p.boys, '#8fc8ff'],
          [t('Girls'), p.girls, '#f7b9d4'], [t('Babies'), p.babies, '#f2ede2'], [t('Elders'), p.elders, C.violet],
        ]);
        chart(t('People & workers'), [
          { label: t('People'), color: C.blue, values: series('pop') },
          { label: t('Working'), color: C.green, values: series('employed') },
        ]);
        break;
      }
      case 'economy': {
        const b = s.balance;
        this.rows(t("Yesterday's town budget"), [
          [t('Income tax ({n}%)', { n: Math.round(s.taxRate * 100) }), `+$${num(b.incomeTax)}`, true],
          [t('Food sales'), `+$${num(b.foodSales)}`, true],
          [t('Property tax'), `+$${num(b.propertyTax)}`, true],
          [t('Business tax'), `+$${num(b.businessTax)}`, true],
          [t('Utility bills'), `+$${num(b.utilities)}`, true],
          [t('Bus fares'), `+$${num(b.fares ?? 0)}`, true],
          [t('Services (hospital, parking)'), `+$${num(b.services ?? 0)}`, true],
          [t('Public wages'), `−$${num(b.publicWages)}`, false],
          [t('Upkeep'), `−$${num(b.upkeep)}`, false],
          [t('Net'), `${sign(b.net)}$${num(Math.abs(b.net))}`, b.net >= 0],
        ]);
        chart(t('Money'), [{ label: t('Money'), color: C.amber, values: series('money') }], (n) => `$${short(n)}`);
        this.kpis([
          [t('Bank loan'), `$${num(s.loan)}`, t('1% interest per day'), s.loan === 0],
          [t('Businesses'), num(s.businesses.total), t('{n} owned by families', { n: s.businesses.owned })],
          [t('Tax rate'), pct(s.taxRate), t('set it in the Town Hall')],
        ]);
        chart(t('Food & wood'), [{ label: t('Food'), color: C.green, values: series('food') }, { label: t('Wood'), color: C.brown, values: series('wood') }]);
        chart(t('Energy supplied'), [{ label: '%', color: '#ffe066', values: series('energy') }], (n) => `${Math.round(n)}%`);
        chart(t('Iron'), [{ label: t('Iron'), color: C.gray, values: series('iron') }]);
        break;
      }
      case 'jobs': {
        const open = s.labour.reduce((a, j) => a + Math.max(0, j.jobs - j.workers), 0);
        this.kpis([
          [t('Open jobs'), num(open), open ? t('workplaces need people') : t('every job is filled'), open === 0],
          [t('Unemployed'), num(s.unemployed), s.unemployed ? t('build workplaces') : t('everyone works'), s.unemployed === 0],
          [t('Workers'), num(p.workers), t('of {a} able · {b} jobs', { a: p.workforce, b: s.labour.reduce((a, j) => a + j.jobs, 0) })],
        ]);
        // wages: automatic (the town hall raises pay where workers are missing) or set by hand
        const wbox = el('div', 'srows');
        const wt = el('div', 'srows-title');
        wt.textContent = t('Wages');
        const mode = el('div', 'wage-mode');
        const ml = el('span', '');
        ml.textContent = s.wageAuto ? t('The town hall sets wages automatically: more pay where workers are missing') : t('You set the wages by hand');
        const mb = el('button', `segbtn${s.wageAuto ? ' active' : ''}`);
        mb.textContent = s.wageAuto ? t('Automatic') : t('Manual');
        mb.addEventListener('click', () => this.setWage('*', 0));
        mode.append(ml, mb);
        wbox.append(wt, mode);
        const avg = s.labour.length ? s.labour.reduce((a, j) => a + j.wage * j.workers, 0) / Math.max(1, s.labour.reduce((a, j) => a + j.workers, 0)) : 0;
        const avgRow = el('div', 'info-row');
        avgRow.innerHTML = `<span>${t('Average wage')}</span><span>$${avg.toFixed(1)}/${t('day')}</span>`;
        wbox.appendChild(avgRow);
        for (const j of [...s.labour].sort((a, b) => b.wage - a.wage)) {
          const row = el('div', 'job-row');
          const name = el('span', 'job-name');
          name.textContent = j.name;
          const pay = el('span', `job-fill ${j.factor > 1.01 ? 'pos' : j.factor < 0.99 ? 'neg' : ''}`);
          pay.textContent = `$${j.wage}${j.factor !== 1 ? ` (${j.factor > 1 ? '+' : ''}${Math.round((j.factor - 1) * 100)}%)` : ''}`;
          pay.title = j.publicJob ? t('Paid by the town hall') : t('Paid by the business');
          const seg = el('div', 'seg');
          for (const [step, label] of [[-1, '−10%'], [1, '+10%']] as const) {
            const b = el('button', 'segbtn');
            b.textContent = label;
            b.addEventListener('click', () => this.setWage(j.kind, step));
            seg.appendChild(b);
          }
          row.append(name, pay, seg);
          wbox.appendChild(row);
        }
        const box = el('div', 'srows');
        const tt = el('div', 'srows-title');
        tt.textContent = t('Who gets workers first');
        box.appendChild(tt);
        for (const j of s.labour) {
          const row = el('div', 'job-row');
          const name = el('span', 'job-name');
          name.textContent = j.name;
          const fill = el('span', `job-fill ${j.workers < j.jobs ? 'neg' : 'pos'}`);
          fill.textContent = `${j.workers}/${j.jobs}`;
          const seg = el('div', 'seg');
          for (const [id, label] of [['high', 'High'], ['normal', 'Normal'], ['low', 'Low']] as const) {
            const b = el('button', `segbtn${j.prio === id ? ' active' : ''}`);
            b.textContent = t(label);
            b.addEventListener('click', () => this.setPriority(j.kind, id));
            seg.appendChild(b);
          }
          row.append(name, fill, seg);
          box.appendChild(row);
        }
        this.body.append(box, wbox);
        break;
      }
      case 'cities': {
        const box = el('div', 'srows');
        const tt = el('div', 'srows-title');
        tt.textContent = t('All cities');
        box.appendChild(tt);
        const table = el('div', 'city-table');
        table.innerHTML = `<span>${t('City')}</span><span>${t('People')}</span><span>${t('Money')}</span><span>${t('Happiness')}</span><span>${t('Net')}</span>`;
        for (const c of s.cityList) {
          for (const [i, v] of [c.name, num(c.pop), `$${short(c.money)}`, `${Math.round(c.happiness)}%`, `${sign(c.net)}$${num(Math.abs(c.net))}`].entries()) {
            const cell = el('span', i === 0 && c.active ? 'active' : i === 4 ? (c.net >= 0 ? 'pos' : 'neg') : '');
            cell.textContent = v;
            table.appendChild(cell);
          }
        }
        box.appendChild(table);
        this.body.appendChild(box);
        this.bars(t('City services'), s.services.map(([k, n], i) => [t(k), n, [C.blue, C.green, C.amber, C.red, C.violet, C.pink, C.brown, C.gray][i % 8]] as [string, number, string]));
        this.rows(t('Services in {city}', { city: s.cityName }), s.services.map(([k, n]) => [t(k), num(n), n > 0] as [string, string, boolean]));
        break;
      }
      case 'traffic': {
        this.kpis([
          [t('Cars driving'), num(s.traffic.cars), t('{n} parked', { n: s.traffic.parked })],
          [t('Pedestrians'), num(s.traffic.walkers), t('walking now')],
          [t('Trucks'), num(s.traffic.trucks), ''],
          [t('Traffic lights'), num(s.roads.signals), t('junctions')],
        ]);
        chart(t('On the move'), [
          { label: t('Cars'), color: C.blue, values: series('cars') },
          { label: t('Walkers'), color: C.green, values: series('walkers') },
        ]);
        this.rows(t('Network'), [
          [t('Road tiles'), num(s.roads.total)],
          [t('Bridges'), num(s.roads.bridges)],
          [t('Roundabouts'), num(s.roads.roundabouts)],
          [t('Footpaths'), num(s.roads.footpaths)],
          [t('Canals'), num(s.roads.canals)],
        ]);
        break;
      }
      case 'nature': {
        this.kpis([
          [t('Cows'), num(s.animals.cows), t('{n} herds', { n: s.animals.herds })],
          [t('Sheep'), num(s.animals.sheep), ''],
          [t('Trees'), num(s.trees), t('felled trees regrow')],
          [t('Ranches'), num(s.buildings.ranch ?? 0), t('cattle for food')],
        ]);
        this.bars(t('Wild animals'), [[t('Cows'), s.animals.cows, C.amber], [t('Sheep'), s.animals.sheep, '#e8e4da']]);
        chart(t('Animals'), [{ label: t('Animals'), color: C.green, values: series('animals') }]);
        break;
      }
    }
    for (const sec of s.pages[this.tab] ?? []) {
      if (sec.kpis) { if (sec.title) this.heading(sec.title); this.kpis(sec.kpis); }
      if (sec.bars?.length) this.bars(sec.kpis ? '' : sec.title, sec.bars);
      if (sec.rows?.length) this.rows(sec.kpis || sec.bars?.length ? '' : sec.title, sec.rows);
      if (sec.note) { const n = el('div', 'snote'); n.textContent = sec.note; this.body.appendChild(n); }
    }
    this.body.scrollTop = scroll;
    requestAnimationFrame(() => { if (this.visible && scroll > 0) this.body.scrollTop = scroll; });
    charts.forEach(([c, ser, f]) => drawChart(c, ser, f));
  }

  private notes(s: StatsSnapshot) {
    const out: [string, boolean][] = [];
    if (s.money < 0) out.push([t('The treasury is in debt — 8 months of debt means bankruptcy!'), false]);
    if (s.powered < 0.8) out.push([t('Power shortage — power plants need workers, wood and a road link'), false]);
    if (s.wood < 15) out.push([t('Wood is running out — build woodcutters near forests'), false]);
    if (s.food < s.population * 2) out.push([t('Food is low — people will starve. Build and irrigate farms'), false]);
    if (s.water < 0.99) out.push([t('Not enough drinking water — build a water tower'), false]);
    if (!s.freeHomes) out.push([t('No free homes — build houses so families can grow'), false]);
    if (!s.hasHall) out.push([t('No Wedding Hall — young people cannot marry'), false]);
    if (!s.schoolSeats && s.people.boys + s.people.girls > 0) out.push([t('Children have no school'), false]);
    if (!out.length) out.push([t('Everything runs smoothly — new families keep arriving'), true]);
    for (const [tx, good] of out) {
      const n = el('div', `snote ${good ? 'pos' : 'neg'}`);
      n.textContent = tx;
      this.body.appendChild(n);
    }
  }

  private heading(text: string) {
    const h = el('div', 'stats-h');
    h.textContent = text;
    this.body.appendChild(h);
  }

  private kpis(items: [string, string, string, boolean?][]) {
    const grid = el('div', 'kpis');
    for (const [label, value, sub, good] of items) {
      const k = el('div', 'kpi');
      k.innerHTML = `<small>${label}</small><b>${value}</b>${sub ? `<span class="${good === false ? 'neg' : good ? 'pos' : ''}">${sub}</span>` : ''}`;
      grid.appendChild(k);
    }
    this.body.appendChild(grid);
  }

  private rows(title: string, rows: [string, string, boolean?][]) {
    const box = el('div', 'srows');
    const tt = el('div', 'srows-title');
    tt.textContent = title;
    if (title) box.appendChild(tt);
    for (const [k, v, good] of rows) {
      const r = el('div', 'info-row');
      r.innerHTML = `<span>${k}</span><span class="${good === undefined ? '' : good ? 'pos' : 'neg'}">${v}</span>`;
      box.appendChild(r);
    }
    this.body.appendChild(box);
  }

  private bars(title: string, items: [string, number, string][]) {
    const total = Math.max(1, items.reduce((a, b) => a + b[1], 0));
    const box = el('div', 'srows');
    const tt = el('div', 'srows-title');
    tt.textContent = title;
    if (!title) tt.style.display = 'none';
    const bar = el('div', 'stack');
    const legend = el('div', 'stack-legend');
    for (const [label, v, color] of items) {
      const seg = el('i', '');
      seg.style.width = `${(v / total) * 100}%`;
      seg.style.background = color;
      bar.appendChild(seg);
      const l = el('span', '');
      l.innerHTML = `<i style="background:${color}"></i>${label} <b>${num(v)}</b>`;
      legend.appendChild(l);
    }
    box.append(tt, bar, legend);
    this.body.appendChild(box);
  }
}

const num = (n: number) => Math.round(n).toLocaleString('en-US');
const pct = (n: number) => `${Math.round(n * 100)}%`;
const sign = (n: number) => (n >= 0 ? '+' : '−');
const short = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n)}`);
