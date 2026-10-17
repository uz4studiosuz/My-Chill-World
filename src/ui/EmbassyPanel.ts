import { el, icon } from './dom';
import { t } from '../i18n/i18n';

export interface EmbassyTown {
  id: number;
  name: string;
  tint: string;
  people: number;
  money: number;
  happiness: number;
  relation: number;
  friendship: string;
  style?: string;
  /** Building kinds the town wants now, with the reason (they agree to these more readily). */
  wants: string[];
  why: Record<string, string>;
  /** Chance they say yes to each kind (0..1). */
  chance: Record<string, number>;
  /** Why they would refuse everything now (relations too low), or ''. */
  blocked: string;
  joint: { id: number; kind: string; name: string; building: boolean; profit: number; workers: string }[];
  contracts: number;
}

export interface EmbassyOption { kind: string; name: string; half: number; cat: string; jobs: number }

/** One of our buildings abroad (a joint project or shares) with what it brought us and its town. */
export interface EmbassyHolding {
  id: number; kind: string; name: string; town: string; townId: number; tint: string;
  type: 'joint' | 'share'; pct: number; building: boolean; workers: number; jobs: number;
  yUs: number; yThem: number; yNote: string; mUs: number; mThem: number; totalUs: number; totalThem: number; paid: number;
  /** What it brought us on each of the last 14 days. */
  spark: number[];
}

export interface EmbassyShare { id: number; kind: string; name: string; held: number; price: number; profit: number }

export interface EmbassyData {
  towns: EmbassyTown[]; options: EmbassyOption[]; money: number; total: number;
  holdings: EmbassyHolding[];
  /** The last 30 days: what all our buildings abroad brought us and their towns. */
  days: { d: number; us: number; them: number }[];
  /** Businesses of each neighbour that sell shares. */
  shares: Record<number, EmbassyShare[]>;
  dateOf: (d: number) => string;
}

export interface EmbassyHost {
  data(): EmbassyData;
  /** full: we pay it all and take 75% of the profit (else half and 50%). */
  propose(town: number, kind: string, full: boolean): void;
  gift(town: number, money: number): void;
  trade(): void;
  show(buildingId: number): void;
  buyShare(buildingId: number): void;
}

const CATS: [string, string][] = [['business', 'Business'], ['production', 'Industry'], ['services', 'Services'], ['buildings', 'Town']];
type Tab = 'overview' | 'ours' | 'towns';
const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

/**
 * The embassy: everything about our dealings abroad in one wide window.
 * Overview — what our buildings in the neighbour towns bring us and them, day by day, and how much has come back.
 * Our buildings — every joint project and share with its earnings, its last two weeks and a button to find it.
 * Towns — each neighbour: friendship, gifts, a joint project to propose, and businesses that sell shares.
 */
export class EmbassyPanel {
  private root: HTMLDivElement;
  visible = false;
  private tab: Tab = 'towns';
  /** Pay the whole building (75% of the profit) instead of half (50%). */
  private full = false;
  private town = -1;
  private cat = 'business';
  private last = '';

  constructor(parent: HTMLElement, private host: EmbassyHost, private thumbs: Map<string, string>) {
    this.root = el('div', 'embassy');
    parent.appendChild(this.root);
  }

  open() { this.visible = true; this.root.classList.add('show'); this.last = ''; this.render(); }
  hide() { this.visible = false; this.root.classList.remove('show'); }
  toggle() { if (this.visible) this.hide(); else this.open(); }

  render() {
    if (!this.visible) return;
    const d = this.host.data();
    const key = JSON.stringify([d.towns, d.holdings, d.days, d.shares, d.money, this.tab, this.town, this.cat, this.full]);
    if (key === this.last) return;
    this.last = key;
    if (!d.towns.some((x) => x.id === this.town)) this.town = d.towns[0]?.id ?? -1;
    const keep = ['.emb-main', '.emb-tbody', '.emb-towns'].map((s) => [s, (this.root.querySelector(s) as HTMLElement | null)?.scrollTop ?? 0] as [string, number]);
    this.root.replaceChildren();
    const head = el('div', 'emb-head');
    head.innerHTML = `<span class="emb-ic">${icon('globe')}</span><div><b></b><small></small></div>`;
    (head.querySelector('b') as HTMLElement).textContent = t('Embassy');
    (head.querySelector('small') as HTMLElement).textContent = t('Our business with the neighbour towns: joint projects, shares, friendship and gifts');
    const x = el('button', 'info-x');
    x.innerHTML = icon('close');
    x.setAttribute('aria-label', t('Close'));
    x.addEventListener('click', () => this.hide());
    head.appendChild(x);
    const tabs = el('div', 'emb-tabs');
    for (const [id, label, n] of [['overview', '📊 ' + t('Overview'), ''], ['ours', '🏳️ ' + t('Our buildings abroad'), `${d.holdings.length}`], ['towns', '🤝 ' + t('Towns and new projects'), `${d.towns.length}`]] as [Tab, string, string][]) {
      const b = el('button', `emb-tab${this.tab === id ? ' on' : ''}`);
      b.innerHTML = '<span></span><em></em>';
      (b.querySelector('span') as HTMLElement).textContent = label;
      (b.querySelector('em') as HTMLElement).textContent = n;
      b.addEventListener('click', () => { this.tab = id; this.render(); });
      tabs.appendChild(b);
    }
    const main = el('div', `emb-main${this.tab === 'towns' ? ' towns-tab' : ''}`);
    if (this.tab === 'overview') this.overview(main, d);
    else if (this.tab === 'ours') this.ours(main, d);
    else this.towns(main, d);
    this.root.append(head, tabs, main);
    for (const [s, top] of keep) { const e = this.root.querySelector(s) as HTMLElement | null; if (e) e.scrollTop = top; }
  }

  // ---------- overview ----------

  private overview(main: HTMLElement, d: EmbassyData) {
    const H = d.holdings;
    const yUs = H.reduce((a, h) => a + h.yUs, 0), yThem = H.reduce((a, h) => a + h.yThem, 0);
    const mUs = d.days.reduce((a, x) => a + x.us, 0), mThem = d.days.reduce((a, x) => a + x.them, 0);
    const totUs = H.reduce((a, h) => a + h.totalUs, 0), paid = H.reduce((a, h) => a + h.paid, 0);
    const kpis = el('div', 'emb-kpi-row');
    const k = (label: string, value: string, sub: string, tone?: 'pos' | 'neg' | 'gold') => {
      const c = el('div', `emb-big ${tone ?? ''}`);
      c.innerHTML = '<small></small><b></b><span></span>';
      (c.querySelector('small') as HTMLElement).textContent = label;
      (c.querySelector('b') as HTMLElement).textContent = value;
      (c.querySelector('span') as HTMLElement).textContent = sub;
      kpis.appendChild(c);
    };
    k(t('Buildings abroad'), `${H.length}`, t('{a} joint · {b} with our shares', { a: H.filter((h) => h.type === 'joint').length, b: H.filter((h) => h.type === 'share').length }));
    k(t('To us yesterday'), money(yUs), t('they kept {m}', { m: money(yThem) }), yUs > 0 ? 'pos' : undefined);
    k(t('To us in 30 days'), money(mUs), t('{m} a day on average', { m: money(mUs / 30) }), mUs > 0 ? 'pos' : undefined);
    k(t('To them in 30 days'), money(mThem), t('wages, taxes and their share of the profit'));
    k(t('Put in'), money(paid), t('back so far: {m}', { m: money(totUs) }));
    k(t('Paid back'), paid ? `${Math.round((totUs / paid) * 100)}%` : '—', paid && totUs >= paid ? t('already in profit!') : t('of what we put in'), paid && totUs >= paid ? 'gold' : undefined);
    main.appendChild(kpis);
    if (!H.length) {
      const e = el('div', 'emb-empty');
      e.innerHTML = '<b></b><p></p>';
      (e.querySelector('b') as HTMLElement).textContent = t('No buildings abroad yet');
      (e.querySelector('p') as HTMLElement).textContent = t('Open "Towns and new projects": propose a joint project (you pay half, they build and staff it, the profit is shared), or buy shares in one of their businesses. Their earnings will show here day by day.');
      const b = el('button', 'btn-mini');
      b.textContent = t('Find a project');
      b.addEventListener('click', () => { this.tab = 'towns'; this.render(); });
      e.appendChild(b);
      main.appendChild(e);
      return;
    }
    // the last 30 days: us (gold) and them (blue)
    this.sec(main, t('The last 30 days'), t('every day: what our buildings abroad brought us and their towns'));
    const chart = el('div', 'emb-chart');
    const max = Math.max(1, ...d.days.map((x) => Math.max(x.us, x.them)));
    for (const x of d.days) {
      const col = el('div', 'emb-col');
      col.title = `${d.dateOf(x.d)} · ${t('to us')} ${money(x.us)} · ${t('to them')} ${money(x.them)}`;
      col.innerHTML = '<i class="us"></i><i class="them"></i>';
      (col.querySelector('.us') as HTMLElement).style.height = `${(x.us / max) * 100}%`;
      (col.querySelector('.them') as HTMLElement).style.height = `${(x.them / max) * 100}%`;
      chart.appendChild(col);
    }
    main.appendChild(chart);
    const lg = el('div', 'emb-legend');
    lg.innerHTML = `<span><i class="us"></i>${t('to us')}</span><span><i class="them"></i>${t('to them')}</span>`;
    main.appendChild(lg);
    // by town
    this.sec(main, t('By town'), '');
    const tbl = el('div', 'emb-table');
    const hdr = el('div', 'emb-tr head');
    for (const c of [t('Town'), t('Buildings'), t('To us (30 days)'), t('To them (30 days)'), t('Relations')]) { const s = el('span', ''); s.textContent = c; hdr.appendChild(s); }
    tbl.appendChild(hdr);
    for (const tw of d.towns) {
      const hs = H.filter((h) => h.townId === tw.id);
      const r = el('button', 'emb-tr');
      r.innerHTML = '<span><i></i><b></b></span><span></span><span class="pos"></span><span></span><span></span>';
      (r.querySelector('i') as HTMLElement).style.background = tw.tint;
      (r.querySelector('b') as HTMLElement).textContent = tw.name;
      const cells = r.querySelectorAll(':scope > span');
      cells[1].textContent = `${hs.length}`;
      cells[2].textContent = money(hs.reduce((a, h) => a + h.mUs, 0));
      cells[3].textContent = money(hs.reduce((a, h) => a + h.mThem, 0));
      cells[4].textContent = `${Math.round(tw.relation)}/100 · ${t(tw.friendship)}`;
      r.addEventListener('click', () => { this.town = tw.id; this.tab = 'towns'; this.render(); });
      tbl.appendChild(r);
    }
    main.appendChild(tbl);
    // the best earners
    this.sec(main, t('Best earners'), t('in the last 30 days'));
    const best = [...H].sort((a, b) => b.mUs - a.mUs).slice(0, 5);
    const bl = el('div', 'emb-hold-list');
    for (const h of best) bl.appendChild(this.holdingCard(h, true));
    main.appendChild(bl);
  }

  // ---------- our buildings ----------

  private ours(main: HTMLElement, d: EmbassyData) {
    if (!d.holdings.length) { this.overview(main, d); return; }
    const tip = el('div', 'emb-tip');
    tip.textContent = t('On the map they carry a little flag in our colour. Tap "Show" to fly there.');
    main.appendChild(tip);
    for (const tw of d.towns) {
      const hs = d.holdings.filter((h) => h.townId === tw.id);
      if (!hs.length) continue;
      this.sec(main, tw.name, t('{n} buildings · {m} to us in 30 days', { n: hs.length, m: money(hs.reduce((a, h) => a + h.mUs, 0)) }), tw.tint);
      const list = el('div', 'emb-hold-list');
      for (const h of hs.sort((a, b) => b.mUs - a.mUs)) list.appendChild(this.holdingCard(h));
      main.appendChild(list);
    }
  }

  private holdingCard(h: EmbassyHolding, compact = false) {
    const c = el('div', `emb-hold${h.building ? ' wip' : ''}`);
    c.style.borderLeftColor = h.tint;
    const th = this.thumbs.get(h.kind);
    c.innerHTML = `<i class="emb-th"></i><div class="emb-hinfo"><b></b><small></small><span class="emb-badges"></span></div><div class="emb-hnums"></div><div class="emb-spark"></div><div class="emb-hact"></div>`;
    if (th) (c.querySelector('.emb-th') as HTMLElement).style.backgroundImage = `url(${th})`;
    (c.querySelector('b') as HTMLElement).textContent = h.name;
    (c.querySelector('small') as HTMLElement).textContent = `${h.town} · ${h.building ? t('being built') : h.workers ? t('{a}/{b} at work', { a: h.workers, b: h.jobs }) : t('no workers yet')}`;
    const badges = c.querySelector('.emb-badges') as HTMLElement;
    const badge = (text: string, cls: string) => { const s = el('span', `emb-badge ${cls}`); s.textContent = text; badges.appendChild(s); };
    badge(h.type === 'joint' ? t('Built with them · {n}% ours', { n: Math.round(h.pct * 100) }) : t('Our shares · {n}%', { n: Math.round(h.pct * 100) }), h.type);
    if (h.paid && h.totalUs >= h.paid) badge(t('Paid back ✓'), 'gold');
    const nums = c.querySelector('.emb-hnums') as HTMLElement;
    const num = (label: string, value: string, cls = '') => { const s = el('div', `emb-num ${cls}`); s.innerHTML = '<small></small><b></b>'; (s.querySelector('small') as HTMLElement).textContent = label; (s.querySelector('b') as HTMLElement).textContent = value; nums.appendChild(s); };
    num(t('Yesterday to us'), money(h.yUs), h.yUs > 0 ? 'pos' : '');
    num(t('to them'), money(h.yThem));
    if (!compact) { num(t('30 days to us'), money(h.mUs), h.mUs > 0 ? 'pos' : ''); num(t('All time to us'), money(h.totalUs)); }
    // payback: how much of what we put in has come back
    if (h.paid) {
      const p = Math.min(1, h.totalUs / h.paid);
      const pb = el('div', 'emb-payback');
      pb.innerHTML = '<div><i></i></div><small></small>';
      (pb.querySelector('i') as HTMLElement).style.width = `${Math.round(p * 100)}%`;
      (pb.querySelector('small') as HTMLElement).textContent = t('{p}% of the {m} we put in has come back', { p: Math.round((h.totalUs / h.paid) * 100), m: money(h.paid) });
      nums.appendChild(pb);
    }
    if (h.yNote) { const n = el('div', 'emb-note'); n.textContent = t('Yesterday: {what}', { what: h.yNote }); nums.appendChild(n); }
    // the last two weeks
    const sp = c.querySelector('.emb-spark') as HTMLElement;
    const max = Math.max(1, ...h.spark);
    for (const v of h.spark) { const i = el('i', ''); i.style.height = `${Math.max(4, (v / max) * 100)}%`; if (!v) i.classList.add('zero'); sp.appendChild(i); }
    sp.title = t('What it brought us on each of the last 14 days');
    const act = c.querySelector('.emb-hact') as HTMLElement;
    const show = el('button', 'btn-mini ghost');
    show.textContent = t('Show');
    show.addEventListener('click', () => this.host.show(h.id));
    act.appendChild(show);
    if (h.type === 'share' && h.pct < 0.49) {
      const more = el('button', 'btn-mini');
      more.textContent = t('+10%');
      more.title = t('Buy 10% more');
      more.addEventListener('click', () => this.host.buyShare(h.id));
      act.appendChild(more);
    }
    return c;
  }

  // ---------- towns ----------

  private towns(main: HTMLElement, d: EmbassyData) {
    const wrap = el('div', 'emb-wrap');
    const side = el('div', 'emb-towns');
    for (const tw of d.towns) {
      const n = d.holdings.filter((h) => h.townId === tw.id).length;
      const b = el('button', `emb-town${tw.id === this.town ? ' active' : ''}`);
      b.innerHTML = '<i></i><div><b></b><small></small><span class="emb-rel"><em></em></span></div>';
      (b.querySelector('i') as HTMLElement).style.background = tw.tint;
      (b.querySelector('b') as HTMLElement).textContent = tw.name;
      (b.querySelector('small') as HTMLElement).textContent = `${t(tw.friendship)} · ${t('{n} of ours', { n })}`;
      const em = b.querySelector('em') as HTMLElement;
      em.style.width = `${Math.round(tw.relation)}%`;
      em.style.background = tw.relation >= 50 ? '#7be08f' : tw.relation >= 30 ? '#f2b33d' : '#ff7a6e';
      b.addEventListener('click', () => { this.town = tw.id; this.render(); });
      side.appendChild(b);
    }
    if (!d.towns.length) { const e = el('div', 'rp-note'); e.textContent = t('No neighbour towns yet.'); side.appendChild(e); }
    const body = el('div', 'emb-tbody');
    const tw = d.towns.find((x) => x.id === this.town);
    if (tw) this.townView(body, tw, d);
    wrap.append(side, body);
    main.appendChild(wrap);
  }

  private sec(main: HTMLElement, title: string, sub: string, tint?: string) {
    const s = el('div', 'emb-sec');
    s.innerHTML = '<i></i><b></b><small></small>';
    if (tint) (s.querySelector('i') as HTMLElement).style.background = tint; else (s.querySelector('i') as HTMLElement).remove();
    (s.querySelector('b') as HTMLElement).textContent = title;
    (s.querySelector('small') as HTMLElement).textContent = sub;
    main.appendChild(s);
  }

  private townView(main: HTMLElement, tw: EmbassyTown, d: EmbassyData) {
    // the town at a glance
    const card = el('div', 'emb-card');
    card.style.borderColor = tw.tint;
    card.innerHTML = `<div class="emb-flag"></div><div class="emb-title"><b></b><small></small></div><div class="emb-kpis"></div>`;
    (card.querySelector('.emb-flag') as HTMLElement).style.background = tw.tint;
    (card.querySelector('b') as HTMLElement).textContent = tw.name;
    (card.querySelector('small') as HTMLElement).textContent = `${t(tw.style ?? 'Autonomous town')} · ${t(tw.friendship)}`;
    const kp = card.querySelector('.emb-kpis') as HTMLElement;
    const hs = d.holdings.filter((h) => h.townId === tw.id);
    for (const [k, v, tone] of [[t('Relations'), `${Math.round(tw.relation)}/100`, tw.relation >= 50], [t('People'), tw.people.toLocaleString('en-US')], [t('Treasury'), money(tw.money)],
      [t('Happiness'), `${Math.round(tw.happiness)}%`], [t('Our buildings'), `${hs.length}`], [t('To us (30 days)'), money(hs.reduce((a, h) => a + h.mUs, 0)), true], [t('Contracts'), `${tw.contracts}`]] as [string, string, boolean?][]) {
      const c = el('div', 'emb-kpi');
      c.innerHTML = '<small></small><b></b>';
      (c.querySelector('small') as HTMLElement).textContent = k;
      const vb = c.querySelector('b') as HTMLElement;
      vb.textContent = v;
      if (tone !== undefined) vb.className = tone ? 'pos' : 'neg';
      kp.appendChild(c);
    }
    main.appendChild(card);
    const acts = el('div', 'emb-acts');
    const mk = (label: string, fn: () => void, cls = 'btn-mini') => { const b = el('button', cls); b.textContent = label; b.addEventListener('click', fn); acts.appendChild(b); };
    mk(`🎁 ${t('Gift')} $500`, () => this.host.gift(tw.id, 500));
    mk(`🎁 ${t('Gift')} $2,000`, () => this.host.gift(tw.id, 2000));
    mk(`📜 ${t('Trade and contracts')}`, () => this.host.trade(), 'btn-mini ghost');
    main.appendChild(acts);
    const hint = el('div', 'emb-tip');
    hint.textContent = tw.relation >= 50 ? t('Friends: they say yes to most projects.') : tw.relation >= 30 ? t('They are neutral: gifts and trade make them friendlier, so they agree more often.') : t('They do not trust you yet: a gift or some trade first.');
    main.appendChild(hint);
    // two ways to invest
    this.sec(main, t('Way 1 · Build it for them'), t('they build it on their land and staff it with their people; we pay half or all of it and take that share of the profit'));
    const how = el('div', 'emb-how');
    [['1', t('Pick a workplace'), t('★ = they want it: they almost always agree')], ['2', t('They decide'), t('the % on the card is their yes')],
      ['3', t('They build it'), t('on their land, with their builders')], ['4', t('Profit shared'), t('our share of the profit (or of what it makes) comes every day')]].forEach(([n, a, b]) => {
      const s = el('div', 'emb-step');
      s.innerHTML = '<span></span><div><b></b><small></small></div>';
      (s.querySelector('span') as HTMLElement).textContent = n;
      (s.querySelector('b') as HTMLElement).textContent = a;
      (s.querySelector('small') as HTMLElement).textContent = b;
      how.appendChild(s);
    });
    main.appendChild(how);
    if (tw.blocked) { const w = el('div', 'emb-warn'); w.textContent = tw.blocked; main.appendChild(w); }
    const tabs = el('div', 'trade-towns');
    for (const [id, label] of CATS) {
      const b = el('button', `trade-town${this.cat === id ? ' active' : ''}`);
      b.textContent = t(label);
      b.addEventListener('click', () => { this.cat = id; this.render(); });
      tabs.appendChild(b);
    }
    main.appendChild(tabs);
    // how much we pay: half (50% of the profit) or all of it (75%, and they agree more readily)
    const pay = el('div', 'emb-pay');
    for (const [full, label, sub] of [[false, t('We pay half'), t('50% of the profit is ours')], [true, t('We pay it all'), t('75% of the profit is ours · they say yes more often')]] as [boolean, string, string][]) {
      const b = el('button', `emb-payopt${this.full === full ? ' on' : ''}`);
      b.innerHTML = '<b></b><small></small>';
      (b.querySelector('b') as HTMLElement).textContent = label;
      (b.querySelector('small') as HTMLElement).textContent = sub;
      b.addEventListener('click', () => { this.full = full; this.render(); });
      pay.appendChild(b);
    }
    main.appendChild(pay);
    const grid = el('div', 'emb-grid');
    const list = d.options.filter((o) => o.cat === this.cat).sort((a, b) => Number(tw.wants.includes(b.kind)) - Number(tw.wants.includes(a.kind)) || a.half - b.half);
    for (const o of list) {
      const want = tw.wants.includes(o.kind);
      const b = el('button', `emb-opt${want ? ' want' : ''}`);
      const th = this.thumbs.get(o.kind);
      b.innerHTML = `<i></i><b></b><small></small><span class="emb-why"></span><div class="emb-yes"><i></i><span></span></div><em></em>`;
      if (th) (b.querySelector('i') as HTMLElement).style.backgroundImage = `url(${th})`;
      (b.querySelector('b') as HTMLElement).textContent = o.name;
      (b.querySelector('small') as HTMLElement).textContent = `${t('you pay')} ${money(this.full ? o.half * 2 : o.half)} · ${t('{n} jobs for them', { n: o.jobs })}`;
      (b.querySelector('em') as HTMLElement).textContent = want ? `★ ${t('they want it')}` : '';
      (b.querySelector('.emb-why') as HTMLElement).textContent = tw.why[o.kind] ?? '';
      const ch = Math.round(Math.min(1, (tw.chance[o.kind] ?? 0) + (this.full ? 0.15 : 0)) * 100);
      const bar = b.querySelector('.emb-yes i') as HTMLElement;
      bar.style.width = `${ch}%`;
      bar.style.background = ch >= 70 ? '#7be08f' : ch >= 40 ? '#f2b33d' : '#ff7a6e';
      (b.querySelector('.emb-yes span') as HTMLElement).textContent = t('{n}% yes', { n: ch });
      b.addEventListener('click', () => this.host.propose(tw.id, o.kind, this.full));
      grid.appendChild(b);
    }
    main.appendChild(grid);
    // shares in their businesses
    this.sec(main, t('Way 2 · Buy shares'), t('10% at a time (up to 49%): every day that share of the business\'s profit is ours'));
    const sh = d.shares[tw.id] ?? [];
    if (!sh.length) { const e = el('div', 'rp-note'); e.textContent = t('They have no shops or businesses to buy into yet — build one for them above (Way 1).'); main.appendChild(e); }
    const sl = el('div', 'emb-share-list');
    for (const s of sh) {
      const r = el('div', `emb-share${s.held ? ' held' : ''}`);
      const th = this.thumbs.get(s.kind);
      r.innerHTML = '<i class="emb-th"></i><div><b></b><small></small></div><span></span>';
      if (th) (r.querySelector('.emb-th') as HTMLElement).style.backgroundImage = `url(${th})`;
      (r.querySelector('b') as HTMLElement).textContent = s.name;
      (r.querySelector('small') as HTMLElement).textContent = `${t('profit yesterday')} ${money(s.profit)} · ${t('10% would bring about {m}/day', { m: money(s.profit * 0.1) })}${s.held ? ` · ${t('ours: {n}%', { n: Math.round(s.held * 100) })}` : ''}`;
      const act = r.querySelector('span') as HTMLElement;
      if (s.held < 0.49) {
        const b = el('button', 'btn-mini');
        b.textContent = t('Buy 10% · ${n}', { n: s.price.toLocaleString('en-US') });
        b.addEventListener('click', () => this.host.buyShare(s.id));
        act.appendChild(b);
      } else act.textContent = '49%';
      sl.appendChild(r);
    }
    main.appendChild(sl);
  }
}
