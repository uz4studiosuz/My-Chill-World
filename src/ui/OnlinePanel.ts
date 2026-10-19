import { el, icon } from './dom';
import { t } from '../i18n/i18n';
import { OnlineSync, ONLINE_GOODS, GOOD_LABEL } from '../online/OnlineSync';
import { Offer, OnlineMember } from '../online/Online';

type Tab = 'players' | 'deals' | 'chat';

/**
 * The online world in one window: the other players' towns (who is here, who is on autopilot, their figures,
 * gifts, sales and investments to them), the deals waiting for an answer, and the chat.
 */
export class OnlinePanel {
  private root: HTMLDivElement;
  visible = false;
  private tab: Tab = 'players';
  private msg?: { text: string; ok: boolean };
  /** The open "sell / gift" form: for whom. */
  private form = '';
  private last = '';
  private sending = false;
  /** Messages after this one came while the chat was closed. */
  private newFrom = Infinity;

  constructor(parent: HTMLElement, private sync: OnlineSync, private world: string, _code: string, private myName: () => string) {
    this.root = el('div', 'embassy online-panel');
    parent.appendChild(this.root);
  }

  open(tab?: Tab) { if (tab) this.tab = tab; this.visible = true; this.root.classList.add('show'); this.last = ''; this.render(); }
  hide() { this.visible = false; this.root.classList.remove('show'); }
  /** Open on one player with the goods form ready. */
  openFor(userId: string) { this.form = userId; this.open('players'); }
  toggle() { if (this.visible) this.hide(); else this.open(); }

  private flash(text: string | null, okText: string) {
    this.msg = text ? { text, ok: false } : { text: okText, ok: true };
    this.last = '';
    this.render();
  }

  render() {
    if (!this.visible) return;
    const s = this.sync;
    // where the unread messages start (a line shows it), then they count as read
    if (this.tab === 'chat') { if (s.unread) this.newFrom = s.seenChatId; s.readChat(); }
    const key = JSON.stringify([s.members, s.offers, s.chat, s.connection, this.tab, this.form, this.msg?.text]);
    if (key === this.last) return;
    this.last = key;
    const input = this.root.querySelector('.ol-say') as HTMLInputElement | null;
    const draft = input?.value ?? '';
    const typing = document.activeElement === input;
    const selection = input ? [input.selectionStart, input.selectionEnd] : null;
    const scroll = this.root.querySelector('.emb-main');
    const oldScroll = scroll?.scrollTop ?? 0;
    const nearBottom = !scroll || scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 64;
    const formValues = [...this.root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('.ol-form input, .ol-form select')].map(e => e.value);
    const focusedFormIndex = [...this.root.querySelectorAll('.ol-form input, .ol-form select')].indexOf(document.activeElement!);
    this.root.replaceChildren();
    const head = el('div', 'emb-head');
    head.innerHTML = `<span class="emb-ic">${icon('globe')}</span><div><b></b><small></small></div>`;
    (head.querySelector('b') as HTMLElement).textContent = `${t('Online world')} · ${this.world}`;
    const here = s.members.filter((m) => s.online(m)).length;
    (head.querySelector('small') as HTMLElement).textContent = t('{n} of {m} playing now · the same time for everyone · towns of players who are away run on autopilot', { n: here, m: s.members.length });
    const x = el('button', 'info-x');
    x.innerHTML = icon('close');
    x.addEventListener('click', () => this.hide());
    head.appendChild(x);
    const tabs = el('div', 'emb-tabs');
    const others = s.members.filter((m) => m.user_id !== s.me);
    for (const [id, label, n] of [['players', `${t('Players')}`, `${others.length}`], ['deals', `${t('Deals')}`, s.waiting ? `${s.waiting}` : ''], ['chat', `${t('Chat')}`, s.unread ? `${s.unread}` : '']] as [Tab, string, string][]) {
      const b = el('button', `emb-tab${this.tab === id ? ' on' : ''}`);
      b.innerHTML = '<span></span><em></em>';
      (b.querySelector('span') as HTMLElement).textContent = label;
      (b.querySelector('em') as HTMLElement).textContent = n;
      b.addEventListener('click', () => { this.tab = id; this.msg = undefined; this.last = ''; this.render(); });
      tabs.appendChild(b);
    }
    const state = el('div', 'online-status');
    state.dataset.state = s.connection; state.setAttribute('role', 'status');
    state.textContent = t({ connecting: 'Connecting…', live: 'Live connection', reconnecting: 'Reconnecting · your town is safe', offline: 'Offline · reconnecting when available' }[s.connection]);
    this.root.append(head, state, tabs);
    if (this.msg) { const m = el('div', `emb-msg ${this.msg.ok ? 'ok' : 'no'}`); m.textContent = this.msg.text; this.root.appendChild(m); }
    const main = el('div', 'emb-main');
    if (this.tab === 'players') this.players(main, others);
    else if (this.tab === 'deals') this.deals(main);
    else this.chatView(main, draft);
    this.root.appendChild(main);
    const fields = [...this.root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('.ol-form input, .ol-form select')];
    fields.forEach((e, i) => { if (formValues[i] !== undefined) e.value = formValues[i]; });
    if (focusedFormIndex >= 0) fields[focusedFormIndex]?.focus();
    main.scrollTop = oldScroll;
    if (this.tab === 'chat') {
      if (nearBottom) main.scrollTop = main.scrollHeight;
      const inp = this.root.querySelector('.ol-say') as HTMLInputElement | null;
      if (inp && typing) { inp.focus(); inp.setSelectionRange(selection?.[0] ?? inp.value.length, selection?.[1] ?? inp.value.length); }
    }
  }

  // ---------- players ----------

  private players(main: HTMLElement, others: OnlineMember[]) {
    const s = this.sync;
    if (!others.length) {
      const e = el('div', 'emb-empty');
      e.innerHTML = '<b></b><p></p>';
      (e.querySelector('b') as HTMLElement).textContent = t('Nobody else is here yet');
      (e.querySelector('p') as HTMLElement).textContent = t('Ask your friends to choose {server} in Online on the main menu: their towns appear here and on your map.', { server: this.world });
      main.appendChild(e);
      return;
    }
    for (const m of others) {
      const c = el('div', 'ol-player');
      const on = s.online(m);
      const sm = m.summary ?? {};
      c.innerHTML = '<div class="ol-top"><i></i><div><b></b><small></small></div></div><div class="emb-hnums"></div><div class="emb-acts"></div>';
      (c.querySelector('i') as HTMLElement).className = on ? 'on' : 'off';
      (c.querySelector('b') as HTMLElement).textContent = m.city_name;
      (c.querySelector('small') as HTMLElement).textContent = on ? t('playing now') : t('away · the town runs on autopilot');
      const nums = c.querySelector('.emb-hnums') as HTMLElement;
      for (const [k, v] of [[t('People'), `${sm.people ?? 0}`], [t('Treasury'), `$${Math.round(sm.money ?? 0).toLocaleString('en-US')}`], [t('Happiness'), `${sm.happy ?? 0}%`], [t('Level'), ['Village', 'Town', 'City', 'Metropolis'].map((x) => t(x))[sm.level ?? 0] ?? '—']]) {
        const n = el('div', 'emb-num');
        n.innerHTML = '<small></small><b></b>';
        (n.querySelector('small') as HTMLElement).textContent = k;
        (n.querySelector('b') as HTMLElement).textContent = v;
        nums.appendChild(n);
      }
      const acts = c.querySelector('.emb-acts') as HTMLElement;
      const mk = (label: string, fn: () => void, cls = 'btn-mini') => { const b = el('button', cls); b.textContent = label; b.addEventListener('click', fn); acts.appendChild(b); };
      mk(`${t('Gift')} $500`, async () => this.flash(await s.gift(m.user_id, 'money', 500), t('Sent $500 to {city}', { city: m.city_name })));
      mk(`${t('Invest')} $2,000`, async () => this.flash(await s.invest(m.user_id, 2000), t('Offered {city} an investment of $2,000: they pay back $2,400 over 20 days if they take it', { city: m.city_name })));
      mk(`${t('Send or sell goods')}`, () => { this.form = this.form === m.user_id ? '' : m.user_id; this.last = ''; this.render(); }, 'btn-mini ghost');
      if (this.form === m.user_id) c.appendChild(this.goodsForm(m));
      main.appendChild(c);
    }
  }

  /** Choose a good and an amount: give it, or offer it for a price. */
  private goodsForm(m: OnlineMember) {
    const s = this.sync;
    const f = el('div', 'ol-form');
    const sel = document.createElement('select');
    for (const g of ONLINE_GOODS.filter((x) => x !== 'money')) { const o = document.createElement('option'); o.value = g; o.textContent = t(GOOD_LABEL[g]); sel.appendChild(o); }
    const amount = document.createElement('input');
    amount.type = 'number'; amount.min = '1'; amount.value = '50'; amount.placeholder = t('Amount');
    const price = document.createElement('input');
    price.type = 'number'; price.min = '1'; price.value = '200'; price.placeholder = t('Price ($)');
    const lab = (text: string, i: HTMLElement) => { const l = el('label', ''); const sp = el('span', ''); sp.textContent = text; l.append(sp, i); return l; };
    const row = el('div', 'ol-form-row');
    row.append(lab(t('Good'), sel), lab(t('Amount'), amount), lab(t('Price for all ($)'), price));
    const btns = el('div', 'emb-acts');
    const give = el('button', 'btn-mini ghost');
    give.textContent = t('Give it as a gift');
    give.addEventListener('click', async () => this.flash(await s.gift(m.user_id, sel.value, Math.floor(+amount.value)), t('Sent to {city}', { city: m.city_name })));
    const sell = el('button', 'btn-mini');
    sell.textContent = t('Offer it for the price');
    sell.addEventListener('click', async () => this.flash(await s.sell(m.user_id, sel.value, Math.floor(+amount.value), Math.floor(+price.value)), t('Offer sent to {city}: the goods wait until they answer (they come back if they say no)', { city: m.city_name })));
    btns.append(sell, give);
    f.append(row, btns);
    return f;
  }

  // ---------- deals ----------

  private deals(main: HTMLElement) {
    const s = this.sync;
    const label = (o: Offer) => {
      const what = s.what(o.good, o.amount);
      return o.kind === 'sell' ? t('{what} for ${n}', { what, n: o.price }) : o.kind === 'invest' ? t('investment {what} (back: ${n} over 20 days)', { what, n: o.price }) : o.kind === 'repay' ? t('repayment {what}', { what }) : t('gift: {what}', { what });
    };
    const sec = (title: string) => { const h = el('div', 'emb-sec'); h.innerHTML = '<b></b>'; (h.querySelector('b') as HTMLElement).textContent = title; main.appendChild(h); };
    const incoming = s.offers.filter((o) => o.to_user === s.me && o.status === 'open' && (o.kind === 'sell' || o.kind === 'invest'));
    const outgoing = s.offers.filter((o) => o.from_user === s.me && o.status === 'open' && (o.kind === 'sell' || o.kind === 'invest'));
    sec(t('Waiting for your answer'));
    if (!incoming.length) { const e = el('div', 'rp-note'); e.textContent = t('Nothing waiting.'); main.appendChild(e); }
    for (const o of incoming) {
      const r = el('div', 'ol-deal');
      r.innerHTML = '<div><b></b><small></small></div><span></span>';
      (r.querySelector('b') as HTMLElement).textContent = `${s.name(o.from_user)}: ${label(o)}`;
      (r.querySelector('small') as HTMLElement).textContent = o.kind === 'sell' ? t('If you accept, you pay ${n} and the goods are yours at once', { n: o.price }) : t('If you accept, you get the money now and pay a part back every day');
      const act = r.querySelector('span') as HTMLElement;
      const yes = el('button', 'btn-mini'); yes.textContent = t('Accept');
      yes.addEventListener('click', async () => this.flash(await s.accept(o), t('Done!')));
      const no = el('button', 'btn-mini ghost'); no.textContent = t('Decline');
      no.addEventListener('click', async () => this.flash(await s.decline(o), t('Declined')));
      act.append(yes, no);
      main.appendChild(r);
    }
    sec(t('Sent by you, not answered yet'));
    if (!outgoing.length) { const e = el('div', 'rp-note'); e.textContent = t('Nothing waiting.'); main.appendChild(e); }
    for (const o of outgoing) {
      const r = el('div', 'ol-deal');
      r.innerHTML = '<div><b></b><small></small></div><span></span>';
      (r.querySelector('b') as HTMLElement).textContent = `→ ${s.name(o.to_user)}: ${label(o)}`;
      (r.querySelector('small') as HTMLElement).textContent = t('Taking it back returns what you sent');
      const b = el('button', 'btn-mini ghost'); b.textContent = t('Take back');
      b.addEventListener('click', async () => this.flash(await s.cancel(o), t('Taken back')));
      (r.querySelector('span') as HTMLElement).appendChild(b);
      main.appendChild(r);
    }
    if (s.debts.length) {
      sec(t('We pay back'));
      for (const d of s.debts) { const e = el('div', 'rp-note'); e.textContent = t('{city}: ${n} left, ${m} a day', { city: d.city, n: d.left, m: d.perDay }); main.appendChild(e); }
    }
    sec(t('History'));
    const done = s.offers.filter((o) => o.status !== 'open').slice(0, 25);
    if (!done.length) { const e = el('div', 'rp-note'); e.textContent = t('No deals yet.'); main.appendChild(e); }
    for (const o of done) {
      const r = el('div', 'ol-hist');
      const dir = o.from_user === s.me ? `→ ${s.name(o.to_user)}` : `← ${s.name(o.from_user)}`;
      const st = { done: t('done'), cancelled: t('returned'), declined: t('declined'), accepted: t('accepted'), open: '' }[o.status];
      r.textContent = `${dir} · ${label(o)} · ${st}`;
      main.appendChild(r);
    }
  }

  // ---------- chat ----------

  private chatView(main: HTMLElement, draft: string) {
    const s = this.sync;
    const list = el('div', 'ol-chat');
    if (!s.chat.length) { const e = el('div', 'rp-note'); e.textContent = t('No messages yet. Say hello!'); list.appendChild(e); }
    let line = false;
    for (const m of s.chat) {
      if (!line && m.id > this.newFrom && m.user_id !== s.me) {
        line = true;
        const sep = el('div', 'ol-new');
        sep.textContent = t('New messages');
        list.appendChild(sep);
      }
      const r = el('div', `ol-msg${m.user_id === s.me ? ' me' : ''}`);
      r.innerHTML = '<b></b><span></span><small></small>';
      (r.querySelector('b') as HTMLElement).textContent = m.name;
      (r.querySelector('span') as HTMLElement).textContent = m.text;
      (r.querySelector('small') as HTMLElement).textContent = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      list.appendChild(r);
    }
    const bar = el('div', 'ol-chatbar');
    const inp = document.createElement('input');
    inp.className = 'ol-say';
    inp.maxLength = 300;
    inp.placeholder = t('Write a message…');
    inp.setAttribute('aria-label', t('Write a message…'));
    inp.value = draft;
    const send = el('button', 'btn-mini');
    send.textContent = t('Send');
    send.disabled = this.sending; inp.disabled = this.sending;
    const go = async () => {
      const original = inp.value;
      const text = original.trim();
      if (!text || this.sending) return;
      this.sending = true; send.disabled = true; inp.disabled = true;
      try {
        const error = await s.say(this.myName(), text);
        if (error) { this.flash(error, ''); return; }
        const current = this.root.querySelector<HTMLInputElement>('.ol-say');
        if (current && current.value === original) current.value = '';
      } catch { this.flash(t('Message not sent. Please try again.'), ''); }
      finally { this.sending = false; this.last = ''; this.render(); }
      this.root.querySelector<HTMLInputElement>('.ol-say')?.focus();
    };
    send.addEventListener('click', () => void go());
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); void go(); } });
    bar.append(inp, send);
    const note = el('small', 'ol-chatnote');
    note.textContent = t('Messages are deleted after 24 hours (the last 200 are kept).');
    main.append(list, bar, note);
  }
}
