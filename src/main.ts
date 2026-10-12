import * as THREE from 'three';
import './style.css';
import { IS_TOUCH } from './config';
import { Platform } from './platform/Platform';
import { Game, GameOptions } from './game/Game';
import { Menu } from './ui/Menu';
import { Gallery } from './gallery/Gallery';
import { SaveStore } from './save/SaveStore';
import { renderThumbnails } from './models/catalog';

const THUMB_IDS = ['road', 'roundabout', 'path', 'house', 'school', 'office', 'parking', 'woodcutter', 'powerplant', 'farm', 'orchard', 'ranch', 'quarry'];

async function boot() {
  await Platform.init();
  Platform.loadingStart();

  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !IS_TOUCH || devicePixelRatio < 2, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, IS_TOUCH ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  window.addEventListener('contextmenu', (e) => e.preventDefault());

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
    if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = g;
    resize();
  };

  const openMainMenu = () => {
    Platform.gameplayStop();
    setGame(new Game(canvas, { demo: true }));
    menu.showMain();
  };

  const start = (opts: GameOptions) => {
    menu.showLoading('Generating world…');
    // let the loading text paint before the (synchronous) world generation
    setTimeout(() => {
      const g = new Game(canvas, { ...opts, thumbs }, pause);
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
  });

  const menu = new Menu(ui, {
    newWorld: (name, seed) => start({ create: { name, seed } }),
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
    openGallery: (from) => {
      galleryFrom = from;
      menu.hide();
      gallery.show();
      resize();
    },
  });

  openMainMenu();

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    if (gallery.visible) {
      gallery.update();
      renderer.render(gallery.scene, gallery.camera);
      return;
    }
    if (!game) return;
    game.update(dt);
    renderer.render(game.scene, game.cam.camera);
  });

  document.getElementById('loading')!.classList.add('done');
  Platform.loadingStop();
}

boot().catch((e) => {
  console.error(e);
  const l = document.getElementById('loading');
  if (l) l.textContent = 'Failed to start. Please reload.';
});
