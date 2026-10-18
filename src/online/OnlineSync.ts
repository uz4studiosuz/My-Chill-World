import { Online, Offer, OnlineMember, ChatMessage } from './Online';
import { t } from '../i18n/i18n';

/** Goods players can give and sell each other (and money). */
export const ONLINE_GOODS = ['money', 'food', 'wood', 'stone', 'iron', 'bricks', 'planks', 'coal'] as const;
export type OnlineGood = (typeof ONLINE_GOODS)[number];

/** What the game lets the online world do with the town. */
export interface SyncHost {
  /** How much of a good (or money) the town has. */
  have(good: string): number;
  /** Add (or with a negative amount take) a good or money, written into the books. */
  add(good: string, n: number, reason: string): void;
  toast(msg: string): void;
  event(msg: string): void;
  /** Something changed that the online window shows. */
  changed(): void;
  /** A new message or deal arrived from another player. */
  ping(text: string): void;
}

/** A town's debt to an investor: paid back a part every day. */
export interface OnlineDebt { to: string; city: string; left: number; perDay: number }

const INVEST_BACK = 1.2;
const INVEST_DAYS = 20;

/**
 * One online world while its town is played: the other players' towns, the deals with them (gifts, sales,
 * investments and their repayments) and the chat. Deals move through the server; each side applies its own half
 * exactly once (a deal changes state only if it is still in the state that side saw).
 */
export class OnlineSync {
  me = '';
  members: OnlineMember[] = [];
  offers: Offer[] = [];
  chat: ChatMessage[] = [];
  /** Chat messages not seen yet (shown on the button). */
  unread = 0;
  debts: OnlineDebt[] = [];
  private stop?: () => void;
  private timer = 0;
  private busy = false;
  private disposed = false;
  private started = false;
  private pending = new Set<'offers' | 'chat' | 'members'>();
  private refreshTask: Promise<void> | null = null;
  connection: 'connecting' | 'live' | 'reconnecting' | 'offline' = 'connecting';
  lastSync = 0;
  private reconnect = () => { if (!this.disposed) void this.refresh('all'); };
  private visibility = () => { if (!document.hidden) this.reconnect(); };
  private offline = () => { this.connection = 'offline'; this.host.changed(); };
  private seenChat = 0;
  private chatPrimed = false;
  private accepting = false;
  private paying = false;
  /** The other towns' maps and cards, by player (with their version). */
  private layoutCache = new Map<string, { ver: number; layout: unknown; town: unknown }>();

  constructor(readonly worldId: string, private host: SyncHost, debts: OnlineDebt[] = []) { this.debts = debts; }

  async start() {
    if (this.started || this.disposed) return;
    this.started = true;
    this.me = (await Online.userId()) ?? '';
    if (this.disposed) return;
    if (!this.me) { this.host.toast(t('Online: sign in again from the main menu → Online')); return; }
    await this.refresh('all');
    this.seenChat = this.chat[this.chat.length - 1]?.id ?? 0;
    if (this.disposed) return;
    this.stop = Online.subscribe(this.worldId, (what) => void this.refresh(what), (state) => {
      if (this.disposed) return;
      this.connection = navigator.onLine ? state : 'offline'; this.host.changed();
    });
    window.addEventListener('online', this.reconnect);
    window.addEventListener('offline', this.offline);
    document.addEventListener('visibilitychange', this.visibility);
    // a slow poll as well, in case the live connection drops
    this.timer = window.setInterval(() => { if (!document.hidden && navigator.onLine) void this.refresh('all'); }, 15000);
  }

  dispose() {
    this.disposed = true; this.pending.clear(); this.stop?.(); clearInterval(this.timer);
    window.removeEventListener('online', this.reconnect);
    window.removeEventListener('offline', this.offline);
    document.removeEventListener('visibilitychange', this.visibility);
  }

  name(userId: string) { return this.members.find((m) => m.user_id === userId)?.city_name ?? '?'; }
  online(m: OnlineMember) { return Date.now() - Date.parse(m.last_seen) < 90_000; }
  /** Deals waiting for my answer. */
  get waiting() { return this.offers.filter((o) => o.to_user === this.me && o.status === 'open' && (o.kind === 'sell' || o.kind === 'invest')).length; }

  refresh(what: 'offers' | 'chat' | 'members' | 'all'): Promise<void> {
    if (this.disposed) return Promise.resolve();
    for (const kind of what === 'all' ? ['members', 'chat', 'offers'] as const : [what]) this.pending.add(kind);
    if (!this.refreshTask) this.refreshTask = this.drain().finally(() => { this.refreshTask = null; });
    return this.refreshTask;
  }

  private async drain() {
    while (this.pending.size && !this.disposed) {
      const batch = [...this.pending]; this.pending.clear();
      for (const kind of batch) {
        if (this.disposed) return;
        try { await this.fetch(kind); if (!this.disposed) this.lastSync = Date.now(); }
        catch { if (!this.disposed) { this.connection = navigator.onLine ? 'reconnecting' : 'offline'; this.host.changed(); } }
      }
    }
  }

  private async fetch(what: 'offers' | 'chat' | 'members' | 'all') {
    if (what === 'members' || what === 'all') {
      const members = await Online.members(this.worldId);
      if (this.disposed) return;
      this.members = members;
      // towns whose map or card changed since we last fetched them
      const stale = this.members.filter((m) => m.user_id !== this.me && (m.layout_ver ?? 0) > 0 && (m.layout_ver ?? 0) !== this.layoutCache.get(m.user_id)?.ver).map((m) => m.user_id);
      for (const r of await Online.layouts(this.worldId, stale)) this.layoutCache.set(r.user_id, { ver: r.ver, layout: r.layout, town: r.town });
      for (const m of this.members) {
        const c = this.layoutCache.get(m.user_id);
        if (c) m.summary = { ...m.summary, layout: c.layout as never, town: c.town };
      }
    }
    if (what === 'chat' || what === 'all') {
      const before = this.chat[this.chat.length - 1]?.id ?? 0;
      const messages = await Online.chat(this.worldId);
      if (this.disposed) return;
      this.chat = messages;
      const fresh = this.chat.filter((m) => m.id > Math.max(before, this.seenChat) && m.user_id !== this.me);
      if (fresh.length && this.chatPrimed) { this.unread += fresh.length; this.host.ping(`${fresh[fresh.length - 1].name}: ${fresh[fresh.length - 1].text}`); }
      this.chatPrimed = true;
    }
    if (what === 'offers' || what === 'all') {
      const waitBefore = this.waiting;
      const offers = await Online.offers(this.worldId);
      if (this.disposed) return;
      this.offers = offers;
      await this.settle();
      if (this.waiting > waitBefore) { const o = this.offers.find((x) => x.to_user === this.me && x.status === 'open' && (x.kind === 'sell' || x.kind === 'invest')); if (o) this.host.ping(t('🤝 {city} sent you an offer: open Online → Deals', { city: this.name(o.from_user) })); }
    }
    if (!this.disposed) this.host.changed();
  }

  /** Apply my half of every deal that moved on. */
  private async settle() {
    if (this.busy) return;
    this.busy = true;
    try {
      for (const o of this.offers) {
        const mine = o.from_user === this.me, toMe = o.to_user === this.me;
        // a gift or a repayment to me: take it in
        if (toMe && o.status === 'open' && (o.kind === 'gift' || o.kind === 'repay') && await Online.setOffer(o.id, 'open', 'done')) {
          this.host.add(o.good, o.amount, o.kind === 'repay' ? 'Investments paid back by players' : 'Gifts from players');
          this.host.event(o.kind === 'repay' ? t('{city} paid back ${n} of your investment', { city: this.name(o.from_user), n: o.amount }) : t('{city} sent you a gift: {what}', { city: this.name(o.from_user), what: this.what(o.good, o.amount) }));
          o.status = 'done';
        }
        // my goods were bought: the money comes in
        if (mine && o.kind === 'sell' && o.status === 'accepted' && await Online.setOffer(o.id, 'accepted', 'done')) {
          this.host.add('money', o.price, 'Sales to players');
          this.host.event(t('{city} bought your {what} for ${n}', { city: this.name(o.to_user), what: this.what(o.good, o.amount), n: o.price }));
          o.status = 'done';
        }
        // an investment I made was taken: from now on they pay it back
        if (mine && o.kind === 'invest' && o.status === 'accepted' && await Online.setOffer(o.id, 'accepted', 'done')) {
          this.host.event(t('{city} took your investment of ${n}: they will pay back ${m} over {d} days', { city: this.name(o.to_user), n: o.amount, m: Math.round(o.amount * INVEST_BACK), d: INVEST_DAYS }));
          o.status = 'done';
        }
        // refused: what I sent comes back
        if (mine && o.status === 'declined' && await Online.setOffer(o.id, 'declined', 'cancelled')) {
          this.host.add(o.good, o.amount, 'Deals with players returned');
          this.host.event(t('{city} said no to your offer: {what} came back', { city: this.name(o.to_user), what: this.what(o.good, o.amount) }));
          o.status = 'cancelled';
        }
      }
    } finally { this.busy = false; }
  }

  what(good: string, n: number) { return good === 'money' ? `$${n.toLocaleString('en-US')}` : `${n} ${t(GOOD_LABEL[good] ?? good).toLowerCase()}`; }

  /** Take something out of the stores to send it (or say what is missing). */
  private take(good: string, n: number, reason: string): string | null {
    if (!Number.isSafeInteger(n) || n <= 0 || !ONLINE_GOODS.includes(good as OnlineGood)) return t('Enter an amount');
    if (this.host.have(good) < n) return t('Not enough {what}: you have {n}', { what: t(GOOD_LABEL[good] ?? good).toLowerCase(), n: Math.floor(this.host.have(good)) });
    this.host.add(good, -n, reason);
    return null;
  }

  async gift(to: string, good: string, n: number): Promise<string | null> {
    const e = this.take(good, n, 'Gifts to players');
    if (e) return e;
    const err = await Online.sendOffer({ world_id: this.worldId, to_user: to, kind: 'gift', good, amount: n, price: 0, note: '' });
    if (err) { this.host.add(good, n, 'Deals with players returned'); return err; }
    await this.refresh('offers');
    return null;
  }

  async sell(to: string, good: string, n: number, price: number): Promise<string | null> {
    if (!Number.isSafeInteger(price) || price <= 0) return t('Enter a price');
    const e = this.take(good, n, 'Goods offered to players');
    if (e) return e;
    const err = await Online.sendOffer({ world_id: this.worldId, to_user: to, kind: 'sell', good, amount: n, price: Math.round(price), note: '' });
    if (err) { this.host.add(good, n, 'Deals with players returned'); return err; }
    await this.refresh('offers');
    return null;
  }

  async invest(to: string, n: number): Promise<string | null> {
    const e = this.take('money', n, 'Investments in players\' towns');
    if (e) return e;
    const err = await Online.sendOffer({ world_id: this.worldId, to_user: to, kind: 'invest', good: 'money', amount: n, price: Math.round(n * INVEST_BACK), note: '' });
    if (err) { this.host.add('money', n, 'Deals with players returned'); return err; }
    await this.refresh('offers');
    return null;
  }

  async accept(o: Offer): Promise<string | null> {
    if (this.accepting || o.to_user !== this.me || o.status !== 'open') return t('This offer is no longer open');
    if (!Number.isSafeInteger(o.amount) || o.amount <= 0 || !Number.isSafeInteger(o.price) || o.price <= 0 || !ONLINE_GOODS.includes(o.good as OnlineGood)) return t('Enter an amount');
    this.accepting = true;
    try {
    if (o.kind === 'sell') {
      if (this.host.have('money') < o.price) return t('Not enough money: it costs ${n}', { n: o.price });
      this.host.add('money', -o.price, 'Purchases from players');
      let accepted = false;
      try { accepted = await Online.setOffer(o.id, 'open', 'accepted'); }
      finally { if (!accepted) this.host.add('money', o.price, 'Deals with players returned'); }
      if (!accepted) return t('This offer is no longer open');
      this.host.add(o.good, o.amount, 'Purchases from players');
    } else if (o.kind === 'invest') {
      if (!(await Online.setOffer(o.id, 'open', 'accepted'))) return t('This offer is no longer open');
      this.host.add('money', o.amount, 'Investments from players');
      const left = o.price || Math.round(o.amount * INVEST_BACK);
      this.debts.push({ to: o.from_user, city: this.name(o.from_user), left, perDay: Math.ceil(left / INVEST_DAYS) });
    }
    await this.refresh('offers');
    return null;
    } finally { this.accepting = false; }
  }

  async decline(o: Offer): Promise<string | null> {
    if (!(await Online.setOffer(o.id, 'open', 'declined'))) return t('This offer is no longer open');
    await this.refresh('offers');
    return null;
  }

  /** Take back an offer nobody answered yet: what was sent comes back. */
  async cancel(o: Offer): Promise<string | null> {
    if (!(await Online.setOffer(o.id, 'open', 'cancelled'))) return t('This offer is no longer open');
    this.host.add(o.good, o.amount, 'Deals with players returned');
    await this.refresh('offers');
    return null;
  }

  /** Every morning: a part of each investment is paid back (as much as the treasury allows). */
  async daily() {
    if (this.paying || this.disposed) return;
    this.paying = true;
    try {
    for (const d of this.debts) {
      const n = Math.min(d.left, d.perDay, Math.floor(this.host.have('money')));
      if (n <= 0) continue;
      this.host.add('money', -n, 'Investments paid back to players');
      const err = await Online.sendOffer({ world_id: this.worldId, to_user: d.to, kind: 'repay', good: 'money', amount: n, price: 0, note: '' });
      if (err) { this.host.add('money', n, 'Deals with players returned'); continue; }
      d.left -= n;
    }
    this.debts = this.debts.filter((d) => d.left > 0);
    } finally { this.paying = false; }
  }

  async say(name: string, text: string) {
    const e = await Online.say(this.worldId, name, text.trim());
    if (!e) await this.refresh('chat');
    return e;
  }

  readChat() { this.unread = 0; this.seenChat = this.chat[this.chat.length - 1]?.id ?? this.seenChat; }
}

export const GOOD_LABEL: Record<string, string> = { money: 'Money', food: 'Food', wood: 'Wood', stone: 'Stone', iron: 'Iron', bricks: 'Bricks', planks: 'Planks', coal: 'Coal' };
