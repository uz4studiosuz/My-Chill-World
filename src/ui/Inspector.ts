import { pager } from './CityReport';
import { el, icon, IconName, hoverBusy } from './dom';
import { t } from '../i18n/i18n';

export interface InspectorBar { label: string; value: number; color: string; text?: string }
export interface InspectorPerson { id: number; icon: string; name: string; detail: string; warn?: boolean; onClick?: () => void }
export interface InspectorAction { label: string; icon?: IconName; active?: boolean; onClick: () => void }

export interface InspectorView {
  /** Identity of what's shown — keeps scroll position while refreshing the same thing. */
  key: string;
  badge: string;
  badgeColor: string;
  title: string;
  subtitle: string;
  bars?: InspectorBar[];
  rows?: [string, string, ('good' | 'bad')?][];
  /** Extra titled blocks of rows (city overview). */
  sections?: { title: string; rows: [string, string, ('good' | 'bad')?][] }[];
  tags?: { text: string; tone: 'good' | 'bad' | 'info' }[];
  listTitle?: string;
  people?: InspectorPerson[];
  actions?: InspectorAction[];
  /** A person's ID card, drawn like a passport page. */
  passport?: Passport;
  /** A bus seen from above: the driver and who sits in each seat (tap one to open them). */
  seats?: { total: number; driver: string; riders: { id: number; name: string; icon: string; to: string }[] };
}

export interface Passport {
  /** Issuing town and its colour. */
  town: string;
  tint: string;
  photo: { skin: string; cloth: string; hair: string; female: boolean };
  surname: string;
  name: string;
  sex: string;
  birth: string;
  birthplace: string;
  number: string;
  mrz: [string, string];
}

/** A person's ID card, drawn like a passport page (also used by the passport desk). */
export function passportCard(p: Passport): HTMLElement {
  const card = el('div', 'passport');
  card.style.setProperty('--pp', p.tint);
  const top = el('div', 'pp-top');
  top.innerHTML = `<span>${t('ID card')}</span><b></b>`;
  (top.querySelector('b') as HTMLElement).textContent = p.town;
  const body = el('div', 'pp-body');
  const photo = el('div', 'pp-photo');
  photo.innerHTML = portrait(p.photo);
  const fields = el('div', 'pp-fields');
  const field = (label: string, value: string, wide = false) => {
    const f = el('div', `pp-f${wide ? ' wide' : ''}`);
    const l = el('small', '');
    l.textContent = label;
    const val = el('b', '');
    val.textContent = value;
    f.append(l, val);
    fields.appendChild(f);
  };
  field(t('Surname'), p.surname, true);
  field(t('Given name'), p.name, true);
  field(t('Sex'), p.sex);
  field(t('Date of birth'), p.birth);
  field(t('Place of birth'), p.birthplace, true);
  field(t('Document No.'), p.number, true);
  const stamp = el('div', 'pp-stamp');
  stamp.textContent = p.town;
  body.append(photo, fields, stamp);
  const sign = el('div', 'pp-sign');
  sign.innerHTML = `<small>${t('Signature')}</small><i></i>`;
  (sign.querySelector('i') as HTMLElement).textContent = `${p.name} ${p.surname}`;
  const mrz = el('div', 'pp-mrz');
  mrz.textContent = `${p.mrz[0]}\n${p.mrz[1]}`;
  card.append(top, body, sign, mrz);
  return card;
}

/** A small portrait in the person's own colours. */
function portrait(p: Passport['photo']) {
  const hair = p.female
    ? `<path d="M22 30c0-14 9-21 18-21s18 7 18 21v22h-7V32H29v20h-7z" fill="${p.hair}"/>`
    : `<path d="M25 28c0-11 7-17 15-17s15 6 15 17v3h-4c0-6-3-9-11-9s-11 3-11 9h-4z" fill="${p.hair}"/>`;
  return `<svg viewBox="0 0 80 96" xmlns="http://www.w3.org/2000/svg">
    <rect width="80" height="96" fill="#dfe6ee"/>
    <path d="M10 96c2-20 14-28 30-28s28 8 30 28z" fill="${p.cloth}"/>
    <rect x="34" y="52" width="12" height="14" fill="${p.skin}"/>
    <rect x="27" y="22" width="26" height="34" rx="11" fill="${p.skin}"/>
    ${hair}
    <rect x="33" y="36" width="4" height="4" rx="1" fill="#26292e"/><rect x="43" y="36" width="4" height="4" rx="1" fill="#26292e"/>
    <rect x="36" y="47" width="8" height="2" rx="1" fill="#9b5a4a"/>
  </svg>`;
}

/** Side panel describing the selected person or building, styled like a game inspector. */
export class Inspector {
  private root: HTMLDivElement;
  private key = '';

  constructor(parent: HTMLElement, private onClose: () => void, private onPerson: (id: number) => void) {
    this.root = el('div', 'inspector');
    this.root.addEventListener('scroll', () => { if (this.root.scrollTop > 0) this.savedPanelScroll = this.root.scrollTop; }, { passive: true });
    parent.appendChild(this.root);
  }

  private sig = '';
  private savedPanelScroll = 0;
  private savedListScroll = 0;
  private page = 0;

  /** The bus from above: the driver at the front, then rows of two seats, an aisle and two more. */
  private seatPlan(s: NonNullable<InspectorView['seats']>) {
    const bus = el('div', 'bus-plan');
    const front = el('div', 'bp-front');
    front.innerHTML = '<span class="bp-wheel">🛞</span><span class="bp-drv"></span><span class="bp-door"></span>';
    (front.querySelector('.bp-drv') as HTMLElement).textContent = s.driver;
    (front.querySelector('.bp-door') as HTMLElement).textContent = t('Door');
    const grid = el('div', 'bp-grid');
    for (let i = 0; i < s.total; i++) {
      const r = s.riders[i];
      const seat = el('button', `bp-seat${r ? ' taken' : ''}`);
      // two seats, the aisle, two seats
      if (i % 4 === 2) seat.classList.add('after-aisle');
      if (r) {
        seat.innerHTML = '<i></i><small></small>';
        (seat.querySelector('i') as HTMLElement).textContent = r.icon;
        (seat.querySelector('small') as HTMLElement).textContent = r.name;
        seat.title = `${r.name} → ${r.to}`;
        seat.addEventListener('click', () => this.onPerson(r.id));
      } else {
        seat.disabled = true;
        seat.title = t('Free seat');
      }
      grid.appendChild(seat);
    }
    const foot = el('div', 'bp-foot');
    foot.textContent = t('{n} of {m} seats taken', { n: s.riders.length, m: s.total });
    bus.append(front, grid, foot);
    return bus;
  }

  show(v: InspectorView) {
    // nothing changed: keep the DOM (and the buttons under the cursor) as they are
    const sig = JSON.stringify(v);
    if (v.key === this.key && sig === this.sig && this.root.classList.contains('show')) return;
    if (v.key === this.key && this.root.classList.contains('show') && hoverBusy(this.root)) return;
    this.sig = sig;
    const list = this.root.querySelector('.ins-list') as HTMLDivElement | null;
    const same = v.key === this.key;
    const scroll = same && list ? (list.scrollTop || this.savedListScroll) : 0;
    const panelScroll = same ? (this.root.scrollTop || this.savedPanelScroll) : 0;
    this.key = v.key;
    this.root.replaceChildren();

    const head = el('div', 'ins-head');
    const badge = el('div', 'ins-badge');
    badge.textContent = v.badge;
    badge.style.background = v.badgeColor;
    const titles = el('div', 'ins-titles');
    const h = el('b', '');
    h.textContent = v.title;
    const sub = el('small', '');
    sub.textContent = v.subtitle;
    titles.append(h, sub);
    const x = el('button', 'info-x');
    x.innerHTML = icon('close');
    x.setAttribute('aria-label', t('Close'));
    x.addEventListener('click', this.onClose);
    head.append(badge, titles, x);
    this.root.appendChild(head);

    if (v.passport) this.root.appendChild(passportCard(v.passport));
    if (v.seats) this.root.appendChild(this.seatPlan(v.seats));

    if (v.tags?.length) {
      const tags = el('div', 'ins-tags');
      for (const tg of v.tags) {
        const s = el('span', `ins-tag ${tg.tone}`);
        s.textContent = tg.text;
        tags.appendChild(s);
      }
      this.root.appendChild(tags);
    }

    if (v.bars?.length) {
      const bars = el('div', 'ins-bars');
      for (const b of v.bars) {
        const row = el('div', 'ins-bar');
        const label = el('div', 'ins-bar-label');
        label.innerHTML = `<span></span><span></span>`;
        (label.children[0] as HTMLElement).textContent = b.label;
        (label.children[1] as HTMLElement).textContent = b.text ?? `${Math.round(b.value * 100)}%`;
        const track = el('div', 'ins-track');
        const fill = el('i', '');
        fill.style.width = `${Math.max(0, Math.min(1, b.value)) * 100}%`;
        fill.style.background = b.color;
        track.appendChild(fill);
        row.append(label, track);
        bars.appendChild(row);
      }
      this.root.appendChild(bars);
    }

    const blocks = [...(v.rows?.length ? [{ title: '', rows: v.rows }] : []), ...(v.sections ?? [])];
    for (const sec of blocks) {
      if (sec.title) {
        const st = el('div', 'ins-section');
        st.textContent = sec.title;
        this.root.appendChild(st);
      }
      const grid = el('div', 'ins-grid');
      for (const [k, val, tone] of sec.rows) {
        const a = el('span', 'k');
        a.textContent = k;
        const b = el('span', `v ${tone ?? ''}`);
        b.textContent = val;
        grid.append(a, b);
      }
      this.root.appendChild(grid);
    }

    if (v.people?.length) {
      if (v.listTitle) {
        const lt = el('div', 'ins-section');
        lt.textContent = v.listTitle;
        this.root.appendChild(lt);
      }
      const l = el('div', 'ins-list');
      // 10 people a page
      const pages = Math.ceil(v.people.length / 10);
      if (!same) this.page = 0;
      this.page = Math.min(this.page, pages - 1);
      for (const p of v.people.slice(this.page * 10, this.page * 10 + 10)) {
        const row = el('button', `person${p.warn ? ' warn' : ''}`);
        const ic = el('span', 'pic');
        ic.textContent = p.icon;
        const txt = el('div', '');
        const n = el('b', '');
        n.textContent = p.name;
        const d = el('small', '');
        d.textContent = p.detail;
        txt.append(n, d);
        row.append(ic, txt);
        row.addEventListener('click', () => (p.onClick ? p.onClick() : this.onPerson(p.id)));
        l.appendChild(row);
      }
      this.root.appendChild(l);
      if (pages > 1) this.root.appendChild(pager(this.page, pages, v.people.length, (pg) => { this.page = pg; this.sig = ''; this.show(v); }));
      l.addEventListener('scroll', () => { if (l.scrollTop > 0) this.savedListScroll = l.scrollTop; }, { passive: true });
      l.scrollTop = scroll;
      requestAnimationFrame(() => { if (scroll > 0) l.scrollTop = scroll; });
    }

    if (v.actions?.length) {
      const acts = el('div', 'ins-actions');
      for (const a of v.actions) {
        const b = el('button', `chipbtn${a.active ? ' active' : ''}`);
        b.innerHTML = (a.icon ? icon(a.icon) : '') + `<span>${a.label}</span>`;
        b.addEventListener('click', a.onClick);
        acts.appendChild(b);
      }
      this.root.appendChild(acts);
    }
    this.root.classList.add('show');
    this.root.scrollTop = panelScroll;
    requestAnimationFrame(() => { if (panelScroll > 0) this.root.scrollTop = panelScroll; });
  }

  hide() {
    this.key = '';
    this.sig = '';
    this.root.classList.remove('show');
  }
}
