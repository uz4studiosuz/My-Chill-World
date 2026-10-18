import { el, icon, hoverBusy } from './dom';
import { t } from '../i18n/i18n';
import { GOODS, GOOD_NAME, Good, Trade } from '../game/Trade';
import type { City } from '../sim/Economy';
import { drawChart } from './Chart';
import { goodIcon } from './GoodIcons';

export type TradeTab = 'market' | 'towns' | 'orders' | 'deals' | 'board';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** A small line of the last prices (green when rising, red when falling). */
function spark(v: number[], color: string) {
  if (v.length < 2) return '<svg class="xg-spark" viewBox="0 0 60 18"></svg>';
  const lo = Math.min(...v), hi = Math.max(...v), d = hi - lo || 1;
  const pts = v.map((x, i) => `${((i / (v.length - 1)) * 60).toFixed(1)},${(16 - ((x - lo) / d) * 14).toFixed(1)}`).join(' ');
  return `<svg class="xg-spark" viewBox="0 0 60 18" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
}

export interface TradeHost {
  city(): City;
  /** A train station or an airport links the town to the other regions. */
  linked(): boolean;
  sell(g: Good, n: number): void;
  buy(g: Good, n: number): void;
  /** Towns that run themselves: what they lack and what they have too much of. */
  neighbours(): Neighbour[];
  /** Cars: in your car markets, room left, prices; sell (export) or buy (import) one car. */
  cars(): { have: number; room: number; sell: number; buy: number; market: boolean };
  carDeal(selling: boolean): void;
  /** Sell cars to a neighbour town. */
  carsTo(id: number): void;
  deal(id: number, g: Good, n: number, selling: boolean): void;
  gift(id: number): void;
  /** Your town and the neighbour towns (for choosing whom to trade with). */
  towns(): { id: number; name: string; tint: string; mine: boolean }[];
  /** Daily price of a good in a town (oldest first, today last). */
  history(id: number, g: Good): number[];
  /** The latest deals with the neighbour towns (newest first; money + you got, − you paid). */
  deals(): { day: string; town: string; tint: string; text: string; money: number }[];
  /** Every other price in the town (cars, homes, bills, shops, wages). */
  priceSheet(): { title: string; rows: [string, string][] }[];
  /** Long deals: the active ones with a town, and making / ending one. */
  contracts(id: number): { good: Good; perDay: number; days: number; price: number; selling: boolean; missed: number }[];
  contract(id: number, g: Good, perDay: number, days: number, selling: boolean): void;
  /** Export orders from abroad (offers and those being delivered), the season and the economy. */
  orders(): { linked: boolean; list: { id: number; good: Good; amount: number; delivered: number; daysLeft: number; price: number; bonus: number; from: string; accepted: boolean; stock: number }[]; season: string; economy: string };
  orderAnswer(id: number, accept: boolean): void;
  endContract(id: number, g: Good): void;
}

export interface Neighbour { id: number; name: string; tint: string; people: number; money: number; relation: number; wants: { g: Good; price: number }[]; offers: { g: Good; price: number; have: number }[];
  /** Every good the town buys (its price rises when it has little) and sells (cheap when it has plenty). */
  buys: { g: Good; price: number; room: number }[]; sells: { g: Good; price: number; have: number }[]; carPrice?: number }

/** A button's tooltip (what the deal brings or costs). */
const tip = (b: HTMLButtonElement, text: string) => { if (text) b.title = text; return b; };

/** Column names above the goods: what you get when you sell, what you pay when you buy. */
function tradeHead() {
  const h = el('div', 'trade-row trade-head');
  h.innerHTML = '<span></span><span></span><span></span>';
  (h.children[0] as HTMLElement).textContent = t('Good · in your stores');
  (h.children[1] as HTMLElement).textContent = t('Sell price — you get · Buy price — you pay');
  (h.children[2] as HTMLElement).textContent = t('− sell · + buy');
  return h;
}

/** Trade window: today's prices for every good (from the neighbour towns or the merchants), with buttons to sell and buy. */
export class TradePanel {
  private root: HTMLDivElement;
  visible = false;
  /** Whom you trade with: 'best' = everyone (best price for each good), or one town. */
  private town: number | 'best' = 'best';
  /** The good whose price chart is shown. */
  private good: Good = 'food';
  private savedScroll = 0;
  /** Price sheets the player opened (kept open when the window refreshes). */
  private openSheets = new Set<string>();
  /** The open tab, the chart's range and towns, and the ticket (buy or sell, with whom, how much). */
  private tab: TradeTab = 'market';
  private range: '7d' | '30d' | 'all' = '30d';
  private scope: 'me' | 'all' = 'all';
  private mode: 'buy' | 'sell' = 'sell';
  private party: number | null = null;
  private qty = 0;

  constructor(parent: HTMLElement, private trade: Trade, private host: TradeHost) {
    this.root = el('div', 'respanel trade-panel');
    parent.appendChild(this.root);
  }

  toggle() { if (this.visible) this.hide(); else { this.visible = true; this.render(); } }
  open() { this.visible = true; this.render(); }
  /** Open on one neighbour town. */
  openTown(id: number) { this.town = id; this.tab = 'towns'; this.visible = true; this.render(); }
  /** The window element (it can be shown inside the town hall window). */
  get element() { return this.root; }

  hide() {
    this.visible = false;
    this.root.classList.remove('show');
  }

  render() {
    if (!this.visible) return;
    if (hoverBusy(this.root)) return;
    // typing an amount: the window waits until the field is left
    if (this.root.contains(document.activeElement) && (document.activeElement as HTMLElement).tagName === 'INPUT') return;
    const city = this.host.city();
    const linked = this.host.linked();
    const oldBody = this.root.querySelector('.rp-body') as HTMLElement | null;
    if (oldBody && oldBody.scrollTop > 0) this.savedScroll = oldBody.scrollTop;
    const scroll = this.savedScroll;
    this.root.replaceChildren();
    this.root.classList.add('xchg');
    const head = el('div', 'rp-head xg-head');
    head.innerHTML = `<span class="rp-ic">${icon('globe')}</span>`;
    const titles = el('div', 'rp-titles');
    const h = el('b', '');
    h.textContent = t('Exchange');
    const val = el('div', 'rp-value');
    val.textContent = `$${Math.round(city.money).toLocaleString('en-US')}`;
    const sub = el('small', '');
    sub.textContent = linked ? t('Train station / airport: goods travel cheaply') : t('No train station or airport: caravans take 10%');
    titles.append(h, val, sub);
    const x = el('button', 'info-x');
    x.classList.add('trade-x');
    x.innerHTML = icon('close');
    x.setAttribute('aria-label', t('Close'));
    x.addEventListener('click', () => this.hide());
    head.append(titles, x);

    const towns = this.host.neighbours();
    const all = this.host.towns();
    const me = all.find((c) => c.mine);
    const od = this.host.orders();
    // tabs: the market terminal, the towns, orders from abroad, the deal log and the price board
    const tabs = el('div', 'xg-tabs');
    const waiting = od.list.filter((o) => !o.accepted).length;
    const TABS: [TradeTab, string, number?][] = [['market', t('Market')], ['towns', t('Towns')], ['orders', t('Orders'), waiting], ['deals', t('Deals')], ['board', t('Prices')]];
    for (const [id, label, n] of TABS) {
      const b = el('button', `xg-tab${this.tab === id ? ' on' : ''}`);
      b.textContent = label;
      if (n) { const s = el('span', 'xg-count'); s.textContent = `${n}`; b.appendChild(s); }
      b.addEventListener('click', () => { this.tab = id; this.savedScroll = 0; this.render(); });
      tabs.appendChild(b);
    }
    const tape = this.ticker(me?.id);

    const body = el('div', 'rp-body xg-body');
    body.addEventListener('scroll', () => { if (body.scrollTop > 0) this.savedScroll = body.scrollTop; }, { passive: true });
    const sec = (text: string) => { const s = el('div', 'rp-sec'); s.textContent = text; body.appendChild(s); };
    if (this.town !== 'best' && !towns.some((n) => n.id === this.town)) this.town = 'best';
    let lines: { id: number; name: string; tint: string; mine: boolean }[] = [];
    if (this.tab === 'market') lines = this.market(body, city, towns, all);
    else if (this.tab === 'towns') {
      const pick = el('div', 'trade-towns');
      const chip = (id: number | 'best', label: string, tint?: string) => {
        const b = el('button', `trade-town${this.town === id ? ' active' : ''}`);
        b.innerHTML = tint ? `<i style="background:${tint}"></i><span></span>` : `<span></span>`;
        (b.querySelector('span') as HTMLElement).textContent = label;
        b.addEventListener('click', () => { this.town = id; this.render(); });
        pick.appendChild(b);
      };
      chip('best', t('All towns'));
      for (const n of towns) chip(n.id, n.name, n.tint);
      body.appendChild(pick);
      const sel = this.town === 'best' ? undefined : towns.find((n) => n.id === this.town);
      if (sel) this.townTable(body, sec, city, sel);
      else this.townCards(body, sec, city, towns);
    } else if (this.tab === 'orders') {
      const mood = el('div', 'trade-season');
      mood.textContent = `${od.season}${od.economy ? ` · ${od.economy}` : ''}`;
      body.appendChild(mood);
      this.ordersBlock(body, sec, od);
    } else if (this.tab === 'deals') {
      const sum = el('div', 'trade-sum');
      const cell = (label: string, v: number, cls: string, s: string) => {
        const c = el('div', `trade-sum-c ${cls}`);
        c.innerHTML = '<small></small><b></b><i></i>';
        (c.querySelector('small') as HTMLElement).textContent = label;
        (c.querySelector('b') as HTMLElement).textContent = `$${Math.round(v).toLocaleString('en-US')}`;
        (c.querySelector('i') as HTMLElement).textContent = s;
        sum.appendChild(c);
      };
      cell(t('Sold today'), this.trade.today.sold, 'pos', `${t('yesterday')} $${Math.round(this.trade.yesterday.sold).toLocaleString('en-US')}`);
      cell(t('Bought today'), this.trade.today.bought, 'neg', `${t('yesterday')} $${Math.round(this.trade.yesterday.bought).toLocaleString('en-US')}`);
      cell(t('Balance today'), this.trade.today.sold - this.trade.today.bought, this.trade.today.sold >= this.trade.today.bought ? 'pos' : 'neg', linked ? t('Railway / airport') : t('Caravans'));
      body.appendChild(sum);
      this.extras(body, sec);
    } else this.board(body, sec, all);
    this.root.append(head, tabs, tape);
    this.finish(body, scroll, lines);
  }

  /** A running strip of today's prices in your town (like a stock ticker). */
  private ticker(meId?: number) {
    const tape = el('div', 'xg-tape');
    const run = el('div', 'xg-tape-run');
    const items = GOODS.map((g) => {
      const v = meId !== undefined ? this.host.history(meId, g) : [];
      const now = v[v.length - 1] ?? 0;
      const p = this.change(v);
      return `<span class="xg-tk">${goodIcon(g, 16)}<b>${esc(t(GOOD_NAME[g]))}</b> $${now.toFixed(1)} <i class="${p > 0 ? 'up' : p < 0 ? 'down' : ''}">${p > 0 ? '▲' : p < 0 ? '▼' : '•'}${Math.abs(p).toFixed(1)}%</i></span>`;
    }).join('');
    run.innerHTML = items + items;
    tape.appendChild(run);
    return tape;
  }

  /** Change over the last `days` in % (one decimal). */
  private change(v: number[], days = 7) {
    if (v.length < 2) return 0;
    const old = v[Math.max(0, v.length - 1 - days)], now = v[v.length - 1];
    return old ? Math.round(((now - old) / old) * 1000) / 10 : 0;
  }

  /**
   * The market terminal: the goods on the left (price, change and a small line), the chosen good in the middle
   * (price, figures and its chart) and on the right the order book of the towns with a ticket to buy or sell.
   */
  private market(body: HTMLElement, city: City, towns: Neighbour[], all: { id: number; name: string; tint: string; mine: boolean }[]) {
    const me = all.find((c) => c.mine);
    const g = this.good;
    const grid = el('div', 'xg-grid');
    // ---- the goods
    const list = el('div', 'xg-list');
    const lh = el('div', 'xg-list-h');
    lh.innerHTML = '<span></span><span></span><span></span>';
    (lh.children[0] as HTMLElement).textContent = t('Good');
    (lh.children[1] as HTMLElement).textContent = t('Price');
    (lh.children[2] as HTMLElement).textContent = '7D';
    list.appendChild(lh);
    for (const k of GOODS) {
      const v = me ? this.host.history(me.id, k) : [];
      const now = v[v.length - 1] ?? 0, p = this.change(v);
      const r = el('button', `xg-item${k === g ? ' on' : ''}`);
      r.innerHTML = `<span class="xg-pic">${goodIcon(k, 30)}</span><span class="xg-nm"><b></b><small></small></span><span class="xg-pr"><b></b>${spark(v.slice(-14), p >= 0 ? '#6fcf97' : '#f07167')}</span><span class="xg-ch ${p > 0 ? 'up' : p < 0 ? 'down' : ''}"></span>`;
      (r.querySelector('.xg-nm b') as HTMLElement).textContent = t(GOOD_NAME[k]);
      (r.querySelector('.xg-nm small') as HTMLElement).textContent = t('{n} in stock', { n: Math.floor(city[k]).toLocaleString('en-US') });
      (r.querySelector('.xg-pr b') as HTMLElement).textContent = `$${now.toFixed(1)}`;
      (r.querySelector('.xg-ch') as HTMLElement).textContent = `${p > 0 ? '+' : ''}${p.toFixed(1)}%`;
      r.addEventListener('click', () => { this.good = k; this.party = null; this.qty = 0; this.render(); });
      list.appendChild(r);
    }
    // cars from your car markets: export them, or import when you have no car factory
    const car = this.host.cars();
    const cr = el('div', 'xg-item xg-car');
    cr.innerHTML = `<span class="xg-pic">${goodIcon('car', 30)}</span><span class="xg-nm"><b></b><small></small></span><span class="xg-car-b"></span>`;
    (cr.querySelector('.xg-nm b') as HTMLElement).textContent = t('Cars');
    (cr.querySelector('.xg-nm small') as HTMLElement).textContent = car.market ? `${t('{n} in the car markets', { n: car.have })} · −$${car.sell} / +$${car.buy}` : t('Build a car market first');
    const cb = cr.querySelector('.xg-car-b') as HTMLElement;
    const mkc = (label: string, cls: string, on: boolean, fn: () => void, tipText: string) => { const b = el('button', `btn-mini ${cls}`); b.textContent = label; b.disabled = !on; b.title = tipText; b.addEventListener('click', () => { fn(); this.render(); }); return b; };
    cb.append(mkc('−1', 'sell', car.have >= 1, () => this.host.carDeal(true), `${t('Sell')} $${car.sell}`), mkc('+1', 'buy', car.market && car.room > 0 && city.money >= car.buy, () => this.host.carDeal(false), `${t('Buy')} $${car.buy}`));
    list.appendChild(cr);

    // ---- the chosen good
    const main = el('div', 'xg-main');
    const v = me ? this.host.history(me.id, g) : [];
    const now = v[v.length - 1] ?? 0;
    const days = this.range === 'all' ? v.length : this.range === '30d' ? 30 : 7;
    const p = this.change(v, days);
    const bids = towns.flatMap((n) => n.buys.filter((x) => x.g === g && x.room > 0).map((x) => ({ n, price: x.price, size: Math.min(x.room, Math.floor(n.money / Math.max(0.1, x.price))) }))).filter((b) => b.size > 0).sort((a, b) => b.price - a.price);
    const asks = towns.flatMap((n) => n.sells.filter((x) => x.g === g && x.have > 0).map((x) => ({ n, price: x.price, size: Math.floor(x.have) }))).filter((a) => a.size > 0).sort((a, b) => a.price - b.price);
    const span = v.slice(-days - 1);
    const mh = el('div', 'xg-mh');
    mh.innerHTML = `<span class="xg-big">${goodIcon(g, 52)}</span><div class="xg-mt"><small></small><b></b></div><div class="xg-px"><b></b><span></span></div>`;
    (mh.querySelector('.xg-mt small') as HTMLElement).textContent = t('Your town · market price');
    (mh.querySelector('.xg-mt b') as HTMLElement).textContent = t(GOOD_NAME[g]);
    (mh.querySelector('.xg-px b') as HTMLElement).textContent = `$${now.toFixed(2)}`;
    const pc = mh.querySelector('.xg-px span') as HTMLElement;
    pc.textContent = `${p > 0 ? '▲ +' : p < 0 ? '▼ ' : ''}${p.toFixed(1)}% · ${this.range === 'all' ? t('all time') : this.range === '30d' ? '30D' : '7D'}`;
    pc.className = p > 0 ? 'up' : p < 0 ? 'down' : '';
    main.appendChild(mh);
    const stats = el('div', 'xg-stats');
    const stat = (k: string, val: string, cls = '') => { const s = el('div', 'xg-stat'); s.innerHTML = '<small></small><b></b>'; (s.querySelector('small') as HTMLElement).textContent = k; const b = s.querySelector('b') as HTMLElement; b.textContent = val; if (cls) b.className = cls; stats.appendChild(s); };
    stat(t('In your stores'), Math.floor(city[g]).toLocaleString('en-US'));
    stat(t('Best bid'), bids[0] ? `$${bids[0].price.toFixed(1)}` : '—', 'up');
    stat(t('Best ask'), asks[0] ? `$${asks[0].price.toFixed(1)}` : '—', 'down');
    stat(t('Low'), span.length ? `$${Math.min(...span).toFixed(1)}` : '—');
    stat(t('High'), span.length ? `$${Math.max(...span).toFixed(1)}` : '—');
    stat(t('Stock value'), `$${Math.round(city[g] * now).toLocaleString('en-US')}`);
    main.appendChild(stats);
    // chart with its range and whose prices it shows
    const bar = el('div', 'xg-bar');
    const ranges = el('div', 'xg-seg');
    for (const [id, label] of [['7d', '7D'], ['30d', '30D'], ['all', t('All')]] as const) {
      const b = el('button', this.range === id ? 'on' : '');
      b.textContent = label;
      b.addEventListener('click', () => { this.range = id; this.render(); });
      ranges.appendChild(b);
    }
    const scope = el('div', 'xg-seg');
    for (const [id, label] of [['me', t('Your town')], ['all', t('All towns')]] as const) {
      const b = el('button', this.scope === id ? 'on' : '');
      b.textContent = label;
      b.addEventListener('click', () => { this.scope = id; this.render(); });
      scope.appendChild(b);
    }
    bar.append(ranges, scope);
    main.appendChild(bar);
    const chartBox = el('div', 'trade-chart xg-chart');
    const canvas = el('canvas', 'trade-canvas') as HTMLCanvasElement;
    chartBox.appendChild(canvas);
    main.appendChild(chartBox);
    const lines = all.filter((c) => c.mine || this.scope === 'all');
    if (lines.length > 1) {
      const lg = el('div', 'xg-legend');
      for (const c of lines) { const s = el('small', ''); s.innerHTML = `<i style="background:${c.mine ? '#f2b33d' : c.tint}"></i>`; s.append(c.mine ? t('Your town') : c.name); lg.appendChild(s); }
      main.appendChild(lg);
    }

    // ---- order book and the ticket
    const side = el('div', 'xg-side');
    const book = el('div', 'xg-book');
    const bh = el('div', 'xg-book-h');
    bh.textContent = t('Order book');
    book.appendChild(bh);
    const maxSize = Math.max(1, ...bids.map((b) => b.size), ...asks.map((a) => a.size));
    const row = (o: { n: Neighbour; price: number; size: number }, kind: 'ask' | 'bid') => {
      const picked = this.party === o.n.id && this.mode === (kind === 'bid' ? 'sell' : 'buy');
      const r = el('button', `xg-ob ${kind}${picked ? ' on' : ''}`);
      r.innerHTML = `<i class="xg-depth" style="width:${Math.round((o.size / maxSize) * 100)}%"></i><b></b><span></span><small></small>`;
      (r.querySelector('b') as HTMLElement).textContent = `$${o.price.toFixed(1)}`;
      (r.querySelector('span') as HTMLElement).textContent = o.size.toLocaleString('en-US');
      (r.querySelector('small') as HTMLElement).textContent = o.n.name;
      r.title = kind === 'bid' ? t('{city} buys up to {n} at ${p}', { city: o.n.name, n: o.size, p: o.price.toFixed(1) }) : t('{city} sells up to {n} at ${p}', { city: o.n.name, n: o.size, p: o.price.toFixed(1) });
      r.addEventListener('click', () => { this.mode = kind === 'bid' ? 'sell' : 'buy'; this.party = o.n.id; this.qty = 0; this.render(); });
      return r;
    };
    const cols = el('div', 'xg-ob-cols');
    cols.innerHTML = '<span></span><span></span><span></span>';
    (cols.children[0] as HTMLElement).textContent = t('Price');
    (cols.children[1] as HTMLElement).textContent = t('Amount');
    (cols.children[2] as HTMLElement).textContent = t('Town');
    book.appendChild(cols);
    const askBox = el('div', 'xg-ob-list');
    if (!asks.length) { const e = el('div', 'xg-ob-none'); e.textContent = t('Nobody sells it'); askBox.appendChild(e); }
    for (const a of asks.slice(0, 5).reverse()) askBox.appendChild(row(a, 'ask'));
    const mid = el('div', 'xg-spread');
    mid.innerHTML = '<b></b><small></small>';
    (mid.querySelector('b') as HTMLElement).textContent = `$${now.toFixed(2)}`;
    (mid.querySelector('small') as HTMLElement).textContent = bids[0] && asks[0] ? `${t('Spread')} $${Math.abs(asks[0].price - bids[0].price).toFixed(1)}` : t('Your town');
    const bidBox = el('div', 'xg-ob-list');
    for (const b of bids.slice(0, 5)) bidBox.appendChild(row(b, 'bid'));
    if (!bids.length) { const e = el('div', 'xg-ob-none'); e.textContent = t('Nobody buys it'); bidBox.appendChild(e); }
    book.append(askBox, mid, bidBox);
    side.appendChild(book);

    // the ticket: buy or sell, with whom, how much
    const ticket = el('div', 'xg-ticket');
    const seg = el('div', 'xg-bs');
    for (const m of ['buy', 'sell'] as const) {
      const b = el('button', `${m}${this.mode === m ? ' on' : ''}`);
      b.textContent = m === 'buy' ? t('Buy') : t('Sell');
      b.addEventListener('click', () => { this.mode = m; this.party = null; this.qty = 0; this.render(); });
      seg.appendChild(b);
    }
    ticket.appendChild(seg);
    const selling = this.mode === 'sell';
    const offers = selling ? bids : asks;
    const chosen = offers.find((o) => o.n.id === this.party) ?? offers[0];
    const lot = g === 'food' ? 50 : 10;
    const max = chosen ? Math.max(0, Math.floor(selling ? Math.min(city[g], chosen.size) : Math.min(chosen.size, city.money / Math.max(0.1, chosen.price)))) : 0;
    if (!this.qty) this.qty = Math.min(lot, max);
    this.qty = Math.min(this.qty, max);
    const who = el('div', 'xg-who');
    who.innerHTML = '<small></small><b></b>';
    (who.querySelector('small') as HTMLElement).textContent = selling ? t('Buyer') : t('Seller');
    const wb = who.querySelector('b') as HTMLElement;
    wb.textContent = chosen ? `${chosen.n.name} · $${chosen.price.toFixed(1)}` : selling ? t('No town needs it') : t('Nobody sells it');
    if (chosen) wb.style.setProperty('--tint', chosen.n.tint);
    ticket.appendChild(who);
    const q = el('div', 'xg-qty');
    const minus = el('button', 'xg-step'); minus.textContent = '−';
    const input = el('input', '') as HTMLInputElement;
    input.type = 'number'; input.inputMode = 'numeric'; input.min = '0'; input.max = `${max}`; input.value = `${this.qty}`;
    input.setAttribute('aria-label', t('Amount'));
    const plus = el('button', 'xg-step'); plus.textContent = '+';
    const total = el('div', 'xg-total');
    const confirm = el('button', `xg-go ${this.mode}`);
    const sync = () => {
      const n = Math.max(0, Math.min(max, Math.floor(Number(input.value) || 0)));
      this.qty = n;
      total.innerHTML = '<span></span><b></b>';
      (total.querySelector('span') as HTMLElement).textContent = selling ? t('You get') : t('You pay');
      (total.querySelector('b') as HTMLElement).textContent = chosen ? `$${Math.round(n * chosen.price).toLocaleString('en-US')}` : '—';
      confirm.textContent = chosen && n > 0 ? `${selling ? t('Sell') : t('Buy')} ${n} ${t(GOOD_NAME[g]).toLowerCase()}` : selling ? t('Nothing to sell') : t('Nothing to buy');
      confirm.disabled = !chosen || n <= 0;
    };
    const step = (d: number) => { input.value = `${Math.max(0, Math.min(max, (Number(input.value) || 0) + d))}`; sync(); };
    minus.addEventListener('click', () => step(-lot));
    plus.addEventListener('click', () => step(lot));
    input.addEventListener('input', sync);
    input.addEventListener('change', () => { input.value = `${this.qty}`; sync(); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { input.blur(); confirm.click(); } });
    q.append(minus, input, plus);
    ticket.appendChild(q);
    const pcts = el('div', 'xg-pcts');
    for (const f of [0.25, 0.5, 0.75, 1]) {
      const b = el('button', '');
      b.textContent = f === 1 ? t('Max') : `${f * 100}%`;
      b.disabled = !max;
      b.addEventListener('click', () => { input.value = `${Math.floor(max * f)}`; sync(); });
      pcts.appendChild(b);
    }
    ticket.appendChild(pcts);
    const avail = el('div', 'xg-avail');
    avail.textContent = selling
      ? t('In your stores: {n} · they take up to {m}', { n: Math.floor(city[g]).toLocaleString('en-US'), m: (chosen?.size ?? 0).toLocaleString('en-US') })
      : t('Treasury: ${n} · they have {m}', { n: Math.round(city.money).toLocaleString('en-US'), m: (chosen?.size ?? 0).toLocaleString('en-US') });
    ticket.append(total, confirm, avail);
    confirm.addEventListener('click', () => {
      if (!chosen || this.qty <= 0) return;
      this.host.deal(chosen.n.id, g, this.qty, selling);
      this.qty = 0;
      this.render();
    });
    sync();
    side.appendChild(ticket);
    grid.append(list, main, side);
    body.appendChild(grid);
    const note = el('div', 'rp-note');
    note.textContent = t('You trade with the other towns on the map: they pay more for what they lack and sell what they have too much of. Tap a row of the order book to deal with that town.');
    body.appendChild(note);
    return lines;
  }

  /** The neighbour towns: what each needs and sells, with quick deals and a gift. */
  private townCards(body: HTMLElement, sec: (s: string) => void, city: City, towns: Neighbour[]) {
    const car = this.host.cars();
    if (!towns.length) { const n = el('div', 'rp-note'); n.textContent = t('No neighbour towns yet.'); body.appendChild(n); return; }
    sec(t('Neighbour towns'));
    for (const n of towns) {
      const card = el('div', 'nb-card');
      const head = el('div', 'nb-head');
      head.innerHTML = `<i class="nb-dot"></i><b></b><small></small>`;
      (head.querySelector('.nb-dot') as HTMLElement).style.background = n.tint;
      (head.querySelector('b') as HTMLElement).textContent = n.name;
      (head.querySelector('small') as HTMLElement).textContent = `${t('{n} people', { n: n.people })} · $${Math.round(n.money).toLocaleString('en-US')} · ${t('Relations')} ${Math.round(n.relation)}/100`;
      const open = el('button', 'btn-mini');
      open.textContent = t('Trade');
      open.addEventListener('click', () => { this.town = n.id; this.render(); });
      const gift = el('button', 'btn-mini ghost');
      gift.textContent = t('Gift: 50 food');
      gift.disabled = city.food < 50;
      gift.addEventListener('click', () => { this.host.gift(n.id); this.render(); });
      head.append(open, gift);
      card.appendChild(head);
      const line = (label: string, items: { g: Good; price: number; have?: number }[], selling: boolean) => {
        const row = el('div', 'nb-row');
        const l = el('small', '');
        l.textContent = label;
        row.appendChild(l);
        if (!items.length) { const s = el('span', 'nb-none'); s.textContent = '—'; row.appendChild(s); }
        for (const it of items) {
          const lot = it.g === 'food' ? 50 : 10;
          const b = el('button', `btn-mini ${selling ? 'sell' : 'buy'} xg-chipbtn`);
          b.innerHTML = goodIcon(it.g, 18);
          b.append(`${t(GOOD_NAME[it.g])} ${selling ? '−' : '+'}${lot} · $${Math.round(it.price * lot)}`);
          b.disabled = selling ? city[it.g] < lot || n.money < it.price * lot : city.money < it.price * lot || (it.have ?? 0) < lot;
          b.addEventListener('click', () => { this.host.deal(n.id, it.g, lot, selling); this.render(); });
          row.appendChild(b);
        }
        card.appendChild(row);
      };
      line(t('They need'), n.wants, true);
      if (n.carPrice) {
        const row = el('div', 'nb-row');
        const l = el('small', '');
        l.textContent = t('They want cars');
        const b = el('button', 'btn-mini sell xg-chipbtn');
        b.innerHTML = goodIcon('car', 18);
        b.append(`${t('Cars')} −1 · $${n.carPrice}`);
        b.disabled = car.have < 1 || n.money < n.carPrice;
        b.addEventListener('click', () => { this.host.carsTo(n.id); this.render(); });
        row.append(l, b);
        card.appendChild(row);
      }
      line(t('They sell'), n.offers, false);
      body.appendChild(card);
    }
  }

  /** Price board: every good in every town today (your town first), with the change over the week. */
  private board(body: HTMLElement, sec: (s: string) => void, all: { id: number; name: string; tint: string; mine: boolean }[]) {
    sec(t('Prices today in every town'));
    const wrap = el('div', 'price-board');
    const table = el('table', '');
    const head = el('tr', '');
    head.appendChild(el('th', ''));
    const towns = [...all].sort((a, b) => Number(b.mine) - Number(a.mine));
    for (const c of towns) {
      const th = el('th', '');
      th.innerHTML = `<i style="background:${c.mine ? '#f2b33d' : c.tint}"></i>`;
      th.append(c.mine ? t('Your town') : c.name);
      head.appendChild(th);
    }
    table.appendChild(head);
    for (const g of GOODS) {
      const tr = el('tr', g === this.good ? 'picked' : '');
      const name = el('td', 'pb-good');
      name.textContent = t(GOOD_NAME[g]);
      tr.appendChild(name);
      const vals = towns.map((c) => this.host.history(c.id, g));
      const others = towns.map((c, i) => (c.mine ? NaN : vals[i][vals[i].length - 1] ?? 0)).filter((v) => !isNaN(v) && v > 0);
      const lo = Math.min(...others), hi = Math.max(...others);
      towns.forEach((c, i) => {
        const v = vals[i], now = v[v.length - 1] ?? 0;
        const td = el('td', `${c.mine ? 'mine' : ''}${!c.mine && now === lo && others.length > 1 ? ' lo' : ''}${!c.mine && now === hi && others.length > 1 ? ' hi' : ''}`);
        const tr2 = this.trend(v);
        td.innerHTML = `<b></b><small class="${tr2.startsWith('▲') ? 'up' : tr2.startsWith('▼') ? 'down' : ''}"></small>`;
        (td.querySelector('b') as HTMLElement).textContent = now ? `$${now.toFixed(1)}` : '—';
        (td.querySelector('small') as HTMLElement).textContent = tr2 || '•';
        tr.appendChild(td);
      });
      tr.addEventListener('click', () => { this.good = g; this.render(); });
      table.appendChild(tr);
    }
    wrap.appendChild(table);
    body.appendChild(wrap);
    const n = el('div', 'rp-note');
    n.textContent = t('Green: the cheapest town to buy from. Amber: the town that pays the most. ▲▼ the change over the last week.');
    body.appendChild(n);
  }

  /** Export orders: offers to accept or decline, accepted ones with how much has been shipped. */
  private ordersBlock(body: HTMLElement, sec: (s: string) => void, od: ReturnType<TradeHost['orders']>) {
    sec(t('Export orders'));
    if (!od.linked) { const n = el('div', 'rp-note'); n.textContent = t('Orders from abroad come to towns with a working train station or airport.'); body.appendChild(n); if (!od.list.length) return; }
    if (!od.list.length) { const n = el('div', 'rp-note'); n.textContent = t('No orders right now — new ones come every few days.'); body.appendChild(n); return; }
    const box = el('div', 'orders');
    for (const o of od.list) {
      const c = el('div', `order${o.accepted ? ' on' : ''}`);
      const p = Math.min(1, o.delivered / o.amount);
      c.innerHTML = '<div class="or-top"><b></b><small></small></div><div class="or-bar"><i></i></div><div class="or-foot"><span></span></div>';
      (c.querySelector('b') as HTMLElement).textContent = `${o.amount} ${t(GOOD_NAME[o.good]).toLowerCase()} · ${t(o.from)}`;
      (c.querySelector('small') as HTMLElement).textContent = `$${o.price.toFixed(1)} ${t('each')} · +${Math.round(o.bonus * 100)}% ${t('bonus in time')} · ${t('{n} days', { n: o.daysLeft })}`;
      (c.querySelector('.or-bar i') as HTMLElement).style.width = `${Math.round(p * 100)}%`;
      (c.querySelector('.or-foot span') as HTMLElement).textContent = o.accepted ? t('Shipped {a} of {b} · in stock {s}', { a: o.delivered, b: o.amount, s: Math.floor(o.stock) }) : t('Worth ${n} with the bonus · in stock {s}', { n: Math.round(o.amount * o.price * (1 + o.bonus)), s: Math.floor(o.stock) });
      if (!o.accepted) {
        const foot = c.querySelector('.or-foot') as HTMLElement;
        const yes = el('button', 'btn-mini sell'); yes.textContent = t('Accept'); yes.addEventListener('click', () => { this.host.orderAnswer(o.id, true); this.render(); });
        const no = el('button', 'btn-mini ghost'); no.textContent = t('Decline'); no.addEventListener('click', () => { this.host.orderAnswer(o.id, false); this.render(); });
        foot.append(yes, no);
      }
      box.appendChild(c);
    }
    body.appendChild(box);
  }

  /** The latest deals and every other price of the town (cars, homes, bills, shops, wages). */
  private extras(body: HTMLElement, sec: (s: string) => void) {
    const deals = this.host.deals();
    sec(t('Latest deals'));
    const list = el('div', 'trade-deals');
    if (!deals.length) { const e = el('div', 'rp-note'); e.textContent = t('No deals yet — sell to a town that needs a good, or buy from one that has plenty.'); list.appendChild(e); }
    // the same deal repeated on one day is one row (×n, money added up)
    const grouped: (typeof deals[number] & { n: number })[] = [];
    for (const d of deals) {
      const last = grouped[grouped.length - 1];
      if (last && last.day === d.day && last.town === d.town && last.text === d.text) { last.n++; last.money += d.money; }
      else grouped.push({ ...d, n: 1 });
    }
    for (const d of grouped.slice(0, 14)) {
      const r = el('div', 'trade-deal');
      r.innerHTML = '<i></i><span></span><b></b>';
      (r.querySelector('i') as HTMLElement).style.background = d.tint;
      (r.querySelector('span') as HTMLElement).textContent = `${d.day} · ${d.town} · ${d.text}${d.n > 1 ? ` ×${d.n}` : ''}`;
      const m = r.querySelector('b') as HTMLElement;
      m.textContent = d.money ? `${d.money > 0 ? '+' : '−'}$${Math.abs(Math.round(d.money)).toLocaleString('en-US')}` : '—';
      m.className = d.money > 0 ? 'pos' : d.money < 0 ? 'neg' : '';
      list.appendChild(r);
    }
    body.appendChild(list);
    for (const s of this.host.priceSheet()) {
      const det = el('details', 'trade-more') as HTMLDetailsElement;
      // stays open across the window's refreshes
      det.open = this.openSheets.has(s.title);
      det.addEventListener('toggle', () => { if (det.open) this.openSheets.add(s.title); else this.openSheets.delete(s.title); });
      const sm = el('summary', '');
      sm.textContent = s.title;
      det.appendChild(sm);
      for (const [k, v] of s.rows) {
        const r = el('div', 'trade-more-row');
        r.innerHTML = '<span></span><b></b>';
        (r.querySelector('span') as HTMLElement).textContent = k;
        (r.querySelector('b') as HTMLElement).textContent = v;
        det.appendChild(r);
      }
      body.appendChild(det);
    }
  }

  /** Price change over the last week, as a coloured arrow and percent. */
  private trend(v: number[]) {
    if (v.length < 2) return '';
    const old = v[Math.max(0, v.length - 8)], now = v[v.length - 1];
    if (!old) return '';
    const p = Math.round(((now - old) / old) * 100);
    return p > 0 ? `▲${p}%` : p < 0 ? `▼${-p}%` : '•';
  }

  /** Trading with one chosen town: its price for every good, the trend and buttons to sell to it or buy from it. */
  private townTable(body: HTMLElement, sec: (s: string) => void, city: City, n: Neighbour) {
    sec(t('Trade with {city}', { city: n.name }));
    const info = el('div', 'nb-head');
    info.innerHTML = `<i class="nb-dot"></i><b></b><small></small>`;
    (info.querySelector('.nb-dot') as HTMLElement).style.background = n.tint;
    (info.querySelector('b') as HTMLElement).textContent = n.name;
    (info.querySelector('small') as HTMLElement).textContent = `${t('{n} people', { n: n.people })} · $${Math.round(n.money).toLocaleString('en-US')} · ${t('Relations')} ${Math.round(n.relation)}/100`;
    const gift = el('button', 'btn-mini ghost');
    gift.textContent = t('Gift: 50 food');
    gift.disabled = city.food < 50;
    gift.addEventListener('click', () => { this.host.gift(n.id); this.render(); });
    info.appendChild(gift);
    body.appendChild(info);
    const table = el('div', 'trade-table');
    table.appendChild(tradeHead());
    for (const g of GOODS) {
      const lot = g === 'food' ? 50 : 10;
      const have = Math.floor(city[g]);
      const buy = n.buys.find((x) => x.g === g);
      const sell = n.sells.find((x) => x.g === g);
      const v = this.host.history(n.id, g);
      const row = el('div', `trade-row${g === this.good ? ' picked' : ''}`);
      row.style.cursor = 'pointer';
      row.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.btn-mini')) return;
        this.good = g;
        this.render();
      });
      const name = el('div', 'trade-name pickable');
      name.innerHTML = `<b></b><small></small>`;
      (name.querySelector('b') as HTMLElement).textContent = t(GOOD_NAME[g]);
      (name.querySelector('small') as HTMLElement).textContent = `${t('You: {n}', { n: have })} · ${this.trend(v) || '•'}`;
      const offer = el('div', 'trade-offer');
      offer.innerHTML = `<span class="pos"></span><small></small><span class="neg"></span>`;
      (offer.querySelector('.pos') as HTMLElement).textContent = buy ? `${t('Sell price')}: $${buy.price.toFixed(1)}` : `${t('Sell price')}: — (${t('they do not buy it')})`;
      (offer.querySelector('small') as HTMLElement).textContent = [buy ? t('they take up to {n}', { n: buy.room }) : '', sell ? t('They have {n} to sell', { n: sell.have }) : ''].filter(Boolean).join(' · ');
      (offer.querySelector('.neg') as HTMLElement).textContent = sell ? `${t('Buy price')}: $${sell.price.toFixed(1)}` : `${t('Buy price')}: — (${t('they do not sell it')})`;
      const btns = el('div', 'trade-btns');
      const mk = (label: string, cls: string, on: boolean, fn: () => void) => { const b = el('button', `btn-mini ${cls}`); b.textContent = label; b.disabled = !on; b.addEventListener('click', () => { fn(); this.render(); }); return b; };
      btns.append(
        tip(mk(`−${lot}`, 'sell', !!buy && have >= lot && buy.room >= lot && n.money >= buy.price * lot, () => this.host.deal(n.id, g, lot, true)), buy ? t('Sell {n} for ${m}', { n: lot, m: Math.round(buy.price * lot) }) : ''),
        tip(mk(`−${lot * 5}`, 'sell', !!buy && have >= lot * 5 && buy.room >= lot * 5 && n.money >= buy.price * lot * 5, () => this.host.deal(n.id, g, lot * 5, true)), buy ? t('Sell {n} for ${m}', { n: lot * 5, m: Math.round(buy.price * lot * 5) }) : ''),
        tip(mk(`+${lot}`, 'buy', !!sell && sell.have >= lot && city.money >= sell.price * lot, () => this.host.deal(n.id, g, lot, false)), sell ? t('Buy {n} for ${m}', { n: lot, m: Math.round(sell.price * lot) }) : ''),
      );
      row.append(name, offer, btns);
      table.appendChild(row);
    }
    body.appendChild(table);
    // long deals: a good every day for 30 days at today's price (a little better for the seller)
    sec(t('Contracts with {city}', { city: n.name }));
    const active = this.host.contracts(n.id);
    const cbox = el('div', 'trade-deals');
    for (const k of active) {
      const r = el('div', 'trade-deal');
      r.innerHTML = '<i></i><span></span><button class="btn-mini ghost"></button>';
      (r.querySelector('i') as HTMLElement).style.background = k.selling ? '#7be08f' : '#6fb6ff';
      (r.querySelector('span') as HTMLElement).textContent = `${k.selling ? t('You sell') : t('You buy')} ${k.perDay} ${t(GOOD_NAME[k.good]).toLowerCase()}/${t('day')} · $${k.price.toFixed(1)} · ${t('{n} days left', { n: k.days })}${k.missed ? ` · ${t('{n} missed', { n: k.missed })}` : ''}`;
      const end = r.querySelector('button') as HTMLButtonElement;
      end.textContent = t('End');
      end.addEventListener('click', () => { this.host.endContract(n.id, k.good); this.render(); });
      cbox.appendChild(r);
    }
    const mk = el('div', 'trade-btns');
    mk.style.flexWrap = 'wrap';
    for (const w of n.buys.slice(0, 4)) {
      const b = el('button', 'btn-mini sell');
      const per = w.g === 'food' ? 20 : 5;
      b.textContent = `${t('Sell')} ${per} ${t(GOOD_NAME[w.g]).toLowerCase()}/${t('day')} · 30 ${t('days')}`;
      b.title = t('A contract: every day for 30 days at ${p} each', { p: (w.price * 1.05).toFixed(1) });
      b.disabled = active.some((k) => k.good === w.g);
      b.addEventListener('click', () => { this.host.contract(n.id, w.g, per, 30, true); this.render(); });
      mk.appendChild(b);
    }
    for (const o of n.sells.slice(0, 3)) {
      const b = el('button', 'btn-mini buy');
      const per = o.g === 'food' ? 20 : 5;
      b.textContent = `${t('Buy')} ${per} ${t(GOOD_NAME[o.g]).toLowerCase()}/${t('day')} · 30 ${t('days')}`;
      b.title = t('A contract: every day for 30 days at ${p} each', { p: (o.price * 0.95).toFixed(1) });
      b.disabled = active.some((k) => k.good === o.g);
      b.addEventListener('click', () => { this.host.contract(n.id, o.g, per, 30, false); this.render(); });
      mk.appendChild(b);
    }
    cbox.appendChild(mk);
    body.appendChild(cbox);
    const note = el('div', 'rp-note');
    note.textContent = t('Goods and money move between the treasuries at once; every deal makes you a little friendlier. Friends pay more and ask less.') + ' ' + t('A contract fixes the price for 30 days (5% better than today); five missed days end it.');
    body.appendChild(note);
  }

  private finish(body: HTMLElement, scroll: number, lines: { id: number; name: string; tint: string; mine: boolean }[]) {
    this.root.append(body);
    this.root.classList.add('show');
    body.scrollTop = scroll;
    requestAnimationFrame(() => { if (this.visible && scroll > 0) body.scrollTop = scroll; });
    const canvas = body.querySelector('.trade-canvas') as HTMLCanvasElement | null;
    const days = this.range === 'all' ? Infinity : this.range === '30d' ? 31 : 8;
    if (canvas) drawChart(canvas, lines.map((c) => ({ label: c.mine ? t('Your town') : c.name, color: c.mine ? '#f2b33d' : c.tint, values: ((h) => (h.length === 1 ? [h[0], h[0]] : h))(this.host.history(c.id, this.good).slice(-days)) })), (v) => `$${v.toFixed(1)}`);
  }
}
