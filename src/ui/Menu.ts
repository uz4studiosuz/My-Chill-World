import { SaveStore, WorldMeta } from '../save/SaveStore';
import { el, icon, IconName } from './dom';
import { Lang, getLang, setLang, t } from '../i18n/i18n';

export interface MenuHandlers {
  newWorld: (name: string, seed: number) => void;
  loadWorld: (id: string) => void;
  resume: () => void;
  save: () => void;
  exitToMenu: () => void;
  openGallery: (from: 'main' | 'pause') => void;
  languageChanged: () => void;
}

/** Main menu, new-world form, world list and the in-game pause menu. */
export class Menu {
  private root: HTMLDivElement;
  private panel: HTMLDivElement;

  constructor(parent: HTMLElement, private h: MenuHandlers) {
    this.root = el('div', 'menu');
    this.panel = el('div', 'panel');
    this.root.appendChild(this.panel);
    parent.appendChild(this.root);
  }

  hide() {
    this.root.classList.remove('show');
  }

  showMain() {
    const worlds = SaveStore.list();
    this.render(
      'My Chill World',
      'Build roads, grow your town.',
      [
        worlds.length ? button('Continue', () => this.h.loadWorld(worlds[0].id), 'primary', worlds[0].name, 'play') : null,
        button('New World', () => this.showNew(), worlds.length ? '' : 'primary', undefined, 'plus'),
        worlds.length ? button('Load World', () => this.showLoad(), '', undefined, 'folder') : null,
        button('Gallery', () => this.h.openGallery('main'), '', 'Inspect every model in 3D', 'gallery'),
        this.languagePicker(() => this.showMain()),
        footer(),
      ],
      true,
    );
  }

  showNew() {
    const n = SaveStore.list().length + 1;
    const name = input('World name', t('My World {n}', { n }), 24);
    const seed = input('Seed (optional)', '', 10);
    seed.inputMode = 'numeric';
    this.render('New World', 'Every seed makes a different landscape.', [
      name.parentElement!,
      seed.parentElement!,
      button('Create', () => {
        const s = parseInt(seed.value, 10);
        this.h.newWorld(name.value.trim() || t('My World {n}', { n }), Number.isFinite(s) ? Math.abs(s) : Math.floor(Math.random() * 1e9));
      }, 'primary', undefined, 'check'),
      button('Back', () => this.showMain(), '', undefined, 'undo'),
    ]);
  }

  showLoad() {
    const worlds = SaveStore.list();
    if (!worlds.length) return this.showMain();
    const list = el('div', 'worlds');
    for (const w of worlds) list.appendChild(this.worldRow(w));
    this.render('Your Worlds', '', [list, button('Back', () => this.showMain(), '', undefined, 'undo')]);
  }

  showPause() {
    this.render('Paused', '', [
      button('Resume', () => this.h.resume(), 'primary', undefined, 'play'),
      button('Save', (b) => { this.h.save(); b.querySelector('.mtxt b')!.textContent = t('Saved ✓'); }, '', undefined, 'save'),
      button('Gallery', () => this.h.openGallery('pause'), '', undefined, 'gallery'),
      button('Main Menu', () => this.h.exitToMenu(), '', undefined, 'home'),
      this.languagePicker(() => this.showPause()),
    ]);
  }

  showLoading(text: string) {
    this.render(text, '', []);
  }

  private worldRow(w: WorldMeta) {
    const row = el('div', 'world');
    const info = el('div', 'world-info');
    const name = el('b', '');
    name.textContent = w.name;
    const meta = el('small', '');
    meta.textContent = `${t('Day {n}', { n: w.day })} · ${t('{n} people', { n: w.population })} · $${Math.floor(w.money).toLocaleString('en-US')} · ${new Date(w.updated).toLocaleDateString()}`;
    info.append(name, meta);
    const play = button('Play', () => this.h.loadWorld(w.id), 'primary small', undefined, 'play');
    const thumb = el('div', 'world-thumb');
    thumb.textContent = '🏙️';
    const del = button('Delete', () => {
      if (del.dataset.confirm) {
        SaveStore.remove(w.id);
        this.showLoad();
      } else {
        del.dataset.confirm = '1';
        del.querySelector('.mtxt b')!.textContent = t('Sure?');
        del.classList.add('danger');
      }
    }, 'small');
    row.append(thumb, info, play, del);
    return row;
  }

  private languagePicker(rerender: () => void) {
    const row = el('div', 'langs');
    const label = el('span', '');
    label.innerHTML = icon('globe');
    row.appendChild(label);
    for (const [code, name] of [['en', 'English'], ['uz', "O'zbekcha"]] as [Lang, string][]) {
      const b = el('button', `chipbtn${getLang() === code ? ' active' : ''}`);
      b.textContent = name;
      b.addEventListener('click', () => {
        setLang(code);
        this.h.languageChanged();
        rerender();
      });
      row.appendChild(b);
    }
    return row;
  }

  private render(title: string, sub: string, items: (HTMLElement | null)[], big = false) {
    this.panel.replaceChildren();
    this.panel.classList.toggle('main', big);
    if (big) {
      const logo = el('div', 'menu-logo');
      logo.textContent = '🏡';
      this.panel.appendChild(logo);
    }
    const h = el('h1', big ? 'big' : '');
    h.textContent = t(title);
    this.panel.appendChild(h);
    if (sub) {
      const p = el('p', '');
      p.textContent = t(sub);
      this.panel.appendChild(p);
    }
    for (const i of items) if (i) this.panel.appendChild(i);
    this.root.classList.add('show');
  }
}

function button(label: string, onClick: (b: HTMLButtonElement) => void, cls = '', sub?: string, ic?: IconName) {
  const b = el('button', `mbtn ${cls}`);
  if (ic) b.innerHTML = icon(ic);
  const txt = el('span', 'mtxt');
  const main = el('b', '');
  main.textContent = t(label);
  txt.appendChild(main);
  if (sub) {
    const s = el('small', '');
    s.textContent = t(sub);
    txt.appendChild(s);
  }
  b.appendChild(txt);
  b.addEventListener('click', () => onClick(b));
  return b;
}

function footer() {
  const f = el('div', 'menu-foot');
  f.textContent = 'My Chill World · v0.8';
  return f;
}

function input(label: string, value: string, max: number) {
  const wrap = el('label', 'field');
  const span = el('span', '');
  span.textContent = t(label);
  const i = el('input', '');
  i.value = value;
  i.maxLength = max;
  wrap.append(span, i);
  return i;
}
