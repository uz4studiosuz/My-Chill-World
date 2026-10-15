import { el, icon, hoverBusy } from './dom';
import { t } from '../i18n/i18n';
import { GOODS, GOOD_NAME, Good, Trade } from '../game/Trade';
import type { City } from '../sim/Economy';
import { drawChart } from './Chart';

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

  constructor(parent: HTMLElement, private trade: Trade, private host: TradeHost) {
    this.root = el('div', 'respanel trade-panel');
    parent.appendChild(this.root);
  }

  toggle() { if (this.visible) this.hide(); else { this.visible = true; this.render(); } }
  open() { this.visible = true; this.render(); }
  /** The window element (it can be shown inside the town hall window). */
  get element() { return this.root; }

  hide() {
    this.visible = false;
    this.root.classList.remove('show');
  }

  render() {
    if (!this.visible) return;
    if (hoverBusy(this.root)) return;
    const city = this.host.city();
    const linked = this.host.linked();
    const oldBody = this.root.querySelector('.rp-body') as HTMLElement | null;
    if (oldBody && oldBody.scrollTop > 0) this.savedScroll = oldBody.scrollTop;
    const scroll = this.savedScroll;
    this.root.replaceChildren();
    const head = el('div', 'rp-head');
    head.innerHTML = `<span class="rp-ic">${icon('globe')}</span>`;
    const titles = el('div', 'rp-titles');
    const h = el('b', '');
    h.textContent = t('Trade');
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

    const body = el('div', 'rp-body');
    body.addEventListener('scroll', () => { if (body.scrollTop > 0) this.savedScroll = body.scrollTop; }, { passive: true });
    const sec = (text: string) => { const s = el('div', 'rp-sec'); s.textContent = text; body.appendChild(s); };
    const towns = this.host.neighbours();
    const all = this.host.towns();
    if (this.town !== 'best' && !towns.some((n) => n.id === this.town)) this.town = 'best';
    // whom to trade with: everyone (best price) or one town
    const pick = el('div', 'trade-towns');
    const chip = (id: number | 'best', label: string, tint?: string) => {
      const b = el('button', `trade-town${this.town === id ? ' active' : ''}`);
      b.innerHTML = tint ? `<i style="background:${tint}"></i><span></span>` : `<span></span>`;
      (b.querySelector('span') as HTMLElement).textContent = label;
      b.addEventListener('click', () => { this.town = id; this.render(); });
      pick.appendChild(b);
    };
    chip('best', t('Best price'));
    for (const n of towns) chip(n.id, n.name, n.tint);
    // what was traded today and yesterday
    const sum = el('div', 'trade-sum');
    const cell = (label: string, v: number, cls: string, sub: string) => {
      const c = el('div', `trade-sum-c ${cls}`);
      c.innerHTML = '<small></small><b></b><i></i>';
      (c.querySelector('small') as HTMLElement).textContent = label;
      (c.querySelector('b') as HTMLElement).textContent = `$${Math.round(v).toLocaleString('en-US')}`;
      (c.querySelector('i') as HTMLElement).textContent = sub;
      sum.appendChild(c);
    };
    cell(t('Sold today'), this.trade.today.sold, 'pos', `${t('yesterday')} $${Math.round(this.trade.yesterday.sold).toLocaleString('en-US')}`);
    cell(t('Bought today'), this.trade.today.bought, 'neg', `${t('yesterday')} $${Math.round(this.trade.yesterday.bought).toLocaleString('en-US')}`);
    cell(t('Balance today'), this.trade.today.sold - this.trade.today.bought, this.trade.today.sold >= this.trade.today.bought ? 'pos' : 'neg', linked ? t('Railway / airport') : t('Caravans'));
    body.appendChild(sum);
    body.appendChild(pick);
    // price chart of the chosen good: your town and the others, day by day
    const sel = this.town === 'best' ? undefined : towns.find((n) => n.id === this.town);
    const lines = all.filter((c) => c.mine || this.town === 'best' || c.id === this.town);
    const chartBox = el('div', 'trade-chart');
    const ch = el('div', 'trade-chart-head');
    ch.innerHTML = `<b></b><span></span>`;
    (ch.querySelector('b') as HTMLElement).textContent = t('Price of {good}', { good: t(GOOD_NAME[this.good]) });
    const legend = ch.querySelector('span') as HTMLElement;
    for (const c of lines) {
      const v = this.host.history(c.id, this.good);
      const now = v[v.length - 1] ?? 0;
      const l = el('small', '');
      l.innerHTML = `<i style="background:${c.mine ? '#f2b33d' : c.tint}"></i>`;
      l.append(`${c.mine ? t('Your town') : c.name} $${now.toFixed(1)} ${this.trend(v)}`);
      legend.appendChild(l);
    }
    const canvas = el('canvas', 'trade-canvas') as HTMLCanvasElement;
    chartBox.append(ch, canvas);
    body.appendChild(chartBox);
    const hint = el('div', 'rp-note');
    hint.textContent = t('Tap a good to see its price. A town pays more for what it has little of and sells cheap what it has a lot of.');
    body.appendChild(hint);
    this.board(body, sec, all);
    if (sel) { this.townTable(body, sec, city, sel); this.extras(body, sec); this.finish(head, body, scroll, lines); return; }
    sec(t('Goods'));
    const table = el('div', 'trade-table');
    table.appendChild(tradeHead());
    for (const g of GOODS) {
      const have = Math.floor(city[g]);
      const lot = g === 'food' ? 50 : 10;
      // the best buyer and seller among the towns (there are no merchants: towns trade with each other)
      let seller: { id: number; name: string; price: number } | undefined;
      let buyer: { id: number; name: string; price: number } | undefined;
      for (const n of towns) {
        const w = n.buys.find((x) => x.g === g && x.room >= lot);
        if (w && w.price > (buyer?.price ?? 0) && n.money >= w.price * lot) buyer = { id: n.id, name: n.name, price: w.price };
        const o = n.sells.find((x) => x.g === g);
        if (o && o.have >= lot && o.price < (seller?.price ?? Infinity)) seller = { id: n.id, name: n.name, price: o.price };
      }
      const best = { price: buyer?.price ?? 0, partner: { name: buyer?.name ?? t('No town needs it') } };
      const buy = seller?.price ?? 0;
      const row = el('div', 'trade-row');
      const name = el('div', 'trade-name');
      name.innerHTML = `<b></b><small></small>`;
      (name.querySelector('b') as HTMLElement).textContent = t(GOOD_NAME[g]);
      (name.querySelector('small') as HTMLElement).textContent = t('{n} in stock', { n: have });
      name.classList.add('pickable');
      if (g === this.good) row.classList.add('picked');
      row.style.cursor = 'pointer';
      row.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.btn-mini')) return;
        this.good = g;
        this.render();
      });
      const offer = el('div', 'trade-offer');
      offer.innerHTML = `<span class="pos"></span><small></small><span class="neg"></span>`;
      (offer.querySelector('.pos') as HTMLElement).textContent = buyer ? `${t('Sell price')}: $${best.price.toFixed(1)}` : `${t('Sell price')}: — (${t('nobody buys')})`;
      (offer.querySelector('small') as HTMLElement).textContent = [buyer ? `${t('buys')}: ${buyer.name}` : '', seller ? `${t('sells')}: ${seller.name}` : ''].filter(Boolean).join(' · ');
      (offer.querySelector('.neg') as HTMLElement).textContent = seller ? `${t('Buy price')}: $${buy.toFixed(1)}` : `${t('Buy price')}: — (${t('nobody sells')})`;
      const btns = el('div', 'trade-btns');
      const mk = (label: string, cls: string, on: boolean, fn: () => void) => {
        const b = el('button', `btn-mini ${cls}`);
        b.textContent = label;
        b.disabled = !on;
        b.addEventListener('click', () => { fn(); this.render(); });
        return b;
      };
      btns.append(
        tip(mk(`−${lot}`, 'sell', !!buyer && have >= lot, () => this.host.deal(buyer!.id, g, lot, true)), buyer ? t('Sell {n} for ${m}', { n: lot, m: Math.round(best.price * lot) }) : ''),
        tip(mk(`−${lot * 5}`, 'sell', !!buyer && have >= lot * 5, () => this.host.deal(buyer!.id, g, lot * 5, true)), buyer ? t('Sell {n} for ${m}', { n: lot * 5, m: Math.round(best.price * lot * 5) }) : ''),
        tip(mk(`+${lot}`, 'buy', !!seller && city.money >= buy * lot, () => this.host.deal(seller!.id, g, lot, false)), seller ? t('Buy {n} for ${m}', { n: lot, m: Math.round(buy * lot) }) : ''),
      );
      row.append(name, offer, btns);
      table.appendChild(row);
    }
    // cars from your car markets: export them, or import when you have no car factory
    const car = this.host.cars();
    {
      const row = el('div', 'trade-row');
      const name = el('div', 'trade-name');
      name.innerHTML = `<b></b><small></small>`;
      (name.querySelector('b') as HTMLElement).textContent = t('Cars');
      (name.querySelector('small') as HTMLElement).textContent = car.market ? t('{n} in the car markets', { n: car.have }) : t('Build a car market first');
      const offer = el('div', 'trade-offer');
      offer.innerHTML = `<span class="pos"></span><small></small><span class="neg"></span>`;
      (offer.querySelector('.pos') as HTMLElement).textContent = `${t('Sell')} $${car.sell}`;
      (offer.querySelector('small') as HTMLElement).textContent = t('per car');
      (offer.querySelector('.neg') as HTMLElement).textContent = `${t('Buy')} $${car.buy}`;
      const btns = el('div', 'trade-btns');
      const mk = (label: string, cls: string, on: boolean, fn: () => void) => { const b = el('button', `btn-mini ${cls}`); b.textContent = label; b.disabled = !on; b.addEventListener('click', () => { fn(); this.render(); }); return b; };
      btns.append(mk('−1', 'sell', car.have >= 1, () => this.host.carDeal(true)), mk('+1', 'buy', car.market && car.room > 0 && city.money >= car.buy, () => this.host.carDeal(false)));
      row.append(name, offer, btns);
      table.appendChild(row);
    }
    body.appendChild(table);

    // neighbour towns: real towns on the map, trading with their own treasury
    if (towns.length) {
      sec(t('Neighbour towns'));
      for (const n of towns) {
        const card = el('div', 'nb-card');
        const head = el('div', 'nb-head');
        head.innerHTML = `<i class="nb-dot"></i><b></b><small></small>`;
        (head.querySelector('.nb-dot') as HTMLElement).style.background = n.tint;
        (head.querySelector('b') as HTMLElement).textContent = n.name;
        (head.querySelector('small') as HTMLElement).textContent = `${t('{n} people', { n: n.people })} · $${Math.round(n.money).toLocaleString('en-US')} · ${t('Relations')} ${Math.round(n.relation)}/100`;
        const gift = el('button', 'btn-mini ghost');
        gift.textContent = t('Gift: 50 food');
        gift.disabled = city.food < 50;
        gift.addEventListener('click', () => { this.host.gift(n.id); this.render(); });
        head.appendChild(gift);
        card.appendChild(head);
        const line = (label: string, items: { g: Good; price: number; have?: number }[], selling: boolean) => {
          const row = el('div', 'nb-row');
          const l = el('small', '');
          l.textContent = label;
          row.appendChild(l);
          if (!items.length) { const s = el('span', 'nb-none'); s.textContent = '—'; row.appendChild(s); }
          for (const it of items) {
            const lot = it.g === 'food' ? 50 : 10;
            const b = el('button', `btn-mini ${selling ? 'sell' : 'buy'}`);
            b.textContent = `${t(GOOD_NAME[it.g])} ${selling ? '−' : '+'}${lot} · $${Math.round(it.price * lot)}`;
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
          const b = el('button', 'btn-mini sell');
          b.textContent = `${t('Cars')} −1 · $${n.carPrice}`;
          b.disabled = car.have < 1 || n.money < n.carPrice;
          b.addEventListener('click', () => { this.host.carsTo(n.id); this.render(); });
          row.append(l, b);
          card.appendChild(row);
        }
        line(t('They sell'), n.offers, false);
        body.appendChild(card);
      }
    }
    const note = el('div', 'rp-note');
    note.textContent = t('You trade with the other towns on the map: they pay more for what they lack and sell what they have too much of. There are no merchants — when no town needs a good, nobody buys it.') + ' ' + t('Today: sold ${a}, bought ${b}', { a: Math.round(this.trade.today.sold), b: Math.round(this.trade.today.bought) });
    body.appendChild(note);
    this.extras(body, sec);
    this.finish(head, body, scroll, lines);
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

  private finish(head: HTMLElement, body: HTMLElement, scroll: number, lines: { id: number; name: string; tint: string; mine: boolean }[]) {
    this.root.append(head, body);
    this.root.classList.add('show');
    body.scrollTop = scroll;
    requestAnimationFrame(() => { if (this.visible && scroll > 0) body.scrollTop = scroll; });
    const canvas = body.querySelector('.trade-canvas') as HTMLCanvasElement | null;
    if (canvas) drawChart(canvas, lines.map((c) => ({ label: c.mine ? t('Your town') : c.name, color: c.mine ? '#f2b33d' : c.tint, values: ((h) => (h.length === 1 ? [h[0], h[0]] : h))(this.host.history(c.id, this.good)) })), (v) => `$${v.toFixed(1)}`);
  }
}
