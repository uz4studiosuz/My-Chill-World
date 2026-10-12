import { el, icon, IconName } from './dom';
import { t } from '../i18n/i18n';

export interface InspectorBar { label: string; value: number; color: string; text?: string }
export interface InspectorPerson { id: number; icon: string; name: string; detail: string; warn?: boolean }
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
}

/** Side panel describing the selected person or building, styled like a game inspector. */
export class Inspector {
  private root: HTMLDivElement;
  private key = '';

  constructor(parent: HTMLElement, private onClose: () => void, private onPerson: (id: number) => void) {
    this.root = el('div', 'inspector');
    parent.appendChild(this.root);
  }

  show(v: InspectorView) {
    const list = this.root.querySelector('.ins-list') as HTMLDivElement | null;
    const scroll = v.key === this.key && list ? list.scrollTop : 0;
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
      for (const p of v.people) {
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
        row.addEventListener('click', () => this.onPerson(p.id));
        l.appendChild(row);
      }
      this.root.appendChild(l);
      l.scrollTop = scroll;
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
  }

  hide() {
    this.key = '';
    this.root.classList.remove('show');
  }
}
