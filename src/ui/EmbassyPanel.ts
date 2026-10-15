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

export interface EmbassyHost {
  data(): { towns: EmbassyTown[]; options: EmbassyOption[]; money: number; total: number };
  propose(town: number, kind: string): void;
  gift(town: number, money: number): void;
  trade(): void;
  show(buildingId: number): void;
}

const CATS: [string, string][] = [['business', 'Business'], ['production', 'Industry'], ['services', 'Services'], ['buildings', 'Town']];

/**
 * The embassy: one wide window for the diplomacy with every neighbour town — friendship, the joint projects and
 * what they earn, a catalogue of workplaces to build together (half the cost, half the profit, their workers),
 * gifts and contracts.
 */
export class EmbassyPanel {
  private root: HTMLDivElement;
  visible = false;
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
    const key = JSON.stringify([d, this.town, this.cat]);
    if (key === this.last) return;
    this.last = key;
    if (!d.towns.some((x) => x.id === this.town)) this.town = d.towns[0]?.id ?? -1;
    const scroll = (this.root.querySelector('.emb-main') as HTMLElement | null)?.scrollTop ?? 0;
    this.root.replaceChildren();
    const head = el('div', 'emb-head');
    head.innerHTML = `<span class="emb-ic">${icon('globe')}</span><div><b></b><small></small></div>`;
    (head.querySelector('b') as HTMLElement).textContent = t('Embassy');
    (head.querySelector('small') as HTMLElement).textContent = t('Joint projects: you pay half, they build and staff it, the profit is shared equally') + ` · ${t('Treasury')} $${Math.round(d.money).toLocaleString('en-US')} · ${t('Joint profit yesterday')} $${Math.round(d.total).toLocaleString('en-US')}`;
    const x = el('button', 'info-x');
    x.innerHTML = icon('close');
    x.setAttribute('aria-label', t('Close'));
    x.addEventListener('click', () => this.hide());
    head.appendChild(x);
    const wrap = el('div', 'emb-wrap');
    // the towns
    const side = el('div', 'emb-towns');
    for (const tw of d.towns) {
      const b = el('button', `emb-town${tw.id === this.town ? ' active' : ''}`);
      b.innerHTML = '<i></i><div><b></b><small></small><span class="emb-rel"><em></em></span></div>';
      (b.querySelector('i') as HTMLElement).style.background = tw.tint;
      (b.querySelector('b') as HTMLElement).textContent = tw.name;
      (b.querySelector('small') as HTMLElement).textContent = `${t(tw.friendship)} · ${t('{n} joint', { n: tw.joint.length })}`;
      const em = b.querySelector('em') as HTMLElement;
      em.style.width = `${Math.round(tw.relation)}%`;
      em.style.background = tw.relation >= 50 ? '#7be08f' : tw.relation >= 30 ? '#f2b33d' : '#ff7a6e';
      b.addEventListener('click', () => { this.town = tw.id; this.render(); });
      side.appendChild(b);
    }
    if (!d.towns.length) { const e = el('div', 'rp-note'); e.textContent = t('No neighbour towns yet.'); side.appendChild(e); }
    const main = el('div', 'emb-main');
    const tw = d.towns.find((x) => x.id === this.town);
    if (tw) this.townView(main, tw, d.options);
    wrap.append(side, main);
    this.root.append(head, wrap);
    main.scrollTop = scroll;
  }

  private townView(main: HTMLElement, tw: EmbassyTown, options: EmbassyOption[]) {
    const sec = (text: string) => { const s = el('div', 'emb-sec'); s.textContent = text; main.appendChild(s); };
    // the town at a glance
    const card = el('div', 'emb-card');
    card.style.borderColor = tw.tint;
    card.innerHTML = `<div class="emb-flag"></div><div class="emb-title"><b></b><small></small></div><div class="emb-kpis"></div>`;
    (card.querySelector('.emb-flag') as HTMLElement).style.background = `linear-gradient(135deg, ${tw.tint}, #1c2128)`;
    (card.querySelector('b') as HTMLElement).textContent = tw.name;
    (card.querySelector('small') as HTMLElement).textContent = `${t(tw.style ?? 'Autonomous town')} · ${t(tw.friendship)}`;
    const kp = card.querySelector('.emb-kpis') as HTMLElement;
    for (const [k, v, tone] of [[t('Relations'), `${Math.round(tw.relation)}/100`, tw.relation >= 50], [t('People'), tw.people.toLocaleString('en-US')], [t('Treasury'), `$${Math.round(tw.money).toLocaleString('en-US')}`],
      [t('Happiness'), `${Math.round(tw.happiness)}%`], [t('Joint projects'), `${tw.joint.length}`], [t('Contracts'), `${tw.contracts}`]] as [string, string, boolean?][]) {
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
    // the joint projects with this town
    sec(t('Our joint projects in {city}', { city: tw.name }));
    const jl = el('div', 'emb-joint');
    if (!tw.joint.length) { const e = el('div', 'rp-note'); e.textContent = t('None yet — pick a workplace below and propose it.'); jl.appendChild(e); }
    for (const j of tw.joint) {
      const r = el('button', 'emb-jrow');
      const th = this.thumbs.get(j.kind);
      r.innerHTML = `<i></i><div><b></b><small></small></div><span></span>`;
      if (th) (r.querySelector('i') as HTMLElement).style.backgroundImage = `url(${th})`;
      (r.querySelector('b') as HTMLElement).textContent = j.name;
      (r.querySelector('small') as HTMLElement).textContent = j.building ? t('being built') : `${t('Workers')} ${j.workers}`;
      const p = r.querySelector('span') as HTMLElement;
      p.textContent = j.building ? '🏗' : `+$${j.profit}/${t('day')}`;
      p.className = j.profit > 0 ? 'pos' : '';
      r.addEventListener('click', () => this.host.show(j.id));
      jl.appendChild(r);
    }
    main.appendChild(jl);
    // what to build together
    sec(t('Propose a joint project'));
    const how = el('div', 'emb-how');
    [['1', t('Pick a workplace below'), t('★ = they want it: they almost always agree')], ['2', t('They decide'), t('the % on the card is their yes')],
      ['3', t('They build it'), t('on their land, with their builders')], ['4', t('Profit shared'), t('their people work; half the profit is yours every day')]].forEach(([n, a, b]) => {
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
    const grid = el('div', 'emb-grid');
    const list = options.filter((o) => o.cat === this.cat).sort((a, b) => Number(tw.wants.includes(b.kind)) - Number(tw.wants.includes(a.kind)) || a.half - b.half);
    for (const o of list) {
      const want = tw.wants.includes(o.kind);
      const b = el('button', `emb-opt${want ? ' want' : ''}`);
      const th = this.thumbs.get(o.kind);
      b.innerHTML = `<i></i><b></b><small></small><span class="emb-why"></span><div class="emb-yes"><i></i><span></span></div><em></em>`;
      if (th) (b.querySelector('i') as HTMLElement).style.backgroundImage = `url(${th})`;
      (b.querySelector('b') as HTMLElement).textContent = o.name;
      (b.querySelector('small') as HTMLElement).textContent = `${t('you pay')} $${o.half.toLocaleString('en-US')} · ${t('{n} jobs for them', { n: o.jobs })}`;
      (b.querySelector('em') as HTMLElement).textContent = want ? `★ ${t('they want it')}` : '';
      (b.querySelector('.emb-why') as HTMLElement).textContent = tw.why[o.kind] ?? '';
      const ch = Math.round((tw.chance[o.kind] ?? 0) * 100);
      const bar = b.querySelector('.emb-yes i') as HTMLElement;
      bar.style.width = `${ch}%`;
      bar.style.background = ch >= 70 ? '#7be08f' : ch >= 40 ? '#f2b33d' : '#ff7a6e';
      (b.querySelector('.emb-yes span') as HTMLElement).textContent = t('{n}% yes', { n: ch });
      b.addEventListener('click', () => this.host.propose(tw.id, o.kind));
      grid.appendChild(b);
    }
    main.appendChild(grid);
    const n = el('div', 'rp-note');
    n.textContent = t('They decide: friends say yes more often, and what they want (★) almost always. They build it on their land with their builders and staff it with their people; their town hall takes the taxes and every day half of the profit comes to you.');
    main.appendChild(n);
  }
}
