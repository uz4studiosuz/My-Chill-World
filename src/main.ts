import * as THREE from 'three';
import './style.css';
import { IS_TOUCH } from './config';
import { Platform } from './platform/Platform';
import { Game, GameOptions } from './game/Game';
import { Menu } from './ui/Menu';
import { Gallery } from './gallery/Gallery';
import { SaveStore } from './save/SaveStore';
import { renderThumbnails } from './models/catalog';
import { getLang, setLang, t } from './i18n/i18n';
import { sound } from './audio/Sound';

const THUMB_IDS = ['road', 'roundabout', 'path', 'canal', 'house', 'watertower', 'school', 'weddinghall', 'office', 'parking', 'woodcutter', 'powerplant', 'farm', 'orchard', 'ranch', 'quarry', 'townhall', 'apartment', 'kindergarten', 'hotel', 'windturbine', 'solarfarm', 'trainstation', 'grocery', 'clothes', 'ironmine', 'fishery', 'police', 'firestation', 'busdepot', 'busstop', 'park', 'hospital', 'university', 'market', 'carmarket', 'bank', 'gasstation', 'factory', 'carfactory', 'construction', 'cemetery', 'stadium', 'cinema', 'academy', 'playground', 'fountain', 'flowerbed', 'statue', 'bench', 'lamppost', 'sapling', 'roadsign', 'airport', 'military', 'landfill', 'recycling', 'mill', 'bakery', 'sawmill', 'battery', 'kiosk', 'pharmacy', 'dairy', 'supermarket', 'brickworks', 'steelmill', 'sewage', 'coalmine', 'coalplant', 'hydro', 'casino', 'mosque', 'themepark', 'bigpark', 'gym', 'teahouse', 'barber', 'concerthall', 'warehouse', 'tower15', 'tower30', 'tower50'];

/** /editor (or editor.html, #editor) opens the model editor instead of the game. */
const isEditor = () => /\/editor(\.html)?\/?$/.test(location.pathname) || location.hash === '#editor';

async function boot() {
  setLang(getLang());
  if (isEditor()) {
    const { Editor } = await import('./editor/Editor');
    new Editor(document.getElementById('app')!);
    document.getElementById('loading')?.classList.add('done');
    return;
  }
  await Platform.init();
  // on CrazyGames the language comes from the player's settings (unless they picked one in the game)
  const loc = Platform.locale;
  let chosen = false;
  try { chosen = !!localStorage.getItem('mcw_lang'); } catch { /* storage blocked */ }
  if (loc && !chosen) { const l = loc.toLowerCase().startsWith('uz') ? 'uz' : 'en'; if (l !== getLang()) setLang(l); }
  // while an ad plays: the game stops and the sound is off
  Platform.onAd = (on) => { sound.suspend(on || document.hidden); game?.setAdPaused(on); };
  Platform.loadingStart();

  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !IS_TOUCH || devicePixelRatio < 2, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, IS_TOUCH ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = IS_TOUCH ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('pointerdown', () => sound.unlock(), true);
  window.addEventListener('keydown', () => sound.unlock(), true);
  document.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest?.('button')) sound.play('click'); }, true);
  document.addEventListener('visibilitychange', () => sound.suspend(document.hidden));

  // Build-panel pictures are rendered once from the real 3D models
  let thumbs = new Map<string, string>();
  try { thumbs = renderThumbnails(renderer, THUMB_IDS); } catch (e) { console.warn('[thumbs]', e); }

  const ui = document.getElementById('ui')!;
  let game: Game | null = null;
  let galleryFrom: 'main' | 'pause' = 'main';

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    game?.resize(w, h);
    gallery.resize(w, h);
  };
  window.addEventListener('resize', resize);

  const setGame = (g: Game) => {
    game?.dispose();
    game = g;
    if (import.meta.env.DEV) Object.assign(window as unknown as Record<string, unknown>, { __game: g, __renderer: renderer });
    resize();
  };

  const openMainMenu = () => {
    Platform.gameplayStop();
    setGame(new Game(canvas, { demo: true }));
    menu.showMain();
  };
  /** A world was already played this session (a short ad may come when the next one opens). */
  let playedBefore = false;

  const start = async (opts: GameOptions) => {
    menu.showLoading(t('Generating world…'));
    // opening another world is a natural break for a short ad (never before the first world; the screen waits)
    if (playedBefore) await Platform.midgameAd();
    playedBefore = true;
    // let the loading text paint before the (synchronous) world generation
    setTimeout(() => {
      let g: Game;
      try {
        g = new Game(canvas, { ...opts, thumbs }, pause);
      } catch (e) {
        // a world that cannot be opened must not leave the loading screen hanging
        console.error('[load]', e);
        openMainMenu();
        alert(`${t('This world could not be opened')}: ${(e as Error)?.message ?? e}`);
        return;
      }
      setGame(g);
      if (opts.create) g.save();
      menu.hide();
      Platform.gameplayStart();
    }, 30);
  };

  const pause = () => {
    game?.setMenuPaused(true);
    menu.showPause();
    Platform.gameplayStop();
  };

  const gallery = new Gallery(canvas, ui, () => {
    gallery.hide();
    if (galleryFrom === 'pause') menu.showPause();
    else menu.showMain();
  }, (ids) => renderThumbnails(renderer, ids, 80));

  const menu = new Menu(ui, {
    newWorld: (name, seed, calm, towns) => start({ create: { name, seed, calm, towns } }),
    loadWorld: (id) => {
      const save = SaveStore.load(id);
      if (save) start({ save });
      else menu.showMain();
    },
    resume: () => {
      menu.hide();
      game?.setMenuPaused(false);
      Platform.gameplayStart();
    },
    save: () => game?.save(true),
    exitToMenu: () => {
      game?.save();
      openMainMenu();
    },
    languageChanged: () => {
      game?.createUi();
      gallery.relabel();
    },
    openGallery: (from) => {
      galleryFrom = from;
      menu.hide();
      gallery.show();
      resize();
    },
  });

  if (Platform.environment !== 'disabled' && !SaveStore.list().length) {
    openMainMenu();
    void start({ create: { name: t('My World {n}', { n: 1 }), seed: Math.floor(Math.random() * 1e9), calm: false, towns: 3 } });
  } else openMainMenu();

  const clock = new THREE.Clock();
  // automatic quality: if the device can't keep ~40 fps, drop shadows and render resolution
  let fpsTime = 0, fpsFrames = 0, lowQuality = false;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    if (!lowQuality && game && !game.demo) {
      fpsTime += dt;
      fpsFrames++;
      if (fpsTime > 5) {
        if (fpsFrames / fpsTime < 40) {
          lowQuality = true;
          renderer.setPixelRatio(1);
          game.setLowQuality();
          resize();
        }
        fpsTime = 0;
        fpsFrames = 0;
      }
    }
    if (gallery.visible) {
      gallery.update();
      renderer.render(gallery.scene, gallery.camera);
      return;
    }
    if (!game) return;
    game.update(dt);
    renderer.render(game.scene, game.viewCamera);
    // photo mode: save the frame that was just drawn
    if (game.shotPending) {
      const g = game;
      canvas.toBlob((b) => {
        if (!b) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = `my-chill-world-${Date.now()}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        g.photoSaved();
      });
      game.shotPending = false;
    }
  });

  document.getElementById('loading')!.classList.add('done');
  Platform.loadingStop();
}

boot().catch((e) => {
  console.error(e);
  const l = document.getElementById('loading');
  if (l) l.textContent = t('Failed to start. Please reload.');
});
