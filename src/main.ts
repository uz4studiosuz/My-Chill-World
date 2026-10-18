import * as THREE from 'three';
import { pickSeed } from './world/WorldGen';
import './style.css';
import './ui/theme.css';
import { installAccessibility } from './ui/Accessibility';
import { IS_TOUCH } from './config';
import { Game, GameOptions } from './game/Game';
import { Menu } from './ui/Menu';
import { Gallery } from './gallery/Gallery';
import { exportWorld } from './save/Transfer';
import { WorldSave, SaveStore } from './save/SaveStore';
import { Online } from './online/Online';
import { renderThumbnails } from './models/catalog';
import { getLang, setLang, t } from './i18n/i18n';
import { sound } from './audio/Sound';

const THUMB_IDS = ['eldercare', 'restaurant', 'zoo', 'pier', 'forestry', 'greenhouse', 'apiary', 'poultry', 'road', 'roundabout', 'path', 'path_stone', 'path_brick', 'path_gravel', 'path_wood', 'canal', 'house', 'watertower', 'school', 'weddinghall', 'office', 'parking', 'woodcutter', 'powerplant', 'farm', 'orchard', 'ranch', 'quarry', 'townhall', 'apartment', 'kindergarten', 'hotel', 'windturbine', 'solarfarm', 'trainstation', 'grocery', 'clothes', 'ironmine', 'fishery', 'police', 'firestation', 'busdepot', 'busstop', 'park', 'hospital', 'university', 'market', 'carmarket', 'bank', 'gasstation', 'factory', 'carfactory', 'construction', 'cemetery', 'stadium', 'cinema', 'academy', 'playground', 'fountain', 'flowerbed', 'statue', 'bench', 'lamppost', 'sapling', 'roadsign', 'airport', 'military', 'landfill', 'recycling', 'mill', 'bakery', 'sawmill', 'battery', 'kiosk', 'dairyshop', 'garage', 'metro', 'cctv', 'levee', 'embassy', 'pharmacy', 'dairy', 'supermarket', 'brickworks', 'steelmill', 'sewage', 'coalmine', 'coalplant', 'hydro', 'casino', 'mosque', 'themepark', 'bigpark', 'gym', 'teahouse', 'barber', 'concerthall', 'warehouse', 'tower15', 'tower30', 'tower50', 'bikefactory', 'migration', 'gazebo', 'pond', 'clocktower', 'flagpole', 'planter', 'archway', 'litroad', 'rail', 'pipe', 'cable', 'tunnel', 'zone_res', 'zone_com', 'zone_ind', 'zone_none'];

/** /editor (or editor.html, #editor) opens the model editor instead of the game. */
const isEditor = () => /\/editor(\.html)?\/?$/.test(location.pathname) || location.hash === '#editor';

/** /viewer (linked from nowhere): paste a model file and see it in 3D. */
const isViewer = () => /\/viewer(\.html)?\/?$/.test(location.pathname) || location.hash === '#viewer';

async function boot() {
  setLang(getLang());
  installAccessibility();
  if (isViewer()) {
    const { Viewer } = await import('./viewer/Viewer');
    new Viewer(document.getElementById('app')!);
    return;
  }
  if (isEditor()) {
    const { Editor } = await import('./editor/Editor');
    new Editor(document.getElementById('app')!);
    document.getElementById('loading')?.classList.add('done');
    return;
  }

  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !IS_TOUCH || devicePixelRatio < 2, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, IS_TOUCH ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = IS_TOUCH ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  // a filmic curve keeps the colours but rolls off bright highlights softly
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
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
    setGame(new Game(canvas, { demo: true }));
    menu.showMain();
  };
  const start = async (opts: GameOptions) => {
    menu.showLoading(t('Generating world…'));
    // let the loading text paint before the (synchronous) world generation
    setTimeout(() => {
      let g: Game;
      try {
        // no seed typed: a few are tried and the best landscape kept
        if (opts.create && opts.create.seed < 0) opts = { ...opts, create: { ...opts.create, seed: pickSeed() } };
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
    }, 30);
  };

  const pause = () => {
    game?.setMenuPaused(true);
    menu.showPause();
  };

  const gallery = new Gallery(canvas, ui, () => {
    gallery.hide();
    if (galleryFrom === 'pause') menu.showPause();
    else menu.showMain();
  }, (ids) => renderThumbnails(renderer, ids, 80));

  const menu = new Menu(ui, {
    newWorld: (name, seed, calm, towns, creative) => start({ create: { name, seed, calm, towns, creative } }),
    // my town in an online world: kept on this device under the world's id, started fresh the first time
    playOnline: async (w, city, slot) => {
      const id = `on_${w.id}`;
      // the town as saved here and as saved in the cloud (from another device): the newer one is played
      menu.showLoading(t('Loading your town…'));
      let save = SaveStore.load(id);
      const cloud = await Online.pullSave(w.id).catch(() => null);
      let fromCloud: WorldSave | null = null;
      try { fromCloud = cloud ? JSON.parse(cloud.json) as WorldSave : null; } catch { fromCloud = null; }
      let useCloud = !!fromCloud && cloud!.updated > (save?.meta.updated ?? 0);
      // the two differ a lot (a fresh town on a new device, or an old copy): the player chooses
      if (fromCloud && save) {
        const a = save.buildings.length, b = fromCloud.buildings.length;
        if (Math.abs(a - b) > Math.max(3, Math.min(a, b) * 0.2)) {
          const info = (x: WorldSave) => t('{p} people, {b} buildings, saved {d}', { p: x.meta.population, b: x.buildings.length, d: new Date(x.meta.updated).toLocaleString() });
          useCloud = confirm([t('Your town is saved differently in the cloud and on this device.'), '', `☁️ ${t('Cloud')}: ${info(fromCloud)}`, `💻 ${t('This device')}: ${info(save)}`, '', t("OK = play the cloud town, Cancel = keep this device's town")].join(String.fromCharCode(10)));
        }
      }
      if (fromCloud && useCloud) {
        try {
          const s = fromCloud;
          s.meta.id = id;
          SaveStore.save(s);
          save = SaveStore.load(id) ?? s;
        } catch (e) { console.warn('[cloud save]', e); }
      }
      if (save) start({ save });
      else start({ create: { id, name: city, seed: w.seed, towns: 0, online: { worldId: w.id, code: w.code, world: w.name, host: false, started: w.started_at, daySeconds: w.day_seconds, slot } } });
    },
    loadWorld: (id) => {
      const save = SaveStore.load(id);
      if (save) start({ save });
      else menu.showMain();
    },
    resume: () => {
      menu.hide();
      game?.setMenuPaused(false);
    },
    save: () => game?.save(true),
    exportCurrent: () => { if (!game) return; game.save(); void exportWorld(game.meta.id); },
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

  openMainMenu();
  // back from the "set a new password" email link
  Online.onRecovery(() => menu.showNewPassword());

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
    renderer.render(game.viewScene, game.viewCamera);
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
}

boot().catch((e) => {
  console.error(e);
  const l = document.getElementById('loading');
  if (l) l.textContent = t('Failed to start. Please reload.');
});
