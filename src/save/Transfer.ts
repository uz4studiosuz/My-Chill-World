import { SAVE_VERSION, SaveStore, type WorldSave } from './SaveStore';

/**
 * Moving a world to another computer or phone: export writes the saved world to a file (.mcw, gzip-packed JSON),
 * import reads such a file and adds it to this browser's saved worlds.
 */
const MAGIC = 'mcw-world';

async function gzip(text: string): Promise<Blob> {
  if (typeof CompressionStream === 'undefined') return new Blob([text], { type: 'application/json' });
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).blob();
}

async function gunzip(buf: ArrayBuffer): Promise<string> {
  const head = new Uint8Array(buf.slice(0, 2));
  if (head[0] === 0x1f && head[1] === 0x8b) {
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open packed files');
    const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).text();
  }
  return new TextDecoder().decode(buf);
}

/** Save the world as a file in Downloads (the name and date in the file name). */
export async function exportWorld(id: string) {
  const save = SaveStore.load(id);
  if (!save) throw new Error('World not found');
  const blob = await gzip(JSON.stringify({ magic: MAGIC, v: SAVE_VERSION, exported: Date.now(), save }));
  const safe = save.meta.name.replace(/[^\p{L}\p{N} _-]+/gu, '').trim().replace(/\s+/g, '-') || 'world';
  const d = new Date();
  const name = `${safe}-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.mcw`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return name;
}

/** Read a world file and keep it in this browser; returns the world's name. */
export async function importWorld(file: File): Promise<string> {
  const text = await gunzip(await file.arrayBuffer());
  let data: { magic?: string; v?: number; save?: WorldSave } | WorldSave;
  try { data = JSON.parse(text); } catch { throw new Error('This is not a world file'); }
  const save = ('magic' in data && data.magic === MAGIC ? data.save : (data as WorldSave)) as WorldSave | undefined;
  if (!save || !save.meta || !Array.isArray(save.buildings)) throw new Error('This is not a world file');
  if (save.v !== SAVE_VERSION) throw new Error('This world comes from another version of the game');
  // a world with the same id already here: it comes in as a copy
  if (SaveStore.list().some((m) => m.id === save.meta.id)) {
    save.meta.id = SaveStore.newId();
    save.meta.name = `${save.meta.name} (2)`;
  }
  SaveStore.save(save);
  return save.meta.name;
}
