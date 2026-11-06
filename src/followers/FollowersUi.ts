import * as THREE from 'three';
import type { Game } from '../game/Game';
import type { Sex } from '../people/Population';
import type { Building } from '../buildings/Buildings';
import { t } from '../i18n/i18n';
import { sound } from '../audio/Sound';
import { DEV, SANDBOX, onSaveStatus, pushWorld, isAdmin, hasKey, tryAdmin, logout, newerExists, keepVideo } from './store';
import { Recorder } from './Recorder';

/** The page's Instagram name, shown in the film and to visitors (empty: not shown). */
export const INSTAGRAM = '';

const STUDIO_TITLE_KEY = 'mcw_studio_title';
const MARK_KEY = 'mcw_followers_marked';
const TEXTS_KEY = 'mcw_studio_texts';
type Texts = { counter: string; person: string; cta: string };
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};
const button = (label: string, fn: () => void, cls = 'btn-mini') => {
  const b = el('button', cls, label);
  b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
  return b;
};
const at = (nick: string) => `@${nick}`;
const FONT = '"Segoe UI", "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", Arial, sans-serif';

/** A name tag as drawn this frame (screen position relative to the game canvas). */
interface TagDraw { x: number; y: number; text: string; inside: boolean; gold: boolean; size: number }

/**
 * The followers' town page: name tags over every follower, a panel to find a follower's home (the admin also adds
 * followers and saves the town there), a studio mode for filming and an MP4 recorder.
 */
export class FollowersUi {
  private panel = el('div', 'fol-panel');
  private tagLayer = el('div', 'fol-tags');
  private studio = el('div', 'studio');
  private banner = el('div', 'fol-banner');
  private chip = el('button', 'fol-chip');
  private tags = new Map<string, HTMLDivElement>();
  private tagDraw: TagDraw[] = [];
  private fresh = new Map<string, number>();
  private v = new THREE.Vector3();
  private raf = 0;
  private last = performance.now();
  /** Time of this page (seconds), also when a video is rendered frame by frame. */
  private clock = 0;
  private listT = 0;
  private listSig = '';
  private bannerT = 0;
  private bannerAt = 0;
  private bannerKind = '';
  private captionAt = -99;
  private showTags = true;
  private studioOn = false;
  private tour = true;
  private tourT = 0;
  private tourStep = 0;
  private tourOrder: string[] = [];
  private barT = 0;
  private syncT = 0;
  private pollT = 60;
  private abort = new AbortController();
  private saveTimer = 0;
  private status?: HTMLDivElement;
  private list!: HTMLDivElement;
  private count!: HTMLSpanElement;
  private find!: HTMLInputElement;
  private title!: HTMLDivElement;
  private caption!: HTMLDivElement;
  private counter!: HTMLDivElement;
  private bar!: HTMLDivElement;
  private recBtn!: HTMLButtonElement;
  private portrait = false;
  private showTitle = true;
  private showCounter = true;
  private rec: Recorder | null = null;
  private recStart = 0;
  private recNext = 0;
  private recLive = false;
  /** Followers marked in the list: the "new in town" film shows them one by one. */
  private marked = new Set<string>(JSON.parse(localStorage.getItem(MARK_KEY) ?? '[]') as string[]);
  /** The film's own words (empty = the usual ones). */
  private texts: Texts = { counter: '', person: '', cta: '', ...(JSON.parse(localStorage.getItem(TEXTS_KEY) ?? '{}') as Partial<Texts>) };
  /** The "new in town" film playing now: its steps (seconds from the start). */
  private show: { steps: [number, () => void][]; t: number; i: number; recorded: boolean } | null = null;
  private markBtn!: HTMLButtonElement;
  private tourBtn!: HTMLButtonElement;
  private editBox!: HTMLDivElement;

  constructor(private game: Game) {
    this.buildPanel();
    this.buildStudio();
    // the name tags lie under the game's interface, the rest above it
    const ui = document.getElementById('ui');
    if (ui) ui.before(this.tagLayer); else document.body.append(this.tagLayer);
    this.chip.addEventListener('click', () => location.reload());
    document.body.append(this.panel, this.banner, this.chip, this.studio);
    document.body.classList.add('followers-town');
    const sig = this.abort.signal;
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === 'Escape' && this.studioOn) { e.stopPropagation(); this.setStudio(false); }
      if (e.code === 'KeyT' && this.studioOn) this.tourNext();
      if (e.code === 'KeyR' && this.studioOn) void this.toggleRecording();
    }, { signal: sig, capture: true });
    window.addEventListener('mousemove', () => { this.barT = 2.5; }, { signal: sig });
    onSaveStatus((s, note) => {
      if (!this.status) return;
      this.status.textContent = s === 'saving' ? t('Saving…') : s === 'saved' ? `✓ ${t('Saved')} ${new Date().toLocaleTimeString()}` : `⚠ ${t('Could not save')}: ${note ?? ''}`;
      this.status.className = `fol-status ${s}`;
    });
    // the picture is read right after the game draws it
    this.game.afterRender = () => this.liveFrame();
    if (DEV) (window as unknown as Record<string, unknown>).__fui = this;
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.update(dt);
    };
    loop();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.abort.abort();
    clearTimeout(this.saveTimer);
    this.rec?.cancel();
    this.rec = null;
    if (this.game.afterRender) this.game.afterRender = undefined;
    if (this.studioOn) this.setStudio(false);
    this.panel.remove();
    this.tagLayer.remove();
    this.banner.remove();
    this.chip.remove();
    this.studio.remove();
    document.body.classList.remove('followers-town');
  }

  // ---------- the panel ----------

  private buildPanel() {
    this.panel.replaceChildren();
    this.status = undefined;
    this.listSig = '';
    const head = el('div', 'fol-head');
    const title = el('b', '', `👥 ${t("Followers' town")}`);
    this.count = el('span', 'fol-count', '0');
    const fold = button('–', () => {
      this.panel.classList.toggle('folded');
      fold.textContent = this.panel.classList.contains('folded') ? '+' : '–';
    }, 'btn-mini ghost fol-fold');
    head.append(title, this.count, fold);
    const body = el('div', 'fol-body');

    if (INSTAGRAM) body.append(el('div', 'fol-promo', t('Follow {name} on Instagram — and your house appears in this town!', { name: at(INSTAGRAM) })));
    else body.append(el('div', 'fol-promo', t('Everyone here is a real follower. Find your house!')));

    // find a follower (everyone can); the admin key typed here lets the admin in
    const find = el('form', 'fol-find');
    const q = el('input') as HTMLInputElement;
    this.find = q;
    q.placeholder = t('Your nickname, e.g. @ali');
    q.autocomplete = 'off';
    q.spellcheck = false;
    q.addEventListener('input', () => { this.listSig = ''; this.renderList(); });
    find.append(q, el('button', 'btn-mini', '🔍'));
    find.addEventListener('submit', (e) => { e.preventDefault(); void this.search(q.value); });
    body.append(find);

    if (isAdmin() && !this.game.viewOnly) body.append(this.buildAdmin());
    else body.append(el('div', 'fol-view', `👀 ${t('Watching mode: the town lives on by itself — only its admin builds here')}`));

    this.list = el('div', 'fol-list');
    body.append(this.list);

    const tools = el('div', 'fol-tools');
    const tagBtn = button(`🏷️ ${t('Name tags')}`, () => { this.showTags = !this.showTags; tagBtn.classList.toggle('active', this.showTags); }, `btn-mini${this.showTags ? ' active' : ''}`);
    tools.append(tagBtn, button(`🎬 ${t('Studio (filming)')}`, () => this.setStudio(true), 'btn-mini'),
      button(`☐ ${t('Clear marks')}`, () => { this.marked.clear(); this.saveMarks(); this.listSig = ''; this.renderList(); }, 'btn-mini'));
    body.append(tools);
    this.panel.append(head, body);
    // the panel is not the game: clicks and keys stay in it
    for (const ev of ['pointerdown', 'wheel', 'keydown']) this.panel.addEventListener(ev, (e) => e.stopPropagation());
  }

  private async search(text: string) {
    const c = this.game.findFollower(text);
    if (c) {
      this.game.focusFollower(c);
      this.flash(t('🏠 Here is {nick}', { nick: at(c.fol!) }));
      return;
    }
    // not a follower: maybe the admin key (checked by the server, never kept in the game's files)
    const raw = text.trim();
    if (raw.length >= 6 && !/\s/.test(raw)) {
      const ok = await tryAdmin(raw);
      if (ok) {
        this.find.value = '';
        this.becomeAdmin();
        return;
      }
      if (ok === null && /[#!$%^&*]/.test(raw)) { this.flash(t('The server did not answer — try again'), 'warn'); return; }
    }
    this.flash(t("{nick} doesn't live here yet", { nick: at(raw.replace(/^@/, '') || '?') }), 'warn');
    sound.play('error');
  }

  private becomeAdmin() {
    this.game.setViewOnly(false);
    this.buildPanel();
    this.flash(`🔑 ${t('Admin mode: you can build and add followers — everything is saved for everyone')}`, 'big');
    sound.play('complete');
  }

  /** Adding followers and saving the town: the admin only. */
  private buildAdmin() {
    const box = el('div', 'fol-admin');
    box.append(el('div', 'fol-sub', SANDBOX ? `🧪 ${t('Rehearsal town: nothing is saved')}` : `🔑 ${t('Admin')}`));
    const form = el('form', 'fol-add');
    const nick = el('input') as HTMLInputElement;
    nick.placeholder = t('Nickname (Instagram)');
    nick.autocomplete = 'off';
    nick.maxLength = 31;
    let sex: Sex = 'm';
    const sexRow = el('div', 'fol-sex');
    const boy = button(`👦 ${t('Male')}`, () => setSex('m'), 'btn-mini active');
    const girl = button(`👧 ${t('Female')}`, () => setSex('f'), 'btn-mini');
    boy.type = girl.type = 'button';
    const setSex = (s: Sex) => { sex = s; boy.classList.toggle('active', s === 'm'); girl.classList.toggle('active', s === 'f'); };
    const age = el('input') as HTMLInputElement;
    age.type = 'number';
    age.min = '1';
    age.max = '99';
    age.value = '20';
    age.title = t('Age');
    sexRow.append(boy, girl, age);
    const showLbl = el('label', 'fol-check');
    const show = el('input') as HTMLInputElement;
    show.type = 'checkbox';
    show.checked = true;
    showLbl.append(show, document.createTextNode(` 🎥 ${t('Show the move-in (camera flies there)')}`));
    const add = el('button', 'btn-mini primary fol-addbtn', `➕ ${t('Add follower')}`);
    form.append(nick, sexRow, showLbl, add);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (this.addOne(nick.value, sex, Number(age.value) || 20, show.checked)) { nick.value = ''; nick.focus(); }
    });

    // many at once: one per line — "nick, m, 22" (m/f, boy/girl, yigit/qiz)
    const many = el('details', 'fol-many');
    many.append(el('summary', '', t('Add many at once')));
    const area = el('textarea') as HTMLTextAreaElement;
    area.placeholder = 'ali_007, m, 21\naziza.uz, f, 19\nsardor, m, 25';
    many.append(area, button(t('Add all'), () => {
      let n = 0;
      const bad: string[] = [];
      for (const line of area.value.split(/\n/)) {
        const [nk, sx, ag] = line.split(/[,;\t]/).map((x) => x.trim());
        if (!nk) continue;
        const s: Sex = /^(f|w|girl|qiz|ayol|female|q)/i.test(sx ?? '') ? 'f' : 'm';
        if (this.addOne(nk, s, Number(ag) || 18 + Math.floor(Math.random() * 12), false, true)) n++; else bad.push(nk);
      }
      area.value = bad.join('\n');
      this.flash(t('{n} followers are moving in', { n }) + (bad.length ? ` · ${t('{n} not added', { n: bad.length })}` : ''));
    }, 'btn-mini'));

    const acts = el('div', 'fol-acts');
    acts.append(button(`💾 ${t('Save')}`, () => this.game.save(true), 'btn-mini'));
    if (DEV) acts.append(button(`⬆️ ${t('Push to GitHub')}`, async () => {
      this.game.save(false, false, true);
      if (this.status) this.status.textContent = t('Pushing to GitHub…');
      await new Promise((r) => setTimeout(r, 800));
      const r = await pushWorld(this.game.followerList().length);
      if (this.status) {
        this.status.textContent = r.ok ? `✓ ${t('Pushed — the site updates in a minute')}` : `⚠ ${r.text.slice(0, 160)}`;
        this.status.className = `fol-status ${r.ok ? 'saved' : 'error'}`;
      }
      sound.play(r.ok ? 'complete' : 'error');
    }, 'btn-mini'));
    if (hasKey()) acts.append(button(`🚪 ${t('Leave admin mode')}`, () => { logout(); location.reload(); }, 'btn-mini'));
    this.status = el('div', 'fol-status', SANDBOX ? t('Nothing here is saved')
      : hasKey() ? t('Everything is saved for everyone by itself (the site shows it at once)')
        : t('Saved into the project file. To save on the site too, type the admin key into the search box'));
    box.append(form, many, acts, this.status);
    return box;
  }

  /** Bring one follower to the town (false when they can't come). */
  private addOne(nickIn: string, sex: Sex, age: number, show: boolean, quiet = false) {
    if (this.game.viewOnly) return false;
    const nick = nickIn.replace(/^@/, '').replace(/\s+/g, '').slice(0, 30);
    let home: Building | undefined;
    const r = this.game.addFollower(nick, sex, age, (c) => {
      this.fresh.set(c.fol!, this.clock + 120);
      this.marked.add(c.fol!);
      this.saveMarks();
      if (home && (show || !quiet)) this.game.celebrate(home);
      if (!quiet) this.flash(t('🎉 {nick} moved into their new home!', { nick: at(c.fol!) }), 'big');
      if (show) setTimeout(() => this.game.focusFollower(c, 4.5, false), 600);
      this.listSig = '';
      this.queueSave();
    });
    if (!r.ok) { if (!quiet) { this.flash(r.reason, 'warn'); sound.play('error'); } return false; }
    home = r.home;
    if (show) {
      const p = r.home.mesh.position;
      this.game.lookAt(p.x, p.z, 5.5, 1.8);
    }
    if (!quiet) this.flash(r.fresh ? t('🏗️ A house for {nick} is going up…', { nick: at(nick) }) : t('🔑 {nick} gets the keys to a house…', { nick: at(nick) }), 'big');
    this.listSig = '';
    return true;
  }

  private saveMarks() {
    const live = new Set(this.game.followerList().map((c) => c.fol!));
    for (const n of this.marked) if (!live.has(n)) this.marked.delete(n);
    localStorage.setItem(MARK_KEY, JSON.stringify([...this.marked]));
    if (this.markBtn) this.markBtn.textContent = `🌟 ${t('Show the marked ({n})', { n: this.marked.size })}`;
  }

  private queueSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.game.save(false, false, true), 1500);
  }

  private renderList() {
    const all = this.game.followerList();
    const q = this.find?.value.replace(/^@/, '').trim().toLowerCase() ?? '';
    const shown = (q ? all.filter((c) => c.fol!.toLowerCase().includes(q)) : all).sort((a, b) => a.fol!.localeCompare(b.fol!));
    this.count.textContent = String(all.length + this.game.arrivingCount);
    const admin = !this.game.viewOnly;
    const sig = `${admin}|${q}|${[...this.marked].join(',')}|${shown.map((c) => `${c.id}:${c.family}`).join(',')}`;
    if (sig === this.listSig) return;
    this.listSig = sig;
    this.list.replaceChildren();
    if (!all.length) { this.list.append(el('div', 'fol-empty', admin ? t('Nobody lives here yet — add the first follower') : t('Nobody lives here yet'))); return; }
    for (const c of shown.slice(0, 200)) {
      const info = this.game.followerInfo(c);
      const row = el('div', 'fol-row');
      const name = el('span', 'fol-nick', `${c.sex === 'f' ? '👧' : '👦'} ${at(info.nick)}`);
      const meta = el('span', 'fol-meta', `${info.age}${info.spouse ? ` · 💍 ${at(info.spouse)}` : ''}`);
      const box = el('input') as HTMLInputElement;
      box.type = 'checkbox';
      box.className = 'fol-mark';
      box.checked = this.marked.has(c.fol!);
      box.title = t('Mark for the video');
      box.addEventListener('click', (e) => e.stopPropagation());
      box.addEventListener('change', () => { if (box.checked) this.marked.add(c.fol!); else this.marked.delete(c.fol!); this.saveMarks(); });
      row.append(box, name, meta);
      row.addEventListener('click', () => this.game.focusFollower(c));
      if (admin) row.append(button('✖', () => {
        if (!confirm(t('Take {nick} off the list? Their home stays empty.', { nick: at(info.nick) }))) return;
        this.game.removeFollower(info.nick);
        this.listSig = '';
        this.queueSave();
      }, 'btn-mini ghost fol-x'));
      this.list.append(row);
    }
    if (shown.length > 200) this.list.append(el('div', 'fol-empty', t('…and {n} more — search above', { n: shown.length - 200 })));
  }

  /** A message in the middle of the screen (it shows in the film too). */
  flash(text: string, kind: 'big' | 'warn' | '' = '', seconds?: number) {
    this.banner.textContent = text;
    this.banner.className = `fol-banner show ${kind}`;
    this.bannerKind = kind;
    this.bannerAt = this.clock;
    this.bannerT = seconds ?? (kind === 'big' ? 4.5 : 3);
  }

  // ---------- name tags ----------

  private updateTags() {
    const game = this.game;
    const view = game.cam.viewHalf;
    const used = new Set<string>();
    this.tagDraw = [];
    if (this.showTags && view < 40) {
      const canvas = document.getElementById('game') as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      const cam = game.viewCamera;
      // people inside a building share one tag (the household at home, the staff at work)
      const groups = new Map<string, { x: number; y: number; z: number; nicks: string[]; inside: boolean; home: boolean; gold: boolean }>();
      for (const c of game.followerList()) {
        const p = game.followerPos(c);
        if (!p) continue;
        const inside = p.y > 0.42;
        const key = inside ? `b${c.at}` : `c${c.id}`;
        const gold = (this.fresh.get(c.fol!) ?? -1) > this.clock;
        const g = groups.get(key);
        if (g) { g.nicks.push(c.fol!); g.gold ||= gold; }
        else groups.set(key, { x: p.x, y: p.y + (inside ? 0.1 : 0.32), z: p.z, nicks: [c.fol!], inside, home: p.home, gold });
      }
      // when the camera is far, only the households and the newest followers
      const far = view > 18;
      const size = Math.max(10, Math.min(15, 17 - view * 0.25));
      for (const [key, g] of groups) {
        if (far && !g.inside && !g.gold) continue;
        this.v.set(g.x, g.y, g.z).project(cam);
        if (this.v.z > 1 || Math.abs(this.v.x) > 1.05 || Math.abs(this.v.y) > 1.05) continue;
        const rx = (this.v.x * 0.5 + 0.5) * rect.width;
        const ry = (-this.v.y * 0.5 + 0.5) * rect.height;
        let d = this.tags.get(key);
        if (!d) { d = el('div', 'fol-tag'); this.tagLayer.append(d); this.tags.set(key, d); }
        const text = g.inside
          ? `${g.home ? '🏠' : '🏢'} ${g.nicks.slice(0, 2).map(at).join(' ')}${g.nicks.length > 2 ? ` +${g.nicks.length - 2}` : ''}`
          : at(g.nicks[0]);
        if (d.textContent !== text) d.textContent = text;
        d.className = `fol-tag${g.inside ? ' in' : ''}${g.gold ? ' gold' : ''}`;
        d.style.fontSize = `${size}px`;
        d.style.transform = `translate(${(rect.left + rx).toFixed(1)}px, ${(rect.top + ry).toFixed(1)}px) translate(-50%, -100%)`;
        this.tagDraw.push({ x: rx, y: ry, text, inside: g.inside, gold: g.gold, size });
        used.add(key);
      }
    }
    for (const [key, d] of this.tags) if (!used.has(key)) { d.remove(); this.tags.delete(key); }
  }

  // ---------- studio (filming) ----------

  private buildStudio() {
    const frame = el('div', 'studio-frame');
    const title = el('div', 'studio-title');
    this.title = title;
    title.contentEditable = 'true';
    title.spellcheck = false;
    title.textContent = localStorage.getItem(STUDIO_TITLE_KEY) ?? (INSTAGRAM
      ? t('Follow {name} — and your house appears in this town!', { name: at(INSTAGRAM) })
      : t('Follow — and your house appears in this town!'));
    title.addEventListener('input', () => localStorage.setItem(STUDIO_TITLE_KEY, title.textContent ?? ''));
    title.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); title.blur(); } });
    this.counter = el('div', 'studio-count');
    this.caption = el('div', 'studio-caption');
    frame.append(title, this.counter, this.caption);

    this.bar = el('div', 'studio-bar');
    const toggle = (label: string, on: boolean, fn: (v: boolean) => void) => {
      const b = button(label, () => { const v = !b.classList.contains('active'); b.classList.toggle('active', v); fn(v); }, `btn-mini${on ? ' active' : ''}`);
      return b;
    };
    this.recBtn = button(`⏺ ${t('Record MP4 (R)')}`, () => void this.toggleRecording(), 'btn-mini rec');
    this.markBtn = button(`🌟 ${t('Show the marked ({n})', { n: this.marked.size })}`, () => void this.startShowcase(), 'btn-mini primary');
    this.tourBtn = toggle(`🎥 ${t('Auto tour')}`, true, (v) => { this.tour = v; this.tourT = 0; if (!v) this.caption.classList.remove('show'); });
    this.editBox = this.buildTextEditor();
    this.bar.append(
      this.markBtn,
      this.recBtn,
      toggle(`✏️ ${t('Texts')}`, false, (v) => { this.editBox.style.display = v ? '' : 'none'; }),
      this.tourBtn,
      toggle(`🏷️ ${t('Name tags')}`, true, (v) => { this.showTags = v; }),
      toggle(`📝 ${t('Title')}`, true, (v) => { this.showTitle = v; title.style.display = v ? '' : 'none'; }),
      toggle(`👥 ${t('Counter')}`, true, (v) => { this.showCounter = v; this.counter.style.display = v ? '' : 'none'; }),
      toggle(`📱 9:16`, false, (v) => this.setPortrait(v)),
      button(`⏭ ${t('Next (T)')}`, () => this.tourNext(), 'btn-mini'),
      button(`⏹ ${t('Exit (Esc)')}`, () => this.setStudio(false), 'btn-mini ghost'),
    );
    this.bar.append(this.editBox);
    this.bar.append(el('div', 'studio-hint', `🌟 ${t('Mark followers in the list (the box in front of each name): this shows each one — their home, then them — and saves it as an MP4.')}`));
    this.bar.append(el('div', 'studio-hint', t('This bar hides by itself — move the mouse to see it. The title can be edited: click it. The MP4 has the picture, the title and the captions, without this bar.')));
    for (const ev of ['pointerdown', 'wheel']) this.bar.addEventListener(ev, (e) => e.stopPropagation());
    this.studio.append(frame, this.bar);
  }

  /** The film's words: the title, the line under it, the words for each person and the last words. */
  private buildTextEditor() {
    const box = el('div', 'studio-edit');
    box.style.display = 'none';
    const field = (label: string, value: string, placeholder: string, set: (v: string) => void) => {
      const l = el('label', '', label);
      const i = el('input') as HTMLInputElement;
      i.value = value;
      i.placeholder = placeholder;
      i.addEventListener('input', () => set(i.value));
      i.addEventListener('keydown', (e) => e.stopPropagation());
      l.append(i);
      return l;
    };
    const keep = () => localStorage.setItem(TEXTS_KEY, JSON.stringify(this.texts));
    box.append(
      field(t('Title'), this.title.textContent ?? '', '', (v) => { this.title.textContent = v; localStorage.setItem(STUDIO_TITLE_KEY, v); }),
      field(t('Line under the title ({n} = how many)'), this.texts.counter, `👥 ${t('{n} followers live here', { n: '{n}' })}`, (v) => { this.texts.counter = v; keep(); }),
      field(t('For each person ({nick} = the nickname)'), this.texts.person, this.personText('{nick}'), (v) => { this.texts.person = v; keep(); }),
      field(t('At the end'), this.texts.cta, this.ctaText(), (v) => { this.texts.cta = v; keep(); }),
    );
    return box;
  }

  private personText(nick: string) { return (this.texts.person || t('🎉 New in town: {nick}')).replace('{nick}', nick); }
  private ctaText() { return this.texts.cta || t('Follow and write your nickname in the comments — your house is next! 👇'); }

  /**
   * The "new in town" film: the town from above, then each marked follower — their home with fireworks, then
   * themselves with their card — and the call to follow at the end. It is recorded as an MP4 by itself.
   */
  async startShowcase() {
    const all = this.game.followerList();
    const nicks = [...this.marked].filter((n) => all.some((c) => c.fol === n));
    if (!nicks.length) { this.flash(t('Mark followers in the list first (the box in front of each name)'), 'warn'); return; }
    if (!this.studioOn) this.setStudio(true);
    this.tour = false;
    this.tourBtn.classList.remove('active');
    const recorded = !this.rec;
    if (recorded) await this.startRecording(true);
    const steps: [number, () => void][] = [];
    const centre = () => { const c = this.game.townCentre(); this.game.lookAt(c.x, c.z, 13, 1.5); };
    steps.push([0, () => { centre(); this.hideCaption(); }]);
    let at0 = 2.8;
    for (const nick of nicks) {
      steps.push([at0, () => {
        const c = this.game.followerList().find((x) => x.fol === nick);
        const home = c && this.game.homeOf(c);
        this.hideCaption();
        if (home) { this.game.lookAt(home.mesh.position.x, home.mesh.position.z, 5, 1.5); this.game.celebrate(home); }
        this.flash(this.personText(at(nick)), 'big', 3.3);
      }]);
      steps.push([at0 + 3.4, () => this.showFollower(nick, 4.2)]);
      at0 += 7.4;
    }
    steps.push([at0, () => { centre(); this.showCaption(`🏙️ ${t('{n} people live here — every one a follower', { n: this.game.followerList().length })}`, ''); }]);
    steps.push([at0 + 3, () => { this.hideCaption(); this.flash(this.ctaText(), 'big', 5); }]);
    steps.push([at0 + 8, () => { this.show = null; if (recorded) void this.stopRecording(); }]);
    this.show = { steps, t: 0, i: 0, recorded };
  }

  setPortrait(v: boolean) {
    this.portrait = v;
    document.body.classList.toggle('portrait-916', v);
    for (const b of this.bar.querySelectorAll('button')) if (b.textContent === '📱 9:16') b.classList.toggle('active', v);
    window.dispatchEvent(new Event('resize'));
  }

  setStudio(on: boolean) {
    if (!on) this.show = null;
    if (!on && this.rec) void this.toggleRecording();
    this.studioOn = on;
    this.game.studio = on;
    document.body.classList.toggle('studio-mode', on);
    document.body.classList.toggle('photo-mode', on);
    if (!on) {
      this.setPortrait(false);
      this.caption.classList.remove('show');
      this.game.clearSelection();
    } else {
      this.barT = 3;
      this.tourT = 0.8;
      this.tourStep = 0;
    }
  }

  /** Studio options for a scripted film: the tour, the title and its text. */
  configure(o: { tour?: boolean; title?: string | null; counter?: boolean; tags?: boolean }) {
    if (o.tour !== undefined) { this.tour = o.tour; this.tourT = 0.5; }
    if (o.title !== undefined) { this.showTitle = o.title !== null; this.title.style.display = this.showTitle ? '' : 'none'; if (o.title) this.title.textContent = o.title; }
    if (o.counter !== undefined) { this.showCounter = o.counter; this.counter.style.display = o.counter ? '' : 'none'; }
    if (o.tags !== undefined) this.showTags = o.tags;
  }

  /** The next shot of the tour: a follower up close (most of the time), or the whole town from above. */
  tourNext() {
    const all = this.game.followerList();
    this.tourStep++;
    if (!all.length || this.tourStep % 5 === 1) {
      const c = this.game.townCentre();
      this.game.lookAt(c.x, c.z, 15, 3.2);
      this.showCaption(`🏙️ ${t('{n} people live here — every one a follower', { n: all.length })}`, '');
      this.tourT = 7;
      return;
    }
    // everyone in turn (shuffled), people out in the street first
    this.tourOrder = this.tourOrder.filter((n) => all.some((c) => c.fol === n));
    if (!this.tourOrder.length) this.tourOrder = all.map((c) => c.fol!).sort(() => Math.random() - 0.5);
    const outside = this.tourOrder.findIndex((n) => { const c = all.find((x) => x.fol === n); const p = c && this.game.followerPos(c); return !!p && p.y <= 0.42; });
    const nick = this.tourOrder.splice(outside >= 0 ? outside : 0, 1)[0];
    this.showFollower(nick);
    this.tourT = 7.5;
  }

  /** Close-up of one follower with their caption. */
  showFollower(nick: string, view = 4.2) {
    const c = this.game.findFollower(nick);
    if (!c) return;
    this.game.focusFollower(c, view, true);
    const info = this.game.followerInfo(c);
    const sub = [
      t('{n} years old', { n: info.age }),
      info.work ? (info.student ? t('studies at the {place}', { place: info.work }) : t('works at the {place}', { place: info.work })) : '',
      info.spouse ? `💍 ${t('married to {nick}', { nick: at(info.spouse) })}` : '',
    ].filter(Boolean).join(' · ');
    this.showCaption(`${c.sex === 'f' ? '👧' : '👦'} ${at(info.nick)}`, `${sub}${sub ? '\n' : ''}${info.activity}`);
  }

  showCaption(head: string, sub: string) {
    this.caption.replaceChildren(el('div', 'cap-head', head), ...(sub ? [el('div', 'cap-sub', sub)] : []));
    this.caption.classList.remove('show');
    void this.caption.offsetWidth;
    this.caption.classList.add('show');
    this.captionAt = this.clock;
  }

  hideCaption() { this.caption.classList.remove('show'); }

  /** One step of the page (called every frame, or by a scripted film with a fixed step). */
  update(dt: number) {
    this.clock += dt;
    this.updateTags();
    this.listT -= dt;
    if (this.listT <= 0) { this.listT = 1; this.renderList(); }
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) this.banner.classList.remove('show'); }
    // a visitor's clock keeps to the town's real time; now and then they hear of a newer town
    this.syncT -= dt;
    if (this.syncT <= 0) { this.syncT = 5; this.game.followersResync(); }
    if (this.game.viewOnly && !SANDBOX) {
      this.pollT -= dt;
      if (this.pollT <= 0) {
        this.pollT = 60;
        void newerExists().then((yes) => {
          if (!yes) return;
          this.chip.textContent = `🔄 ${t('The town was updated — new followers. Show')}`;
          this.chip.classList.add('show');
        });
      }
    }
    if (!this.studioOn) return;
    // the bar stays while its words are being edited
    if (this.editBox.contains(document.activeElement)) this.barT = 2.5;
    this.barT -= dt;
    this.bar.classList.toggle('hide', this.barT <= 0 && (!this.rec || !!this.show));
    const n = this.game.followerList().length;
    const txt = this.texts.counter ? this.texts.counter.replace('{n}', String(n)) : `👥 ${t('{n} followers live here', { n })}`;
    if (this.counter.textContent !== txt) this.counter.textContent = txt;
    // a slow turn around the town, like a drone
    this.game.cam.rotate(dt * 0.035, false);
    if (this.show) {
      const s = this.show;
      s.t += dt;
      while (this.show === s && s.i < s.steps.length && s.steps[s.i][0] <= s.t) s.steps[s.i++][1]();
    } else if (this.tour) {
      this.tourT -= dt;
      if (this.tourT <= 0) this.tourNext();
    }
    if (this.rec && this.recLive) {
      const s = Math.floor((performance.now() - this.recStart) / 1000);
      this.recBtn.textContent = `⏹ ${t('Stop')} ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }
  }

  // ---------- the MP4 recorder ----------

  /** Start a recording: 1080×1920 in 9:16, otherwise 1920×1080. `live` = from the screen as it plays. */
  async startRecording(live = true, fps = 30) {
    if (this.rec) return;
    const w = this.portrait ? 1080 : 1920, h = this.portrait ? 1920 : 1080;
    try {
      this.rec = await Recorder.create(w, h, fps);
    } catch (e) {
      this.flash(`⚠ ${(e as Error).message}`, 'warn');
      return;
    }
    // the game is drawn sharp enough for the video
    const canvas = document.getElementById('game') as HTMLCanvasElement;
    const cw = canvas.clientWidth || 1, ch = canvas.clientHeight || 1;
    const cropW = cw / ch > w / h ? ch * (w / h) : cw;
    this.game.setPixelRatio?.(Math.min(3, Math.max(1, w / cropW)));
    this.recLive = live;
    this.recStart = performance.now();
    this.recNext = 0;
    this.recBtn.classList.add('on');
  }

  async stopRecording(): Promise<string | null> {
    const rec = this.rec;
    if (!rec) return null;
    this.rec = null;
    this.recBtn.classList.remove('on');
    this.recBtn.textContent = `⏺ ${t('Record MP4 (R)')}`;
    this.game.setPixelRatio?.(undefined);
    if (!rec.frames) { rec.cancel(); return null; }
    this.flash(t('Making the MP4…'), '', 30);
    try {
      const blob = await rec.finish();
      const name = `my-chill-world-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.mp4`;
      const where = await keepVideo(blob, name);
      this.flash(`✓ ${t('Video saved')}: ${where}`, '', 6);
      sound.play('complete');
      return where;
    } catch (e) {
      this.flash(`⚠ ${(e as Error).message}`, 'warn', 6);
      return null;
    }
  }

  private async toggleRecording() {
    if (this.rec) await this.stopRecording();
    else await this.startRecording(true);
  }

  /** Live recording: right after the game drew its frame, at most 30 times a second. */
  private liveFrame() {
    if (!this.rec || !this.recLive) return;
    const ms = performance.now() - this.recStart;
    if (ms < this.recNext) return;
    this.recNext = Math.max(this.recNext + 1000 / this.rec.fps, ms - 1000 / this.rec.fps);
    if (this.rec.busy) return;
    try { this.rec.frame((ctx, w, h) => this.compose(ctx, w, h), ms * 1000); } catch (e) { console.warn('[rec]', e); void this.stopRecording(); }
  }

  /** A scripted film: one frame at this time (after the game was stepped and drawn). */
  async capture(timeSec: number) {
    if (!this.rec) return;
    this.rec.frame((ctx, w, h) => this.compose(ctx, w, h), timeSec * 1e6);
    if (this.rec.frames % 10 === 0) await this.rec.drain();
  }

  /** The video frame: the game's picture (filling the frame) with the tags, title, counter, caption and banner. */
  private compose(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const canvas = document.getElementById('game') as HTMLCanvasElement;
    const cw = canvas.clientWidth || 1, ch = canvas.clientHeight || 1;
    // the part of the screen that fills the video (cut in the middle)
    let cropW = cw, cropH = ch;
    if (cw / ch > W / H) cropW = ch * (W / H); else cropH = cw * (H / W);
    const cropX = (cw - cropW) / 2, cropY = (ch - cropH) / 2;
    const k = W / cropW;
    const dpr = canvas.width / cw;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(canvas, cropX * dpr, cropY * dpr, cropW * dpr, cropH * dpr, 0, 0, W, H);
    const u = Math.min(W, H) / 1080;

    // name tags
    for (const g of this.tagDraw) {
      const x = (g.x - cropX) * k, y = (g.y - cropY) * k;
      if (x < -50 || y < -20 || x > W + 50 || y > H + 50) continue;
      // the size in the video does not depend on how wide the window is
      const fs = g.size * 2.1 * u;
      ctx.font = `${g.inside ? 700 : 800} ${fs}px ${FONT}`;
      const tw = ctx.measureText(g.text).width, ph = fs * 1.45, pw = tw + fs * 1.0;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.3)';
      ctx.shadowBlur = fs * 0.4;
      ctx.shadowOffsetY = fs * 0.12;
      ctx.fillStyle = g.gold ? '#ffc65a' : g.inside ? 'rgba(28,36,31,.85)' : 'rgba(255,255,255,.94)';
      this.pill(ctx, x - pw / 2, y - ph, pw, ph, ph / 2);
      ctx.restore();
      ctx.fillStyle = g.gold ? '#3b2500' : g.inside ? '#fff' : '#1d2a22';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(g.text, x, y - ph / 2 + fs * 0.04);
    }

    if (this.studioOn) {
      // the title at the top, the counter under it
      let y = H * 0.05;
      if (this.showTitle && this.title.textContent) {
        const fs = 66 * u * (this.portrait ? 1 : 0.9);
        ctx.font = `900 ${fs}px ${FONT}`;
        const lines = this.wrap(ctx, this.title.textContent, W * 0.88);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (const line of lines) {
          ctx.save();
          ctx.shadowColor = 'rgba(0,0,0,.55)';
          ctx.shadowBlur = fs * 0.35;
          ctx.shadowOffsetY = fs * 0.06;
          ctx.lineWidth = fs * 0.12;
          ctx.strokeStyle = 'rgba(0,0,0,.35)';
          ctx.strokeText(line, W / 2, y);
          ctx.fillStyle = '#fff';
          ctx.fillText(line, W / 2, y);
          ctx.restore();
          y += fs * 1.12;
        }
        y += fs * 0.25;
      }
      if (this.showCounter && this.counter.textContent) {
        const fs = 34 * u;
        ctx.font = `800 ${fs}px ${FONT}`;
        const tw = ctx.measureText(this.counter.textContent).width;
        ctx.fillStyle = 'rgba(255,255,255,.93)';
        this.pill(ctx, W / 2 - tw / 2 - fs * 0.7, y, tw + fs * 1.4, fs * 1.6, fs * 0.8);
        ctx.fillStyle = '#1d2a22';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.counter.textContent, W / 2, y + fs * 0.82);
      }
      // the caption of the follower in view
      if (this.caption.classList.contains('show')) {
        const a = Math.min(1, (this.clock - this.captionAt) / 0.45);
        const head = this.caption.querySelector('.cap-head')?.textContent ?? '';
        const sub = this.caption.querySelector('.cap-sub')?.textContent ?? '';
        ctx.save();
        ctx.globalAlpha = a;
        const lift = (1 - a) * 30 * u;
        const subFs = 30 * u, headFs = 58 * u;
        const subLines = sub ? sub.split('\n').flatMap((l) => { ctx.font = `700 ${subFs}px ${FONT}`; return this.wrap(ctx, l, W * 0.84); }) : [];
        let by = H * 0.91 + lift - subLines.length * subFs * 1.35 - (subLines.length ? subFs * 0.9 : 0);
        ctx.font = `900 ${headFs}px ${FONT}`;
        const hw = Math.min(W * 0.9, ctx.measureText(head).width + headFs * 0.9), hh = headFs * 1.5;
        ctx.shadowColor = 'rgba(0,0,0,.35)';
        ctx.shadowBlur = 24 * u;
        ctx.fillStyle = '#fff';
        this.pill(ctx, W / 2 - hw / 2, by - hh, hw, hh, 22 * u);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#18231c';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(head, W / 2, by - hh / 2 + headFs * 0.04, W * 0.86);
        if (subLines.length) {
          by += subFs * 0.6;
          ctx.font = `700 ${subFs}px ${FONT}`;
          const sw = Math.max(...subLines.map((l) => ctx.measureText(l).width)) + subFs * 1.2;
          const sh = subLines.length * subFs * 1.35 + subFs * 0.6;
          ctx.fillStyle = 'rgba(15,20,17,.66)';
          this.pill(ctx, W / 2 - sw / 2, by, sw, sh, 16 * u);
          ctx.fillStyle = '#fff';
          subLines.forEach((l, i) => ctx.fillText(l, W / 2, by + subFs * 0.3 + subFs * 1.35 * (i + 0.5)));
        }
        ctx.restore();
      }
    }

    // the banner (moving in, a wedding, the call to follow)
    if (this.bannerT > 0 && this.banner.textContent) {
      const a = Math.min(1, (this.clock - this.bannerAt) / 0.3, this.bannerT / 0.3);
      const big = this.bannerKind === 'big';
      const fs = (big ? 50 : 32) * u;
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = `800 ${fs}px ${FONT}`;
      const lines = this.wrap(ctx, this.banner.textContent, W * 0.8);
      const bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + fs * 1.6;
      const bh = lines.length * fs * 1.25 + fs * 0.9;
      const bx = W / 2 - bw / 2, by = H * (this.portrait || H > W ? 0.3 : 0.2) - (1 - a) * 12 * u;
      ctx.shadowColor = 'rgba(0,0,0,.35)';
      ctx.shadowBlur = 30 * u;
      if (big) {
        const gr = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
        gr.addColorStop(0, '#ffd666');
        gr.addColorStop(1, '#ff8c5a');
        ctx.fillStyle = gr;
      } else ctx.fillStyle = this.bannerKind === 'warn' ? 'rgba(120,40,30,.92)' : 'rgba(20,26,22,.88)';
      this.pill(ctx, bx, by, bw, bh, 26 * u);
      ctx.shadowBlur = 0;
      ctx.fillStyle = big ? '#2b1600' : '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      lines.forEach((l, i) => ctx.fillText(l, W / 2, by + fs * 0.45 + fs * 1.25 * (i + 0.5)));
      ctx.restore();
    }
  }

  private pill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, Math.min(r, h / 2, w / 2));
    ctx.fill();
  }

  private wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
    const out: string[] = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > max && line) { out.push(line); line = word; } else line = next;
    }
    if (line) out.push(line);
    return out;
  }
}
