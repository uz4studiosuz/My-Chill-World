import { TRADE_PRICE } from '../buildings/BuildingTypes';
import type { City, Res } from '../sim/Economy';

/** Goods the town hall can sell to or buy from other regions. */
export type Good = 'food' | 'wood' | 'stone' | 'iron' | 'coal' | 'planks' | 'bricks' | 'steel' | 'grain' | 'flour' | 'milk' | 'cotton';
export const GOODS: Good[] = ['food', 'wood', 'stone', 'iron', 'coal', 'planks', 'bricks', 'steel', 'grain', 'flour', 'milk', 'cotton'];
export const GOOD_NAME: Record<Good, string> = {
  food: 'Food', wood: 'Wood', stone: 'Stone', iron: 'Iron', coal: 'Coal', planks: 'Planks', bricks: 'Bricks', steel: 'Steel',
  grain: 'Grain', flour: 'Flour', milk: 'Milk', cotton: 'Cotton',
};

/** Travelling merchants: they always buy and sell, at plain prices. The real trading partners are the neighbour towns on the map. */
export interface Partner { name: string; wants: Good[]; relation: number }
const PARTNERS: { name: string; wants: Good[] }[] = [
  { name: 'Travelling merchants', wants: [] },
];

export interface TradeSave { relation: number[] }

/**
 * Trade with other regions. Every day each partner sets its prices (it pays more for what it wants);
 * good relations (built by trading) add up to 20% on top. Selling brings money now, buying costs a merchant's margin.
 * With a train station or an airport the goods travel cheaply; otherwise a caravan takes 10%.
 */
export class Trade {
  partners: Partner[] = PARTNERS.map((p) => ({ ...p, relation: 10 }));
  /** Today's price factor per partner and good. */
  private factor = new Map<string, number>();
  private day = -1;
  /** What was sold and bought today (for the panel). */
  today = { sold: 0, bought: 0 };

  newDay(day: number) {
    if (this.day === day) return;
    this.day = day;
    this.today = { sold: 0, bought: 0 };
    for (const p of this.partners) {
      for (const g of GOODS) this.factor.set(`${p.name}:${g}`, (p.wants.includes(g) ? 1.25 + Math.random() * 0.25 : 0.85 + Math.random() * 0.25));
      // relations cool down slowly when nobody trades
      p.relation = Math.max(0, p.relation - 0.5);
    }
  }

  /** Best offer today for selling a good: partner and price per unit. */
  bestSell(g: Good, linked: boolean) {
    let best = this.partners[0], price = 0;
    for (const p of this.partners) {
      const v = this.sellPrice(p, g, linked);
      if (v > price) { price = v; best = p; }
    }
    return { partner: best, price };
  }

  sellPrice(p: Partner, g: Good, linked: boolean) {
    const f = this.factor.get(`${p.name}:${g}`) ?? 1;
    return TRADE_PRICE[g] * 0.8 * f * (1 + Math.min(20, p.relation / 5) / 100) * (linked ? 1 : 0.9);
  }

  /** Cheapest offer for buying a good. */
  buyPrice(g: Good, linked: boolean) {
    let price = Infinity;
    for (const p of this.partners) {
      const f = this.factor.get(`${p.name}:${g}`) ?? 1;
      price = Math.min(price, TRADE_PRICE[g] * 1.25 * Math.min(1.2, f) * (1 - Math.min(20, p.relation / 5) / 200));
    }
    return price * (linked ? 1 : 1.1);
  }

  sell(city: City, g: Good, amount: number, linked: boolean, add: (res: Res, n: number, why: string) => void) {
    const n = Math.min(amount, Math.floor(city[g]));
    if (n <= 0) return null;
    const { partner, price } = this.bestSell(g, linked);
    const money = Math.round(n * price);
    add(g, -n, 'Sold to other regions');
    add('money', money, 'Trade: goods sold');
    partner.relation = Math.min(100, partner.relation + n / 20);
    this.today.sold += money;
    return { n, money, partner: partner.name };
  }

  buy(city: City, g: Good, amount: number, linked: boolean, add: (res: Res, n: number, why: string) => void) {
    const price = this.buyPrice(g, linked);
    const money = Math.round(amount * price);
    if (city.money < money) return null;
    add('money', -money, 'Trade: goods bought');
    add(g, amount, 'Bought from traders');
    this.today.bought += money;
    return { n: amount, money };
  }

  save(): TradeSave { return { relation: this.partners.map((p) => Math.round(p.relation)) }; }
  load(s?: TradeSave) { if (s?.relation) s.relation.forEach((r, i) => { if (this.partners[i]) this.partners[i].relation = r; }); }
}
