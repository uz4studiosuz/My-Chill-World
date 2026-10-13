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
}

/** Trade window: today's prices for every good, with buttons to sell and buy, and the partners. */
export class TradePanel {
  private root: HTMLDivElement;
  visible = false;

  constructor(parent: HTMLElement, private trade: Trade, private host: TradeHost) {
    this.root = el('div', 'respanel trade-panel');
    parent.appendChild(this.root);
  }

  toggle() { if (this.visible) this.hide(); else { this.visible = true; this.render(); } }

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
    for (const g of GOODS) {
      const have = Math.floor(city[g]);
      const best = this.trade.bestSell(g, linked);
      const buy = this.trade.buyPrice(g, linked);
      const row = el('div', 'trade-row');
      const name = el('div', 'trade-name');
      name.innerHTML = `<b></b><small></small>`;
      (name.querySelector('b') as HTMLElement).textContent = t(GOOD_NAME[g]);
      (name.querySelector('small') as HTMLElement).textContent = t('{n} in stock', { n: have });
      const offer = el('div', 'trade-offer');
      offer.innerHTML = `<span class="pos"></span><small></small><span class="neg"></span>`;
      (offer.querySelector('.pos') as HTMLElement).textContent = `${t('Sell')} $${best.price.toFixed(1)}`;
      (offer.querySelector('small') as HTMLElement).textContent = t(best.partner.name);
      (offer.querySelector('.neg') as HTMLElement).textContent = `${t('Buy')} $${buy.toFixed(1)}`;
      const btns = el('div', 'trade-btns');
      const mk = (label: string, cls: string, on: boolean, fn: () => void) => {
        const b = el('button', `btn-mini ${cls}`);
        b.textContent = label;
        b.disabled = !on;
        b.addEventListener('click', () => { fn(); this.render(); });
        return b;
      };
      const lot = g === 'food' ? 50 : 10;
      btns.append(
        mk(`−${lot}`, 'sell', have >= lot, () => this.host.sell(g, lot)),
        mk(`−${lot * 5}`, 'sell', have >= lot * 5, () => this.host.sell(g, lot * 5)),
        mk(`+${lot}`, 'buy', city.money >= buy * lot, () => this.host.buy(g, lot)),
      );
      row.append(name, offer, btns);
      table.appendChild(row);
    }
    body.appendChild(table);

    sec(t('Partners'));
    for (const p of this.trade.partners) {
      const row = el('div', 'rp-bar');
      row.innerHTML = `<div class="rp-bar-l"><span></span><span></span></div><div class="rp-track"><i></i></div>`;
      const spans = row.querySelectorAll('.rp-bar-l span');
      (spans[0] as HTMLElement).textContent = t(p.name);
      (spans[1] as HTMLElement).textContent = `${t('Wants')}: ${p.wants.map((g) => t(GOOD_NAME[g]).toLowerCase()).join(', ')}`;
      (row.querySelector('.rp-track i') as HTMLElement).style.width = `${Math.min(100, p.relation)}%`;
      row.title = t('Relations: {n}/100 — better relations, better prices', { n: Math.round(p.relation) });
      body.appendChild(row);
    }
    const note = el('div', 'rp-note');
    note.textContent = t('Prices change every day. Partners pay up to 50% more for the goods they want; trading often improves relations (up to +20%).') + ' ' + t('Today: sold ${a}, bought ${b}', { a: Math.round(this.trade.today.sold), b: Math.round(this.trade.today.bought) });
    body.appendChild(note);
    this.root.append(head, body);
    this.root.classList.add('show');
    body.scrollTop = scroll;
  }
}
