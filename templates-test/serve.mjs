// Tiny dependency-free static file server used by the smoke tests.
// Usage: node serve.mjs [root] [port]   (defaults: repository root, 4173)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(process.argv[2] ?? join(fileURLToPath(import.meta.url), '..', '..'));
const port = Number(process.argv[3] ?? process.env.PORT ?? 4173);
const types = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.gif': 'image/gif', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon', '.gexf': 'text/xml',
};

createServer(async (req, res) => {
  try {
    let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    let file = join(root, path);
    if (!file.startsWith(root)) throw new Error('outside root');
    let info = await stat(file);
    if (info.isDirectory()) {
      if (!req.url.split('?')[0].endsWith('/')) {
        res.writeHead(301, { Location: req.url.replace(/(\?|$)/, '/$1') });
        return res.end();
      }
      for (const index of ['index.html', 'index.htm']) {
        try { await stat(join(file, index)); file = join(file, index); break; } catch {}
      }
    }
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file).toLowerCase()] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}).listen(port, () => console.log(`Serving ${root} on http://localhost:${port}`));
