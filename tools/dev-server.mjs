// Dependency-free static dev server for the AMORE site.
//
//   npm run dev            -> http://localhost:5174
//   PORT=8080 npm run dev  -> another port
//
// /assets/* is served from ./assets. Everything else is served from the project root. HTTP Range requests are
// supported so any video you add streams and seeks properly.
//
// Routes (a refresh or a pasted link always works):
//   /                           -> index.html (the homepage)
//   /products/<handle>          -> shop.html, which renders the product page   (404 status for an unknown handle)
//   /collections/<handle>       -> shop.html, collection page                  (404 status for an unknown handle)
//   /pages/<slug>               -> shop.html, placeholder page for a footer or menu link
//   /search?q=...  /checkout    -> shop.html
// A static host without rewrites (GitHub Pages, say) cannot serve these; this server can.
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COLLECTIONS, PAGES, PRODUCTS } from '../js/data/catalogue.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT) || 5174;
const ASSETS = join(ROOT, 'assets');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2',
};

/** Resolve a request path to a file inside `base`, or null (blocks path traversal). */
function within(base, relative) {
  const file = normalize(join(base, relative));
  return file === base || file.startsWith(base + sep) ? file : null;
}

function locate(urlPath) {
  const rel = decodeURIComponent(urlPath.replace(/^\/+/, '')) || 'index.html';
  const file = within(ROOT, rel);
  if (!file || !existsSync(file)) return null;
  if (statSync(file).isDirectory()) { const index = join(file, 'index.html'); return existsSync(index) ? index : null; }
  return statSync(file).isFile() ? file : null;
}

const KNOWN = {
  products: new Set(PRODUCTS.map((p) => p.handle)),
  collections: new Set(COLLECTIONS.map((c) => c.handle)),
  pages: new Set(PAGES.map((p) => p.slug)),
};

/** Map a URL path to { file, status } or { redirect }; null falls through to plain static files. */
function route(pathname) {
  const path = pathname.replace(/\/{2,}/g, '/');
  if (path === '/') return { file: join(ROOT, 'index.html'), status: 200 };
  const shop = join(ROOT, 'shop.html');
  if (path === '/search' || path === '/checkout') return { file: shop, status: 200 };
  if (path === '/search/' || path === '/checkout/') return { redirect: path.slice(0, -1) };
  const m = /^\/(products|collections|pages)(?:\/([^/]*))?(\/)?$/.exec(path);
  if (m) {
    if (m[3] && m[2]) return { redirect: `/${m[1]}/${m[2]}` };
    const handle = m[2] ? decodeURIComponent(m[2]) : '';
    return { file: shop, status: KNOWN[m[1]].has(handle) ? 200 : 404 }; // the page itself renders the "not found" message
  }
  return null;
}

createServer((req, res) => {
  let found = null;
  let url;
  try {
    url = new URL(req.url, 'http://localhost');
    found = route(url.pathname);
    if (!found) { const file = locate(url.pathname); if (file) found = { file, status: 200 }; }
  } catch { found = null; }
  if (found && found.redirect) { res.writeHead(301, { Location: found.redirect + (url.search || '') }); res.end(); return; }
  if (!found) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found'); return; }
  const { file, status } = found;

  const { size } = statSync(file);
  const headers = { 'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    end = Math.min(end, size - 1);
    if (!(start >= 0) || start > end) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); res.end(); return; }
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
    if (req.method === 'HEAD') { res.end(); return; }
    createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(status, { ...headers, 'Content-Length': size });
  if (req.method === 'HEAD') { res.end(); return; }
  createReadStream(file).pipe(res);
}).listen(PORT, () => {
  console.log(`AMORE  ->  http://localhost:${PORT}`);
  console.log(`/assets served from:  ${ASSETS}${existsSync(ASSETS) ? '' : '  (folder missing!)'}`);
});
