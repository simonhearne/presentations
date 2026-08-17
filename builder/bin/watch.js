// bin/watch.js — live preview: rebuild on save, reload the browser over SSE

import { watch, readFileSync, existsSync, statSync, realpathSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve, relative, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDeck } from './build.js';

const RELOAD_SNIPPET =
  `<script>new EventSource('/__livereload').onmessage = () => location.reload();</script>`;

export function injectReloadClient(html) {
  return html.includes('</body>')
    ? html.replace('</body>', `${RELOAD_SNIPPET}\n</body>`)
    : html + RELOAD_SNIPPET;
}

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

export function contentTypeFor(path) {
  return CONTENT_TYPES[extname(path).toLowerCase()] || 'application/octet-stream';
}

export function isIgnoredPath(relPath) {
  const parts = relPath.split(/[\\/]/);
  return parts.includes('dist')
    || parts.some(p => p.startsWith('.'))
    || relPath.endsWith('~');
}

function startServer({ repoRoot, deckIndexPath, port, clients, onListening }) {
  const server = createServer((req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      if (url.pathname === '/__livereload') {
        res.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
        });
        res.write('\n');
        clients.add(res);
        res.on('error', () => clients.delete(res));
        req.on('close', () => clients.delete(res));
        return;
      }
      let pathname = decodeURIComponent(url.pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const filePath = resolve(repoRoot, '.' + pathname);
      if (filePath !== repoRoot && !filePath.startsWith(repoRoot + sep)) {
        res.writeHead(403);
        res.end('forbidden');
        return;
      }
      if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      let body = readFileSync(filePath);
      if (filePath === deckIndexPath) {
        body = injectReloadClient(body.toString('utf8'));
      }
      res.writeHead(200, {
        'content-type': contentTypeFor(filePath),
        'cache-control': 'no-store',
      });
      res.end(body);
    } catch (err) {
      // Malformed request-line encoding (decodeURIComponent), an unparsable
      // Host header (new URL), or a file vanishing between existsSync and
      // statSync all land here — respond instead of crashing the process.
      if (res.headersSent) {
        res.destroy();
        return;
      }
      const status = err instanceof URIError ? 400 : 500;
      res.writeHead(status);
      res.end(status === 400 ? 'bad request' : 'internal error');
    }
  });
  server.on('error', err => {
    console.error(`watch server error: ${err.message}`);
    process.exit(1);
  });
  server.listen(port, '127.0.0.1', () => onListening?.());
  return server;
}

function startWatching({ repoRoot, talkDir, onSourceChange }) {
  const dirs = ['css', 'script', 'templates', 'visualisations']
    .map(d => resolve(repoRoot, d))
    .concat(talkDir)
    .filter(d => existsSync(d));
  for (const dir of dirs) {
    watch(dir, { recursive: true }, (eventType, filename) => {
      if (filename && isIgnoredPath(filename)) return;
      onSourceChange();
    });
  }
}

if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
  const args = process.argv.slice(2);
  const talkArg = args.find(a => !a.startsWith('--'));
  if (!talkArg) {
    console.error('usage: node bin/watch.js <talk-dir> [--port=N]');
    process.exit(2);
  }
  const portArg = args.find(a => a.startsWith('--port='));
  const port = portArg ? Number(portArg.slice('--port='.length)) : 4321;

  const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const talkDir = resolve(talkArg);
  const deckIndexPath = resolve(talkDir, 'dist', 'index.html');
  const clients = new Set();

  let timer = null;
  let building = false;
  let queued = false;

  async function rebuild() {
    if (building) {
      queued = true;
      return;
    }
    building = true;
    try {
      await buildDeck(talkDir);
      for (const res of clients) res.write('data: reload\n\n');
      console.log(`rebuilt ${relative(repoRoot, talkDir)}`);
    } catch (err) {
      console.error(`build failed: ${err.message}`);
    } finally {
      building = false;
      if (queued) {
        queued = false;
        rebuild();
      }
    }
  }

  await buildDeck(talkDir);
  startServer({
    repoRoot,
    deckIndexPath,
    port,
    clients,
    onListening: () => {
      console.log(`preview  http://localhost:${port}/${relative(repoRoot, talkDir)}/dist/`);
      console.log('watching for changes — ctrl-c to stop');
    },
  });
  startWatching({
    repoRoot,
    talkDir,
    onSourceChange: () => {
      clearTimeout(timer);
      timer = setTimeout(rebuild, 150);
    },
  });
}
