// Builds the GitHub Pages version of the site.
//
//   node tools/build-pages.mjs [outDir] [base]        (defaults: docs  /amore/)
//
// GitHub Pages is a plain file host: it cannot rewrite /products/royal-oud to shop.html the way tools/dev-server.mjs does,
// and a project site lives in a sub-folder (https://<user>.github.io/<repo>/). So this script
//   1. copies assets/, css/, js/ and fonts/,
//   2. prefixes every address in the two HTML pages with the sub-folder and adds <meta name="amore-base"> (js/base.js reads it),
//   3. writes one real page per route (products/<handle>/index.html and so on) from shop.html, plus 404.html.
// The sources are not changed: the dev server keeps working at the root.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Every href, src and action in `html` that points into the site gets `base` in front of it. */
export function rebase(html, base) {
  const prefix = (value) => (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#|$)/i.test(value) ? value : base + value.replace(/^\//, ''));
  const withMeta = html.replace(/(<meta charset[^>]*>)/i, `$1\n  <meta name="amore-base" content="${base}">`);
  return withMeta.replace(/(\s(?:href|src|action)=")([^"]*)"/g, (match, attribute, value) => `${attribute}${prefix(value)}"`);
}

export async function buildPages(out = join(ROOT, 'docs'), base = '/amore/') {
  if (!base.startsWith('/') || !base.endsWith('/')) throw new Error('base must look like /amore/');
  const target = resolve(out);
  if (target === ROOT || ROOT.startsWith(target + sep)) throw new Error('refusing to empty ' + target);

  const stale = spawnSync(process.execPath, [join(ROOT, 'tools', 'build-shop.mjs'), '--check'], { cwd: ROOT, encoding: 'utf8' });
  if (stale.status !== 0) throw new Error('shop.html is out of date: run npm run build:shop first');

  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  for (const dir of ['assets', 'css', 'js', 'fonts']) cpSync(join(ROOT, dir), join(target, dir), { recursive: true });

  const { PRODUCTS, COLLECTIONS, PAGES } = await import(pathToFileURL(join(ROOT, 'js', 'data', 'catalogue.js')).href);
  const home = rebase(readFileSync(join(ROOT, 'index.html'), 'utf8'), base);
  const shop = rebase(readFileSync(join(ROOT, 'shop.html'), 'utf8'), base);

  const routes = [
    ...PRODUCTS.map((p) => `products/${p.handle}`),
    ...COLLECTIONS.map((c) => `collections/${c.handle}`),
    ...PAGES.map((p) => `pages/${p.slug}`),
    'search',
    'checkout',
  ];
  writeFileSync(join(target, 'index.html'), home);
  writeFileSync(join(target, '404.html'), shop); // an unknown address shows the shop's own "not found" view
  for (const route of routes) {
    mkdirSync(join(target, route), { recursive: true });
    writeFileSync(join(target, route, 'index.html'), shop);
  }
  writeFileSync(join(target, '.nojekyll'), ''); // serve the files exactly as they are
  return routes;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const out = process.argv[2] ? resolve(process.argv[2]) : join(ROOT, 'docs');
  const base = process.argv[3] || '/amore/';
  const routes = await buildPages(out, base);
  console.log(`wrote ${out} for ${base}: index.html, 404.html and ${routes.length} route pages`);
  if (!existsSync(join(out, 'index.html'))) process.exit(1);
}
