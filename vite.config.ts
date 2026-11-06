import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import pkg from './package.json';

/**
 * The followers' town (/followers) is kept in public/followers-data/world.json. Only the dev server on the owner's
 * computer can write it and push it to GitHub; the published site just reads the file.
 */
function followersDev(): Plugin {
  const root = process.cwd();
  const dir = path.join(root, 'public', 'followers-data');
  const file = path.join(dir, 'world.json');
  const body = (req: NodeJS.ReadableStream) => new Promise<string>((ok, fail) => {
    let s = '';
    req.setEncoding('utf8');
    req.on('data', (c: string) => { s += c; });
    req.on('end', () => ok(s));
    req.on('error', fail);
  });
  return {
    name: 'followers-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__followers/world', (_req, res) => {
        if (!fs.existsSync(file)) { res.statusCode = 404; res.end(); return; }
        res.setHeader('content-type', 'application/json');
        res.end(fs.readFileSync(file));
      });
      server.middlewares.use('/__followers/save', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        try {
          const text = await body(req);
          JSON.parse(text);
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(`${file}.tmp`, text);
          fs.renameSync(`${file}.tmp`, file);
          res.end('ok');
        } catch (e) {
          res.statusCode = 400;
          res.end(String(e));
        }
      });
      server.middlewares.use('/__followers/push', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        try {
          const { people } = JSON.parse((await body(req)) || '{}') as { people?: number };
          let out = '';
          git('add', '--', 'public/followers-data');
          try { out += git('commit', '-m', `followers: the town now has ${people ?? '?'} followers`, '--', 'public/followers-data'); }
          catch { out += 'nothing new to commit\n'; }
          out += git('pull', '--rebase', '--autostash', '-q');
          out += git('push', '-q');
          res.end(out || 'ok');
        } catch (e) {
          const err = e as { stderr?: string; message?: string };
          res.statusCode = 500;
          res.end(String(err.stderr || err.message || e));
        }
      });
    },
  };
}

// base: './' — the game opens from any folder (itch.io), so paths are relative
export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [followersDev()],
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1500,
    // editor.html opens the model editor (the dev server also serves it at /editor)
    rollupOptions: { input: { main: 'index.html', editor: 'editor.html' } },
  },
  // the town file is written while the game runs: that must not reload the page
  server: { port: 5173, watch: { ignored: ['**/public/followers-data/**'] } },
});
