import { el, icon } from './dom';
import { t } from '../i18n/i18n';
import { GOODS, GOOD_NAME, Good, Trade } from '../game/Trade';
import type { City } from '../sim/Economy';

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
}

export interface Neighbour { id: number; name: string; tint: string; people: number; money: number; relation: number; wants: { g: Good; price: number }[]; offers: { g: Good; price: number; have: number }[];
  /** Every good the town buys (its price rises when it has little) and sells (cheap when it has plenty). */
  buys: { g: Good; price: number; room: number }[]; sells: { g: Good; price: number; have: number }[]; carPrice?: number }

/** Trade window: today's prices for every good (from the neighbour towns or the merchants), with buttons to sell and buy. */
export class TradePanel {
  private root: HTMLDivElement;
  visible = false;

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
    const city = this.host.city();
    const linked = this.host.linked();
    const scroll = this.root.querySelector('.rp-body')?.scrollTop ?? 0;
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
    x.innerHTML = icon('close');
    x.setAttribute('aria-label', t('Close'));
    x.addEventListener('click', () => this.hide());
    head.append(titles, x);

    const body = el('div', 'rp-body');
    const sec = (text: string) => { const s = el('div', 'rp-sec'); s.textContent = text; body.appendChild(s); };
    sec(t('Goods'));
    const table = el('div', 'trade-table');
    const towns = this.host.neighbours();
    for (const g of GOODS) {
      const have = Math.floor(city[g]);
      const lot = g === 'food' ? 50 : 10;
      // the best buyer and seller: a real neighbour town when it pays more (or sells cheaper), otherwise the merchants
      const merchant = this.trade.bestSell(g, linked).price;
      let seller: { id: number; name: string; price: number } | undefined;
      let buyer: { id: number; name: string; price: number } | undefined;
      for (const n of towns) {
        const w = n.buys.find((x) => x.g === g && x.room >= lot);
        if (w && w.price > (buyer?.price ?? merchant) && n.money >= w.price * lot) buyer = { id: n.id, name: n.name, price: w.price };
        const o = n.sells.find((x) => x.g === g);
        if (o && o.have >= lot && o.price < (seller?.price ?? this.trade.buyPrice(g, linked))) seller = { id: n.id, name: n.name, price: o.price };
      }
      const best = { price: buyer?.price ?? merchant, partner: { name: buyer?.name ?? t('Travelling merchants') } };
      const buy = seller?.price ?? this.trade.buyPrice(g, linked);
      const row = el('div', 'trade-row');
      const name = el('div', 'trade-name');
      name.innerHTML = `<b></b><small></small>`;
      (name.querySelector('b') as HTMLElement).textContent = t(GOOD_NAME[g]);
      (name.querySelector('small') as HTMLElement).textContent = t('{n} in stock', { n: have });
      const offer = el('div', 'trade-offer');
      offer.innerHTML = `<span class="pos"></span><small></small><span class="neg"></span>`;
      (offer.querySelector('.pos') as HTMLElement).textContent = `${t('Sell')} $${best.price.toFixed(1)}`;
      (offer.querySelector('small') as HTMLElement).textContent = seller && seller.name !== best.partner.name ? `${best.partner.name} / ${seller.name}` : best.partner.name;
      (offer.querySelector('.neg') as HTMLElement).textContent = `${t('Buy')} $${buy.toFixed(1)}`;
      const btns = el('div', 'trade-btns');
      const mk = (label: string, cls: string, on: boolean, fn: () => void) => {
        const b = el('button', `btn-mini ${cls}`);
        b.textContent = label;
        b.disabled = !on;
        b.addEventListener('click', () => { fn(); this.render(); });
        return b;
      };
      const sell = (n: number) => (buyer ? this.host.deal(buyer.id, g, n, true) : this.host.sell(g, n));
      btns.append(
        mk(`−${lot}`, 'sell', have >= lot, () => sell(lot)),
        mk(`−${lot * 5}`, 'sell', have >= lot * 5, () => sell(lot * 5)),
        mk(`+${lot}`, 'buy', city.money >= buy * lot, () => (seller ? this.host.deal(seller.id, g, lot, false) : this.host.buy(g, lot))),
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
    note.textContent = t('You trade with the real neighbour towns on the map: they pay more for what they lack and sell what they have too much of. When no town needs a good, travelling merchants buy it at plain prices.') + ' ' + t('Today: sold ${a}, bought ${b}', { a: Math.round(this.trade.today.sold), b: Math.round(this.trade.today.bought) });
    body.appendChild(note);
    this.root.append(head, body);
    this.root.classList.add('show');
    body.scrollTop = scroll;
  }
}
