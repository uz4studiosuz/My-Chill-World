import { dateLabel } from '../sim/Calendar';
import { el, icon } from './dom';
import { t } from '../i18n/i18n';
import { drawChart } from './Chart';

/** One town as the World window shows it. */
export interface WorldTown {
  id: number;
  name: string;
  tint: string;
  mine: boolean;
  /** Mayor's character (autonomous towns), as an English key. */
  style?: string;
  mood: string;
  people: number;
  growth: number;
  money: number;
  happiness: number;
  tax: number;
  loan: number;
  buildings: number;
  jobs: string;
  homes: number;
  millionaires: number;
  richest: { name: string; money: number }[];
  relation?: number;
  news: { day: number; text: string }[];
  /** Stock of goods: label, amount. */
  res: [string, number][];
  /** Day by day: people, treasury, happiness (oldest first). */
  history: { day: number; pop: number; money: number; happy: number }[];
  /** Everything that happened between this town and yours: deals, gifts, letters (newest first). */
  dealings: { day: number; text: string; money: number }[];
}

const MOOD: Record<string, [string, string]> = {
  boom: ['Boom', '#7be08f'], growing: ['Growing', '#a8d86a'], stable: ['Stable', '#aab4be'], shrinking: ['Shrinking', '#f2b33d'], crisis: ['Crisis', '#ff6b5e'],
};
const num = (n: number) => Math.round(n).toLocaleString('en-US');
const short = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n)}`);

/**
 * The World window: every town on the map side by side (people, money, happiness over time), then each town in
 * detail — its mayor, its goods, its richest families, what you did together and its own news.
 */
export class WorldPanel {
  private root: HTMLDivElement;
  visible = false;
  private open = new Set<number>();
  private tab: 'all' | number = 'all';
  private last = '';

  constructor(parent: HTMLElement, private get: () => WorldTown[], private show: (id: number) => void, private trade: () => void,
    private buildFor: (id: number) => void = () => {}, private active: () => number = () => -1, private report: (id: number) => void = () => {}) {
    this.root = el('div', 'stats world-panel');
    parent.appendChild(this.root);
  }

  toggle() { if (this.visible) this.hide(); else { this.visible = true; this.root.classList.add('show'); this.render(); } }
  hide() { this.visible = false; this.root.classList.remove('show'); }

  render() {
    if (!this.visible) return;
    const towns = this.get();
    const key = `${String(this.tab)}|${[...this.open].join(',')}|${JSON.stringify(towns)}`;
    if (key === this.last) return;
    this.last = key;
    if (this.tab !== 'all' && !towns.some((x) => x.id === this.tab)) this.tab = 'all';
    const oldBody = this.root.querySelector('.stats-body');
    const scroll = oldBody?.scrollTop ?? 0;
    this.root.replaceChildren();
    const head = el('div', 'stats-head');
    const title = el('b', '');
    title.textContent = `${t('World')} · ${t('{n} towns', { n: towns.length })} · ${t('{n} people in all', { n: towns.reduce((a, x) => a + x.people, 0) })}`;
    const x = el('button', 'info-x');
    x.innerHTML = icon('close');
    x.setAttribute('aria-label', t('Close'));
    x.addEventListener('click', () => this.hide());
    head.append(title, x);
    // tabs: all towns, then one per town
    const tabs = el('div', 'stats-tabs');
    const tabBtn = (id: 'all' | number, label: string, tint?: string) => {
      const b = el('button', `stab${this.tab === id ? ' active' : ''}`);
      b.innerHTML = tint ? `<i class="wt-dot" style="background:${tint}"></i><span></span>` : `${icon('globe')}<span></span>`;
      (b.querySelector('span') as HTMLElement).textContent = label;
      b.addEventListener('click', () => { this.tab = id; this.render(); });
      tabs.appendChild(b);
    };
    tabBtn('all', t('All towns'));
    for (const tw of towns) tabBtn(tw.id, tw.name, tw.tint);
    const body = el('div', 'stats-body');
    const charts: (() => void)[] = [];
    if (this.tab === 'all') this.overview(body, towns, charts);
    else this.town(body, towns.find((tw) => tw.id === this.tab)!, charts);
    this.root.append(head, tabs, body);
    body.scrollTop = scroll;
    charts.forEach((f) => f());
  }

  /** All towns side by side: a table, bars and the history of people and money. */
  private overview(body: HTMLElement, towns: WorldTown[], charts: (() => void)[]) {
    const help = el('div', 'snote');
    help.textContent = t('Neighbour towns run themselves: you cannot build on their land or change them. Trade with them, send gifts and answer their letters — friends pay more and sell cheaper.');
    body.appendChild(help);
    // ranking table
    const box = el('div', 'srows');
    box.style.gridColumn = '1 / -1';
    const tt = el('div', 'srows-title');
    tt.textContent = t('Towns compared');
    const table = el('div', 'wt-table');
    const cols = [t('Town'), t('People'), t('Last week'), t('Treasury'), t('Happiness'), t('Tax'), t('Homes'), t('Buildings'), t('Millionaires'), t('Relations')];
    for (const c of cols) { const h = el('span', 'wt-th'); h.textContent = c; table.appendChild(h); }
    for (const tw of towns) {
      const mood = MOOD[tw.mood] ?? MOOD.stable;
      const cells: [string, string?][] = [
        [tw.name], [num(tw.people)], [`${tw.growth >= 0 ? '+' : ''}${tw.growth}`, tw.growth > 0 ? 'pos' : tw.growth < 0 ? 'neg' : ''], [`$${short(tw.money)}`, tw.money < 0 ? 'neg' : ''],
        [`${Math.round(tw.happiness)}%`, tw.happiness >= 60 ? 'pos' : tw.happiness < 45 ? 'neg' : ''], [`${Math.round(tw.tax * 100)}%`], [`${tw.homes}`], [`${tw.buildings}`], [`${tw.millionaires}`],
        [tw.relation === undefined ? t('You') : `${Math.round(tw.relation)}`, tw.relation === undefined ? '' : tw.relation >= 50 ? 'pos' : tw.relation < 25 ? 'neg' : ''],
      ];
      cells.forEach(([v, cls], i) => {
        const c = el('span', `wt-td ${cls ?? ''}`);
        if (i === 0) {
          c.innerHTML = `<i class="wt-dot"></i><b></b><small></small>`;
          (c.querySelector('i') as HTMLElement).style.background = tw.tint;
          (c.querySelector('b') as HTMLElement).textContent = v;
          (c.querySelector('small') as HTMLElement).textContent = t(mood[0]);
          (c.querySelector('small') as HTMLElement).style.color = mood[1];
          c.classList.add('link');
          c.addEventListener('click', () => { this.tab = tw.id; this.render(); });
        } else c.textContent = v;
        table.appendChild(c);
      });
    }
    box.append(tt, table);
    body.appendChild(box);
    // bars: people and treasury
    const bars = (title: string, pick: (tw: WorldTown) => number, fmt: (n: number) => string) => {
      const b = el('div', 'srows');
      const h = el('div', 'srows-title');
      h.textContent = title;
      b.appendChild(h);
      const max = Math.max(1, ...towns.map((tw) => Math.abs(pick(tw))));
      for (const tw of towns) {
        const row = el('div', 'wt-bar');
        row.innerHTML = `<span></span><div><i></i></div><b></b>`;
        (row.querySelector('span') as HTMLElement).textContent = tw.name;
        const bar = row.querySelector('i') as HTMLElement;
        bar.style.width = `${Math.max(2, (Math.abs(pick(tw)) / max) * 100)}%`;
        bar.style.background = tw.tint;
        (row.querySelector('b') as HTMLElement).textContent = fmt(pick(tw));
        b.appendChild(row);
      }
      body.appendChild(b);
    };
    bars(t('People'), (tw) => tw.people, num);
    bars(t('Treasury'), (tw) => tw.money, (n) => `$${short(n)}`);
    // history charts: one line per town
    const chart = (title: string, pick: (h: WorldTown['history'][number]) => number, fmt: (n: number) => string) => {
      const b = el('div', 'chart');
      const h = el('div', 'chart-head');
      h.innerHTML = `<span></span><span class="legend"></span>`;
      (h.querySelector('span') as HTMLElement).textContent = title;
      (h.querySelector('.legend') as HTMLElement).innerHTML = towns.map((tw) => `<i style="background:${tw.tint}"></i>${tw.name}`).join(' ');
      const c = el('canvas', '') as HTMLCanvasElement;
      b.append(h, c);
      body.appendChild(b);
      charts.push(() => drawChart(c, towns.map((tw) => ({ label: tw.name, color: tw.tint, values: tw.history.map(pick) })), fmt));
    };
    chart(t('People'), (h) => h.pop, (n) => short(n));
    chart(t('Treasury'), (h) => h.money, (n) => `$${short(n)}`);
    chart(t('Happiness'), (h) => h.happy, (n) => `${Math.round(n)}%`);
  }

  /** One town in detail. */
  private town(body: HTMLElement, tw: WorldTown, charts: (() => void)[]) {
    const mood = MOOD[tw.mood] ?? MOOD.stable;
    const top = el('div', 'wt-card');
    top.style.gridColumn = '1 / -1';
    const head = el('div', 'wt-top');
    head.innerHTML = `<i class="nb-dot"></i><div class="wt-name"><b></b><small></small></div><span class="wt-mood"></span>`;
    (head.querySelector('.nb-dot') as HTMLElement).style.background = tw.tint;
    (head.querySelector('b') as HTMLElement).textContent = tw.name;
    (head.querySelector('small') as HTMLElement).textContent = tw.mine ? t('Your town') : t(tw.style ?? 'Autonomous town');
    const mb = head.querySelector('.wt-mood') as HTMLElement;
    mb.textContent = t(mood[0]);
    mb.style.background = mood[1];
    const grid = el('div', 'wt-grid');
    const stat = (label: string, value: string, tone?: 'good' | 'bad') => {
      const c = el('div', 'wt-stat');
      c.innerHTML = '<small></small><b></b>';
      (c.querySelector('small') as HTMLElement).textContent = label;
      const vb = c.querySelector('b') as HTMLElement;
      vb.textContent = value;
      if (tone) vb.className = tone === 'good' ? 'pos' : 'neg';
      grid.appendChild(c);
    };
    stat(t('People'), num(tw.people));
    stat(t('Last week'), `${tw.growth >= 0 ? '+' : ''}${tw.growth}`, tw.growth > 0 ? 'good' : tw.growth < 0 ? 'bad' : undefined);
    stat(t('Treasury'), `$${num(tw.money)}`, tw.money < 0 ? 'bad' : undefined);
    stat(t('Happiness'), `${Math.round(tw.happiness)}%`, tw.happiness >= 60 ? 'good' : tw.happiness < 45 ? 'bad' : undefined);
    stat(t('Tax'), `${Math.round(tw.tax * 100)}%`);
    stat(t('Loan'), tw.loan ? `$${num(tw.loan)}` : '—', tw.loan ? 'bad' : undefined);
    stat(t('Homes'), `${tw.homes}`);
    stat(t('Buildings'), `${tw.buildings}`);
    stat(t('Jobs'), tw.jobs);
    stat(t('Millionaires'), `${tw.millionaires}`, tw.millionaires ? 'good' : undefined);
    if (tw.relation !== undefined) stat(t('Relations'), `${Math.round(tw.relation)}/100`, tw.relation >= 50 ? 'good' : tw.relation < 25 ? 'bad' : undefined);
    const btns = el('div', 'wt-btns');
    const mk = (label: string, fn: () => void) => { const b = el('button', 'btn-mini ghost'); b.textContent = label; b.addEventListener('click', fn); return b; };
    btns.appendChild(mk(t('Show on the map'), () => this.show(tw.id)));
    btns.appendChild(mk(t('Full report'), () => this.report(tw.id)));
    if (!tw.mine) btns.appendChild(mk(t('Trade'), this.trade));
    if (tw.mine && this.get().filter((o) => o.mine).length > 1) {
      const on = this.active() === tw.id;
      const bb = mk(on ? `✓ ${t('Building here')}` : t('Build here'), () => this.buildFor(tw.id));
      bb.disabled = on;
      btns.appendChild(bb);
    }
    top.append(head, grid, btns);
    if (tw.richest.length) {
      const r = el('div', 'wt-rich');
      r.textContent = `${t('Richest')}: ${tw.richest.map((f) => `${f.name} $${num(f.money)}`).join(' · ')}`;
      top.appendChild(r);
    }
    body.appendChild(top);
    // goods in stock
    const goods = el('div', 'srows');
    const gt = el('div', 'srows-title');
    gt.textContent = t('Goods in stock');
    goods.appendChild(gt);
    const gmax = Math.max(1, ...tw.res.map(([, v]) => v));
    for (const [label, v] of tw.res) {
      const row = el('div', 'wt-bar');
      row.innerHTML = `<span></span><div><i></i></div><b></b>`;
      (row.querySelector('span') as HTMLElement).textContent = label;
      const bar = row.querySelector('i') as HTMLElement;
      bar.style.width = `${Math.max(1, (v / gmax) * 100)}%`;
      bar.style.background = tw.tint;
      (row.querySelector('b') as HTMLElement).textContent = num(v);
      goods.appendChild(row);
    }
    body.appendChild(goods);
    // dealings with you
    if (!tw.mine) {
      const d = el('div', 'srows');
      const dt = el('div', 'srows-title');
      const total = tw.dealings.reduce((a, x) => a + x.money, 0);
      dt.textContent = `${t('Dealings with you')} · ${total >= 0 ? '+' : '−'}$${num(Math.abs(total))}`;
      d.appendChild(dt);
      if (!tw.dealings.length) { const e = el('div', 'wt-empty'); e.textContent = t('No deals yet — open Trade to sell them what they need'); d.appendChild(e); }
      for (const n of tw.dealings.slice(0, 20)) {
        const line = el('div', 'info-row');
        line.innerHTML = '<span></span><span></span>';
        (line.children[0] as HTMLElement).textContent = `${dateLabel(n.day)} · ${n.text}`;
        const m = line.children[1] as HTMLElement;
        m.textContent = n.money ? `${n.money > 0 ? '+' : '−'}$${num(Math.abs(n.money))}` : '—';
        m.className = n.money > 0 ? 'pos' : n.money < 0 ? 'neg' : '';
        d.appendChild(line);
      }
      body.appendChild(d);
    }
    // history
    const chart = (title: string, color: string, pick: (h: WorldTown['history'][number]) => number, fmt: (n: number) => string) => {
      const b = el('div', 'chart');
      const h = el('div', 'chart-head');
      h.innerHTML = `<span></span>`;
      (h.querySelector('span') as HTMLElement).textContent = title;
      const c = el('canvas', '') as HTMLCanvasElement;
      b.append(h, c);
      body.appendChild(b);
      charts.push(() => drawChart(c, [{ label: title, color, values: tw.history.map(pick) }], fmt));
    };
    chart(t('People'), '#6fb6ff', (h) => h.pop, short);
    chart(t('Treasury'), '#f2b33d', (h) => h.money, (n) => `$${short(n)}`);
    chart(t('Happiness'), '#f28cb8', (h) => h.happy, (n) => `${Math.round(n)}%`);
    // the town's own news
    const news = el('div', 'srows');
    const nt = el('div', 'srows-title');
    nt.textContent = t('News');
    news.appendChild(nt);
    const shown = this.open.has(tw.id) ? tw.news : tw.news.slice(0, 8);
    for (const n of shown) {
      const line = el('div', 'info-row');
      line.innerHTML = '<span></span><span></span>';
      (line.children[0] as HTMLElement).textContent = n.text;
      (line.children[1] as HTMLElement).textContent = dateLabel(n.day);
      news.appendChild(line);
    }
    if (!tw.news.length) { const e = el('div', 'wt-empty'); e.textContent = tw.mine ? t('Your news is in the Chronicle') : t('Nothing has happened yet'); news.appendChild(e); }
    if (tw.news.length > 8) {
      const more = el('button', 'btn-mini ghost');
      more.textContent = this.open.has(tw.id) ? t('Less news') : t('All news');
      more.addEventListener('click', () => { if (this.open.has(tw.id)) this.open.delete(tw.id); else this.open.add(tw.id); this.render(); });
      news.appendChild(more);
    }
    body.appendChild(news);
  }
}
