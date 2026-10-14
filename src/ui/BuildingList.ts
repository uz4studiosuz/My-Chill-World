import { el, icon } from './dom';
import { t } from '../i18n/i18n';

export interface BuildingListItem {
  id: number;
  name: string;
  badge: string;
  tint: string;
  group: string;
  /** Short state: staff, under construction, no power… */
  info: string;
  bad?: boolean;
}

/** Every building of your town in one list: tap one and the camera flies there. */
export class BuildingList {
  private root: HTMLDivElement;
  private body: HTMLDivElement;
  private filter = '';
  private group = '';
  private chips: HTMLDivElement;
  visible = false;

  constructor(parent: HTMLElement, private items: () => BuildingListItem[], private go: (id: number) => void) {
    this.root = el('div', 'goals eventlog blist');
    const head = el('div', 'stats-head');
    const title = el('b', '');
    title.textContent = t('All buildings');
    const close = el('button', 'info-x');
    close.innerHTML = icon('close');
    close.setAttribute('aria-label', t('Close'));
    close.addEventListener('click', () => this.hide());
    head.append(title, close);
    const search = el('input', 'log-search') as HTMLInputElement;
    search.placeholder = t('Search buildings…');
    search.addEventListener('input', () => { this.filter = search.value.toLowerCase(); this.render(); });
    search.addEventListener('keydown', (e) => e.stopPropagation());
    this.chips = el('div', 'blist-chips');
    this.body = el('div', 'goals-body');
    this.root.append(head, search, this.chips, this.body);
    parent.appendChild(this.root);
  }

  toggle() {
    if (this.visible) this.hide();
    else this.show();
  }

  show() {
    this.visible = true;
    this.root.classList.add('show');
    this.render();
  }

  hide() {
    this.visible = false;
    this.root.classList.remove('show');
  }

  dispose() {
    this.root.remove();
  }

  private render() {
    const all = this.items();
    // a chip for every group, with how many buildings are in it
    const groups = new Map<string, number>();
    for (const it of all) groups.set(it.group, (groups.get(it.group) ?? 0) + 1);
    if (this.group && !groups.has(this.group)) this.group = '';
    this.chips.replaceChildren();
    for (const [g, n] of [['', all.length] as [string, number], ...groups.entries()]) {
      const b = el('button', `blist-chip${g === this.group ? ' active' : ''}`);
      b.textContent = `${g ? t(g) : t('All')} ${n}`;
      b.addEventListener('click', () => { this.group = g; this.render(); });
      this.chips.appendChild(b);
    }
    const list = all.filter((it) => (!this.group || it.group === this.group) && (!this.filter || it.name.toLowerCase().includes(this.filter) || t(it.group).toLowerCase().includes(this.filter)));
    const scroll = this.body.scrollTop;
    this.body.replaceChildren();
    if (!list.length) {
      const empty = el('div', 'goals-sum');
      empty.textContent = t('No buildings found');
      this.body.appendChild(empty);
      return;
    }
    let last = '';
    for (const it of list) {
      if (it.group !== last && !this.group) {
        last = it.group;
        const h = el('div', 'log-day');
        h.textContent = t(it.group);
        this.body.appendChild(h);
      }
      const row = el('button', 'blist-row');
      const badge = el('span', 'blist-badge');
      badge.textContent = it.badge;
      badge.style.background = it.tint;
      const name = el('span', 'blist-name');
      name.textContent = it.name;
      const info = el('span', `blist-info${it.bad ? ' bad' : ''}`);
      info.textContent = it.info;
      const go = el('span', 'blist-go');
      go.innerHTML = icon('follow');
      row.append(badge, name, info, go);
      row.addEventListener('click', () => { this.hide(); this.go(it.id); });
      this.body.appendChild(row);
    }
    this.body.scrollTop = scroll;
  }
}
