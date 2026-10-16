import { el, icon } from './dom';
import { t } from '../i18n/i18n';

/** One person on the family tree (alive, or remembered in the town's records). */
export interface TreePerson {
  id: number;
  name: string;
  surname: string;
  sex: 'm' | 'f';
  age: number;
  alive: boolean;
  /** "Doctor", "Retired", "† 1998", "moved away"… */
  note: string;
  famous?: string;
}

export interface TreeHost {
  person(id: number): TreePerson | null;
  parents(id: number): number[];
  spouse(id: number): number | null;
  children(id: number): number[];
  show(id: number): void;
}

/**
 * The family tree: grandparents, parents, the person with the spouse, brothers and sisters, children and
 * grandchildren. Tap anyone to put them in the middle; the living can be shown on the map.
 */
export class FamilyTree {
  private back: HTMLDivElement;
  private focus = -1;

  constructor(private parent: HTMLElement, private host: TreeHost) {
    this.back = el('div', 'ft-back');
    this.back.addEventListener('click', (e) => { if (e.target === this.back) this.hide(); });
  }

  open(id: number) {
    this.focus = id;
    if (!this.back.parentElement) this.parent.appendChild(this.back);
    this.back.classList.add('show');
    this.render();
  }

  hide() { this.back.classList.remove('show'); }

  private card(id: number, cls = '') {
    const p = this.host.person(id);
    const c = el('button', `ft-card ${cls}${p && !p.alive ? ' dead' : ''}${p?.sex === 'f' ? ' f' : ''}`);
    if (!p) { c.textContent = '?'; c.disabled = true; return c; }
    c.innerHTML = '<span class="ft-av"></span><b></b><small></small>';
    (c.querySelector('.ft-av') as HTMLElement).textContent = p.age < 18 ? (p.sex === 'm' ? '👦' : '👧') : p.age >= 65 ? (p.sex === 'm' ? '👴' : '👵') : (p.sex === 'm' ? '👨' : '👩');
    (c.querySelector('b') as HTMLElement).textContent = `${p.name} ${p.surname}`;
    (c.querySelector('small') as HTMLElement).textContent = `${p.alive ? t('{n} years', { n: p.age }) : ''}${p.alive ? ' · ' : ''}${p.note}${p.famous ? ` · ⭐ ${p.famous}` : ''}`;
    c.addEventListener('click', () => { this.focus = id; this.render(); });
    return c;
  }

  private row(label: string, ids: number[], cls = '') {
    const r = el('div', 'ft-row');
    const l = el('div', 'ft-label');
    l.textContent = label;
    const list = el('div', 'ft-list');
    if (!ids.length) { const e = el('span', 'ft-none'); e.textContent = '—'; list.appendChild(e); }
    for (const id of ids) list.appendChild(this.card(id, cls));
    r.append(l, list);
    return r;
  }

  private render() {
    const h = this.host;
    const me = h.person(this.focus);
    this.back.replaceChildren();
    const box = el('div', 'ft-box');
    const head = el('div', 'ft-head');
    head.innerHTML = `<span class="ft-ic">🌳</span><div><b></b><small></small></div>`;
    (head.querySelector('b') as HTMLElement).textContent = t('Family tree');
    (head.querySelector('small') as HTMLElement).textContent = me ? `${me.name} ${me.surname}` : '';
    const x = el('button', 'info-x');
    x.innerHTML = icon('close');
    x.addEventListener('click', () => this.hide());
    head.appendChild(x);
    box.appendChild(head);
    if (!me) { this.back.appendChild(box); return; }
    const parents = h.parents(this.focus);
    const grand = parents.flatMap((p) => h.parents(p));
    const siblings = [...new Set(parents.flatMap((p) => h.children(p)))].filter((id) => id !== this.focus);
    const spouse = h.spouse(this.focus);
    const kids = h.children(this.focus);
    const grandkids = kids.flatMap((k) => h.children(k));
    const body = el('div', 'ft-body');
    body.append(
      this.row(t('Grandparents'), grand),
      this.row(t('Parents'), parents),
    );
    const mid = el('div', 'ft-row ft-mid');
    const ml = el('div', 'ft-label');
    ml.textContent = t('Here');
    const mlist = el('div', 'ft-list');
    mlist.appendChild(this.card(this.focus, 'me'));
    if (spouse !== null) { const ring = el('span', 'ft-ring'); ring.textContent = '💍'; mlist.append(ring, this.card(spouse)); }
    mid.append(ml, mlist);
    body.append(mid, this.row(t('Brothers and sisters'), siblings), this.row(t('Children'), kids), this.row(t('Grandchildren'), grandkids));
    box.appendChild(body);
    if (me.alive) {
      const acts = el('div', 'ft-acts');
      const b = el('button', 'btn-mini');
      b.textContent = t('Show on the map');
      b.addEventListener('click', () => { this.hide(); h.show(this.focus); });
      acts.appendChild(b);
      box.appendChild(acts);
    }
    this.back.appendChild(box);
  }
}
