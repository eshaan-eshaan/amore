// End-to-end checks against a running dev server, driven through headless Chrome or Edge (DevTools protocol).
//   npm run dev             (in one terminal)
//   node tools/verify.mjs   (in another; optional first argument: the URL, default http://localhost:5174/)
// Needs a Chromium browser: Google Chrome by default, or Microsoft Edge with
//   set CHROME_PATH=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const URL_ = process.argv[2] || 'http://localhost:5174/?nointro'; // ?nointro: the logo intro would otherwise cover the page in every fresh browser
const ORIGIN = new globalThis.URL(URL_).origin;
const ROOT = resolve(fileURLToPath(new globalThis.URL('..', import.meta.url)));
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// words of the site this one was started from (names, currency, URL paths), stored encoded so a public copy of this file does not spell them out
const OLD_PATTERN = Buffer.from('a2VuenxyYXNhc2l8Y2FuZXphfGhhd2FzfHRlcnJhYm90YW58c2hvcGlmeXxrZW56ZGVyYXNhc2l8XGJBRURcYnxlbi1hZXxhcGV4', 'base64').toString();

async function open({ w, h, mobile = false, reduce = false }) {
  const port = 9400 + Math.floor(Math.random() * 500);
  const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'amore-v-'))}`, '--no-first-run', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
  process.on('exit', () => { try { proc.kill(); } catch { /* already gone */ } });
  const json = async (p) => { for (let i = 0; i < 80; i++) { try { return await (await fetch(`http://127.0.0.1:${port}${p}`)).json(); } catch { await sleep(250); } } throw new Error('the browser did not start'); };
  await json('/json/version');
  const ws = new WebSocket((await json('/json')).find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = new Map(); const problems = []; const reqs = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data); const p = d.params || {};
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); return; }
    if (d.method === 'Runtime.exceptionThrown') problems.push('exception: ' + (p.exceptionDetails.exception?.description || p.exceptionDetails.text).split('\n')[0]);
    else if (d.method === 'Runtime.consoleAPICalled' && p.type === 'error') problems.push('console.error: ' + p.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 160));
    else if (d.method === 'Log.entryAdded' && !['info', 'verbose'].includes(p.entry.level)) problems.push(`${p.entry.level}: ${p.entry.text} ${p.entry.url || ''}`.slice(0, 200));
    else if (d.method === 'Network.requestWillBeSent') reqs.set(p.requestId, { url: p.request.url, type: p.type, status: 0 });
    else if (d.method === 'Network.responseReceived' && reqs.has(p.requestId)) reqs.get(p.requestId).status = p.response.status;
    else if (d.method === 'Network.loadingFailed' && reqs.has(p.requestId) && !p.canceled) problems.push('request failed: ' + reqs.get(p.requestId).url);
  };
  // every call has a deadline, and page reads retry once, so a browser that stops answering fails the run instead of hanging it
  const send = (method, params = {}, deadline = 20000) => new Promise((res, rej) => {
    const i = ++id;
    const timer = setTimeout(() => { pending.delete(i); rej(new Error(`no answer from the browser to ${method} within ${deadline}ms`)); }, deadline);
    pending.set(i, (d) => { clearTimeout(timer); res(d); });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const ev = async (expr, tries = 2) => {
    try {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300));
      return r.result?.result?.value;
    } catch (e) {
      if (tries > 1 && /no answer from the browser/.test(e.message)) { await sleep(600); return ev(expr, tries - 1); }
      throw e;
    }
  };
  for (const d of ['Page', 'Runtime', 'Log', 'Network']) await send(d + '.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
  if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  if (reduce) await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  return {
    ev, send, problems, reqs, w, h,
    goto: async (wait = 3000) => { await send('Page.navigate', { url: URL_ }); await sleep(wait); },
    visit: async (path, wait = 2200) => { await send('Page.navigate', { url: ORIGIN + path }); await sleep(wait); },
    reload: async (wait = 2500) => { await send('Page.reload'); await sleep(wait); },
    type: (text) => send('Input.insertText', { text }),
    scroll: async (y, wait = 450) => { await ev(`document.documentElement.style.scrollBehavior='auto'; scrollTo(0, ${Math.round(y)})`); await sleep(wait); },
    warm: async () => { const H = await ev('document.documentElement.scrollHeight'); for (let y = 0; y < H + h; y += Math.round(h * 0.6)) { await ev(`scrollTo(0, ${y})`); await sleep(220); } await ev('scrollTo(0,0)'); await sleep(500); },
    click: async (x, y) => { await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }); },
    move: (x, y) => send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, pointerType: 'mouse' }),
    // `text` is what a real key press would type; a focused <button> only activates on Enter / Space when it is present
    key: async (key, code, vk, text) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk, ...(text ? { text } : {}) }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk }); },
    center: (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`),
    close: () => { try { ws.close(); } catch { /* ignore */ } proc.kill(); },
  };
}

let passed = 0; const failures = [];
const check = (name, ok, detail = '') => { if (ok) passed++; else failures.push(`${name}${detail ? '  -> ' + detail : ''}`); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail && !ok ? '   [' + detail + ']' : ''}`); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const HANDLES = ['royal-oud', 'bleu-imperial', 'velvet-rose', 'ember-woods', 'citrus-noir', 'spiced-elixir', 'arctic-mineral', 'tobacco-oud', 'silver-vetiver', 'infinite-noir'];
const BAG_KEY = 'amore-bag-v1';
const bagState = (c) => c.ev(`JSON.stringify({ badge: (document.querySelector('[data-cart-count]') || {}).textContent, hidden: (document.querySelector('[data-cart-count]') || { hidden: true }).hidden, stored: localStorage.getItem('${BAG_KEY}') })`).then(JSON.parse);
// every image on the page (lazy ones are switched to eager first; the closed menu drawer's own images are skipped)
const imagesOk = (c) => c.ev(`(async () => {
  const imgs = [...document.images].filter((i) => !i.closest('[data-menu-drawer]'));
  imgs.forEach((i) => { i.loading = 'eager'; });
  await Promise.all(imgs.map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 6000); }))));
  return imgs.every((i) => i.complete && i.naturalWidth > 0);
})()`);

// ───────────────────────── catalogue, bag, search, routes, files (no browser) ─────────────────────────
const memoryStorage = () => ({ d: {}, getItem(k) { return k in this.d ? this.d[k] : null; }, setItem(k, v) { this.d[k] = String(v); } });
const pngSize = (file) => { const b = readFileSync(file); return b.toString('latin1', 1, 4) === 'PNG' ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null; };
const webpInfo = (file) => { const b = readFileSync(file); return b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 16) === 'WEBPVP8X' ? { alpha: !!(b[20] & 0x10), size: `${1 + b.readUIntLE(24, 3)}x${1 + b.readUIntLE(27, 3)}` } : null; };

async function units() {
  console.log('\n=== CATALOGUE, BAG, SEARCH, ROUTES, FILES (no browser)');
  const cat = await import(pathToFileURL(join(ROOT, 'js/data/catalogue.js')).href);
  const { createCart, parseStored, summarise, MAX_QTY, CART_KEY } = await import(pathToFileURL(join(ROOT, 'js/cart.js')).href);
  const { fanPose } = await import(pathToFileURL(join(ROOT, 'js/fan-pose.js')).href);
  const P = cat.PRODUCTS;

  // catalogue data
  check('ten fragrances with unique handles, in the brand document\u2019s order', P.length === 10 && new Set(P.map((p) => p.handle)).size === 10 && P.map((p) => p.handle).join() === HANDLES.join());
  check('each has a name, a slogan, three key notes, three character words and a description', P.every((p) => p.name && p.slogan && p.keyNotes.length === 3 && p.character.length === 3 && p.description.length > 120));
  check('names, slogans and key notes match the brand document for the first and last fragrance', P[0].name === 'ROYAL OUD' && P[0].slogan === 'A Legacy in Scent' && P[0].keyNotes.join() === 'Oud,Saffron,Leather' && P[9].name === 'INFINITE NOIR' && P[9].slogan === 'Intensity Without Limits' && P[9].keyNotes.join() === 'Black Pepper,Patchouli,Amber');
  check('every fragrance costs 999 rupees, the price the owner gave', P.every((p) => p.price.amount === 999 && p.price.currency === 'INR') && cat.priceLabel(P[0]) === '\u20b9999');
  const dump = JSON.stringify(P);
  check('nothing the brand did not supply is stored: no sizes, ratings, reviews, stock or delivery text', !/"(size|rating|reviews?|stock|inventory|delivery|status)\w*"/i.test(dump) && !/\b\d+\s?ml\b|in stock|delivered by/i.test(dump));
  const posters = P.map((p) => join(ROOT, 'assets', p.poster.file));
  check('all ten posters are in assets/ and are real PNGs of the size the data states', posters.every((f, i) => existsSync(f) && (pngSize(f) || []).join('x') === `${P[i].poster.width}x${P[i].poster.height}`), posters.filter((f) => !existsSync(f)).join(', '));
  const bottles = P.map((p) => join(ROOT, 'assets', p.bottle.file));
  check('all ten bottle cut-outs are in assets/bottles as WebP files with transparency, of the size the data states', bottles.every((f, i) => existsSync(f) && !!webpInfo(f)?.alpha && webpInfo(f).size === `${P[i].bottle.width}x${P[i].bottle.height}`), bottles.filter((f) => !existsSync(f)).join(', '));
  check('every fragrance has an accent colour (#rrggbb) for the bottle stage', P.every((p) => /^#[0-9a-f]{6}$/.test(p.accent)));
  const mp4Ready = (f) => { const b = readFileSync(f); const moov = b.indexOf('moov'); return b.toString('latin1', 4, 8) === 'ftyp' && moov > 0 && moov < b.indexOf('mdat'); }; // an MP4 whose index comes first starts playing before it has all downloaded
  const video = (n) => join(ROOT, 'assets', 'video', n);
  check('the smoke loop files exist (1280 and 640 wide MP4s with the index first, plus a still frame) and stay small enough for a first visit', ['amore-smoke-1280.mp4', 'amore-smoke-640.mp4', 'amore-smoke-poster.jpg'].every((n) => existsSync(video(n))) && statSync(video('amore-smoke-1280.mp4')).size < 3e6 && statSync(video('amore-smoke-640.mp4')).size < 1.5e6 && statSync(video('amore-smoke-poster.jpg')).size < 150e3 && mp4Ready(video('amore-smoke-1280.mp4')) && mp4Ready(video('amore-smoke-640.mp4')));
  const logoFiles = ['amore-wordmark-dark.png', 'amore-wordmark-light.png', 'amore-lockup-dark.png', 'amore-lockup-light.png', 'favicon.png'].map((f) => join(ROOT, 'assets', 'logo', f));
  check('the logo files exist (bronze and champagne wordmark and lockup, plus the tab icon) and are transparent PNGs', logoFiles.every((f) => existsSync(f) && readFileSync(f)[25] === 6), logoFiles.filter((f) => !existsSync(f)).join(', '));
  check('one collection holds all ten; routes are /products, /collections, /search, /checkout', cat.COLLECTIONS.length === 1 && cat.COLLECTIONS[0].products.length === 10 && cat.productUrl('royal-oud') === '/products/royal-oud' && cat.collectionUrl('x') === '/collections/x' && cat.searchUrl('a b') === '/search?q=a%20b' && cat.CHECKOUT_URL === '/checkout');
  check('suggestions are the next four fragrances, wrapping round, never the product itself', cat.relatedProducts('royal-oud').map((p) => p.handle).join() === 'bleu-imperial,velvet-rose,ember-woods,citrus-noir' && cat.relatedProducts('infinite-noir').map((p) => p.handle).join() === 'royal-oud,bleu-imperial,velvet-rose,ember-woods');

  // price format
  check('rupees are written the Indian way: \u20b9999, \u20b92,997, \u20b9123.45, \u20b910,00,000', cat.formatMoney(99900) === '\u20b9999' && cat.formatMoney(299700) === '\u20b92,997' && cat.formatMoney(12345) === '\u20b9123.45' && cat.formatMoney(100000000) === '\u20b910,00,000');

  // search
  const names = (q) => cat.searchProducts(q).map((p) => p.handle);
  check('search finds oud by name in both fragrances that carry it', names('oud').sort().join() === 'royal-oud,tobacco-oud' && names('OUD').length === 2);
  check('search ignores case and extra spaces', names('  royal    OUD ')[0] === 'royal-oud' && names('VELVET rose').join() === 'velvet-rose');
  check('search folds accents: "bleu imperial", "impérial" and "IMPERIAL" all find Bleu Impérial', names('bleu imperial').join() === 'bleu-imperial' && names('impérial')[0] === 'bleu-imperial' && names('IMPERIAL')[0] === 'bleu-imperial');
  check('search matches key notes (amber), character words (fresh) and descriptions (glacial)', names('amber').length >= 4 && names('amber').includes('ember-woods') && names('fresh').includes('bleu-imperial') && names('glacial').join() === 'arctic-mineral');
  const [vanilla, oud, both] = [names('vanilla'), names('oud'), names('oud vanilla')];
  check('every word has to match: "oud vanilla" is the overlap of the two', both.length >= 1 && both.every((h) => vanilla.includes(h) && oud.includes(h)) && names('oud zzzz').length === 0);
  check('search returns nothing for gibberish and for an empty query', names('zzzzqqq').length === 0 && names('').length === 0 && names('   ').length === 0);
  check('the closest name comes first ("noir" lists the two Noir fragrances before anything that only mentions it)', names('noir').slice(0, 2).sort().join() === 'citrus-noir,infinite-noir');

  // bag
  const storage = memoryStorage();
  const cart = createCart({ storage, lookup: cat.getProduct });
  check('bag starts empty', cart.count() === 0 && cart.summary().items.length === 0 && cart.summary().subtotal === 0);
  check('add: two of one fragrance, then one more, merge into one line of 3', cart.add('royal-oud', 2).ok && cart.add('royal-oud').ok && cart.lines.length === 1 && cart.count() === 3);
  check('subtotal is exact: 3 x \u20b9999 = \u20b92,997', cart.summary().subtotal === 299700 && cat.formatMoney(cart.summary().subtotal) === '\u20b92,997');
  check('setQty changes a line and 0 removes it', cart.setQty('royal-oud', 5) && cart.summary().subtotal === 499500 && cart.setQty('royal-oud', 0) && cart.count() === 0);
  cart.add('velvet-rose'); cart.add('citrus-noir', 2);
  check('two fragrances: count 3, subtotal \u20b92,997, two lines', cart.count() === 3 && cart.summary().subtotal === 299700 && cart.summary().items.length === 2);
  check('remove deletes the line and the subtotal follows', cart.remove('citrus-noir') && cart.summary().subtotal === 99900 && !cart.remove('citrus-noir'));
  check('the bag is saved as handles and quantities only (no prices) and a new store reads it back', JSON.parse(storage.d[CART_KEY]).lines.length === 1 && !/price|999|INR/i.test(storage.d[CART_KEY]) && createCart({ storage, lookup: cat.getProduct }).count() === 1);
  check(`quantity is capped at ${MAX_QTY}`, (() => { const c2 = createCart({ storage: memoryStorage(), lookup: cat.getProduct }); c2.add('royal-oud', 99); return c2.count() === MAX_QTY && c2.add('royal-oud').capped === true; })());
  check('an unknown fragrance cannot be added', createCart({ storage: memoryStorage(), lookup: cat.getProduct }).add('nope').reason === 'unknown-product');
  check('a product without a price is blocked from the bag', createCart({ storage: memoryStorage(), lookup: () => ({ handle: 'x', price: null }) }).add('x').reason === 'no-verified-price');
  check('prices are never read from storage (a tampered price and an unknown handle are ignored)', (() => {
    const s = memoryStorage(); s.setItem(CART_KEY, JSON.stringify({ v: 1, lines: [{ handle: 'royal-oud', qty: 2, price: 1 }, { handle: 'ghost', qty: 4 }] }));
    const c3 = createCart({ storage: s, lookup: cat.getProduct }); c3.attach(cat.getProduct);
    return c3.summary().subtotal === 199800 && c3.count() === 2;
  })());
  check('floating-point prices do not drift (3 x 19.99 = 59.97)', summarise([{ handle: 'p', qty: 3 }], () => ({ price: { amount: 19.99, currency: 'INR' } })).subtotal === 5997);
  check('broken storage content gives an empty bag, not an error', parseStored('garbage').length === 0 && parseStored('{"v":2}').length === 0 && parseStored(null).length === 0 && parseStored('{"v":1,"lines":[{"handle":"a","qty":-3}]}').length === 0);
  check('storage that throws does not break the bag', (() => { const bad = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); } }; const c4 = createCart({ storage: bad, lookup: cat.getProduct }); return c4.add('royal-oud').ok && c4.count() === 1; })());

  // fan geometry for ten tiles
  const [fa, fb, fm] = [fanPose(-4.5), fanPose(4.5), fanPose(0.5)];
  check('fan geometry: ten tiles are laid out symmetrically around the middle', near(fa.tx, -441, 1) && near(fb.tx, 441, 1) && near(fa.rot, -31.5, 0.1) && near(fa.ty, fb.ty, 0.01) && near(fm.tx, 58, 0.5) && fanPose(0).tx === 0 && fanPose(-1).tx === -116);

  // routes
  const status = async (path) => (await fetch(ORIGIN + path, { redirect: 'manual' })).status;
  const routes = [['/', 200], ['/products/royal-oud', 200], ['/products/nope', 404], ['/collections/the-fragrance-collection', 200], ['/collections/x', 404], ['/pages/about', 200], ['/pages/nope', 404], ['/search?q=oud', 200], ['/checkout', 200], ['/products/royal-oud/', 301], ['/missing.txt', 404], ['/assets/logo/amore-wordmark-dark.png', 200],['/assets/01_Royal_Oud.png', 200], ['/assets/bottles/01_Royal_Oud.webp', 200],['/en-ae', 404], ['/js/shop.js', 200], ['/css/shop.css', 200]];
  const got = []; for (const [p, want] of routes) got.push([p, want, await status(p)]);
  check('routes answer with the right status (200 known, 404 unknown, 301 trailing slash)', got.every(([, w, g]) => w === g), got.filter(([, w, g]) => w !== g).map(([p, w, g]) => `${p} wanted ${w} got ${g}`).join('; '));
  const allRoutes = [...P.map((p) => p.url), ...cat.COLLECTIONS.map((c) => c.url), ...cat.PAGES.map((p) => cat.pageUrl(p.slug))];
  const codes = []; for (const p of allRoutes) codes.push(await status(p));
  check(`every product (10), the collection and the ${cat.PAGES.length} placeholder pages load directly`, codes.every((s) => s === 200), allRoutes.filter((_, i) => codes[i] !== 200).join(', '));
  check('path traversal is refused', (await status('/..%2f..%2fpackage.json')) !== 200 && (await status('/assets/..%2f..%2fpackage.json')) !== 200);

  // homepage links
  const home = await (await fetch(ORIGIN + '/')).text();
  const hrefs = [...home.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)].map((m) => m[1]);
  check('the homepage has no placeholder (#) links', !hrefs.includes('#'));
  const internal = [...new Set(hrefs.filter((h) => h.startsWith('/')).map((h) => h.split('?')[0]))];
  const bad = []; for (const h of internal) if ((await status(h)) !== 200) bad.push(h);
  check(`all ${internal.length} internal homepage links resolve (200)`, bad.length === 0, bad.join(', '));
  check('the homepage links to every one of the ten fragrances and to the collection', HANDLES.every((h) => hrefs.includes(`/products/${h}`)) && hrefs.includes('/collections/the-fragrance-collection'));

  // chrome is shared: shop.html must be the generated copy of the homepage chrome
  const shopHtml = await (await fetch(ORIGIN + '/products/royal-oud')).text();
  const strip = (h, from, to) => h.slice(h.indexOf(from), to ? h.indexOf(to) : undefined).replace(/(src|href|srcset)="\/?(assets|css|js|fonts)\//g, '$1="$2/').replace(/\s+/g, ' ');
  check('shop.html carries exactly the homepage header, drawers and footer (generated by tools/build-shop.mjs)', strip(shopHtml, '<!-- ───────────── announcement bar', '<!-- ───────────── page') === strip(home, '<!-- ───────────── announcement bar', '<!-- ───────────── page') && strip(shopHtml, '<!-- ───────────── footer', '</body>') === strip(home, '<!-- ───────────── footer', '</body>'));

  // the project is clean of the previous brand
  const walk = (dir) => readdirSync(dir).flatMap((n) => { const f = join(dir, n); if (/node_modules|^\.git$/.test(n) || /OFL\.txt$/.test(n)) return []; return statSync(f).isDirectory() ? walk(f) : [f]; });
  const textFiles = walk(ROOT).filter((f) => /\.(html|css|js|mjs|json|md|svg|txt)$/.test(f) && !/tools[\\/]verify\.mjs$/.test(f));
  const leftovers = textFiles.filter((f) => new RegExp(OLD_PATTERN, 'i').test(readFileSync(f, 'utf8'))).map((f) => relative(ROOT, f));
  check('no text file mentions the previous brand, its products, its currency or its URL paths', leftovers.length === 0, leftovers.join(', '));
  const fontFiles = ['jost', 'playfair-display'].flatMap((d) => readdirSync(join(ROOT, 'fonts', d)));
  check('both typefaces are self-hosted: 8 WOFF2 files and a licence text for each family', fontFiles.filter((f) => f.endsWith('.woff2')).length === 8 && fontFiles.filter((f) => f === 'OFL.txt').length === 2);
}

// ───────────────────────── homepage, desktop ─────────────────────────
async function desktop() {
  console.log('\n=== HOMEPAGE, DESKTOP 1440x900');
  const c = await open({ w: 1440, h: 900 });
  await c.goto(3500);

  const hosts = [...new Set([...c.reqs.values()].map((r) => new globalThis.URL(r.url).host))].filter(Boolean); // data: URLs have no host
  check('no console errors or failed requests on load', c.problems.length === 0, c.problems.join(' | '));
  check('only this server is contacted (fonts are self-hosted)', hosts.every((h) => h === new globalThis.URL(ORIGIN).host), hosts.join(', '));
  check('Jost is served from /fonts and applied', await c.ev(`document.fonts.check('16px Jost') && getComputedStyle(document.body).fontFamily.startsWith('Jost')`) && [...c.reqs.values()].some((r) => /\/fonts\/jost\/jost-latin-normal\.woff2/.test(r.url) && r.status === 200));
  check('page title and wordmark say AMORE', await c.ev(`document.title.startsWith('AMORE') && document.querySelector('.header-logo img.logo-dark').alt === 'AMORE' && document.querySelector('.header-logo-link').getAttribute('aria-label').startsWith('AMORE')`));
  check('the page never shows the previous brand', await c.ev(`!new RegExp(${JSON.stringify(OLD_PATTERN)}, 'i').test(document.body.innerText + document.title)`));

  // announcement
  const seen = []; const t0 = Date.now();
  while (Date.now() - t0 < 9000) {
    const now = await c.ev(`(() => { const e = document.elementFromPoint(720, 15); const s = e && (e.closest('.announcement-slide') || e); return s ? s.textContent.trim().slice(0, 12) : '?'; })()`);
    if (seen.length === 0 || seen[seen.length - 1].text !== now) seen.push({ text: now, at: Date.now() - t0 });
    await sleep(120);
  }
  const gaps = seen.slice(2).map((s, i) => s.at - seen[i + 1].at);
  check('announcement rotates on its own, about every 3s, and loops', seen.length >= 3 && new Set(seen.map((s) => s.text)).size === 2 && gaps.every((g) => g > 2500 && g < 3600), seen.map((s) => `${s.at}ms ${s.text}`).join(' | '));
  check('announcement carries the brand\u2019s own words and its close button stays hidden', await c.ev(`(() => { const t = document.querySelector('#announcement').textContent; const b = document.querySelector('[data-announcement-close]'); return /Passion in every drop/.test(t) && /Ten distinct scent identities/.test(t) && b.hidden && getComputedStyle(b).display === 'none' && document.querySelector('#announcement').offsetHeight === 30; })()`));

  check('the smoke video is not fetched until the bottle section is near the screen', await c.ev(`!document.querySelector('.lineup-smoke video').getAttribute('src')`));

  // hero
  check('the hero stage holds all ten posters twice (the second set makes the loop seamless)', await c.ev(`document.querySelectorAll('.hero-strip img').length === 20 && getComputedStyle(document.querySelector('.hero-strip')).animationName !== 'none'`));
  check('the poster strip starts below the header so the logo never covers the posters\u2019 own "AMORE"', await c.ev(`document.querySelector('.hero-strip').getBoundingClientRect().top >= 80`));
  for (const y of [0, 450, 900, 1260, 1700]) {
    await c.scroll(y);
    const r = await c.ev(`(() => { const s = document.querySelector('[data-hero-stage]'); const m = new DOMMatrix(getComputedStyle(s).transform); return [m.a, parseFloat(s.style.borderRadius) || 0, parseFloat(document.querySelector('[data-hero-marquee]').style.opacity)]; })()`);
    const p = Math.min(1, y / 1260);
    check(`hero at scroll ${y}: scale ${(1 - 0.6 * p).toFixed(3)}, radius ${(12 * p).toFixed(1)}px`, near(r[0], 1 - 0.6 * p, 0.012) && near(r[1], 12 * p, 0.6), JSON.stringify(r));
    if (y === 450) check('hero marquee ("Passion in every drop") has faded in by p=.36', r[2] > 0.7, String(r[2]));
    if (y === 0) check('hero marquee is hidden at the top', r[2] === 0, String(r[2]));
  }
  check('the header is white over the dark hero at the top', await (async () => { await c.scroll(0, 600); return c.ev(`getComputedStyle(document.querySelector('#main-header')).color === 'rgb(255, 255, 255)' && getComputedStyle(document.querySelector('#main-header')).backgroundColor === 'rgba(0, 0, 0, 0)'`); })());
  await c.scroll(2400, 700);
  check('the statement slides over the end of the hero and carries the tagline', await c.ev(`(() => { const s = document.querySelector('.statement'); const r = s.getBoundingClientRect(); return r.top < 900 && r.bottom > 0 && /PASSION IN EVERY DROP/i.test(s.innerText) && /Ten distinct scent identities/.test(s.innerText); })()`));

  // header
  await c.scroll(1500); await c.scroll(1300, 600);
  check('header returns as a fixed paper-coloured bar when scrolling up, with dark icons', await c.ev(`(() => { const h = document.querySelector('#main-header'); const s = getComputedStyle(h); return h.classList.contains('header-scroll-up') && s.position === 'fixed' && s.color === 'rgb(29, 20, 22)'; })()`));
  await c.scroll(1700, 600);
  check('header scrolls away when scrolling down', await c.ev(`!document.querySelector('#main-header').classList.contains('header-scroll-up')`));
  const bar = () => c.ev(`document.querySelector('#main-header').classList.contains('header-scroll-up') && document.querySelector('#announcement').classList.contains('header-scroll-up')`);
  await c.scroll(0, 700); await c.scroll(1500, 700); await c.scroll(1496, 500);
  check('a 4px nudge up does not bring the bar back', !(await bar()));
  await c.scroll(1491, 500);
  check('a 5px nudge up brings it back', await bar());
  await c.scroll(1492, 500);
  check('a 1px step down switches it off at once', !(await bar()));
  await c.scroll(1400, 500); await c.scroll(60, 700);
  check('the bar stays on while scrolling up the page, still there at scrollY = 60', await bar());
  const shownLogo = () => c.ev(`[...document.querySelectorAll('.header-logo img')].filter((i) => i.getBoundingClientRect().width > 0).map((i) => i.getAttribute('src').split('/').pop()).join()`);
  check('on the paper bar the header shows the dark bronze logo', (await shownLogo()) === 'amore-wordmark-dark.png');
  await c.scroll(0, 900);
  check('...and goes away only at the very top', !(await bar()));
  check('over the dark hero the header shows the light champagne logo', (await shownLogo()) === 'amore-wordmark-light.png');
  await c.scroll(0, 300);

  // menu
  const menuAt = await c.center('[data-menu-open]'); await c.click(...menuAt); await sleep(1000);
  check('menu drawer opens with the collection, ten fragrances and two pages', await c.ev(`(() => { const d = document.querySelector('[data-menu-drawer]'); const r = d.getBoundingClientRect(); const links = [...d.querySelectorAll('.header-menu-item')].map((a) => a.getAttribute('href')); return d.classList.contains('open') && r.left >= 0 && r.width > 1000 && links.length === 11 && links[0] === '/collections/the-fragrance-collection' && d.querySelectorAll('.menu-secondary a').length === 2; })()`));
  check('menu items carry each fragrance\u2019s slogan', await c.ev(`[...document.querySelectorAll('.header-menu-item .menu-item-subtitle')].map((s) => s.textContent).includes('The Chill of Elegance')`));
  check('menu names are written in normal capitals (Royal Oud, not ROyal Oud) and match the catalogue', await c.ev(`(async () => { const { PRODUCTS } = await import('/js/data/catalogue.js'); const shown = [...document.querySelectorAll('.header-menu-item:not(.header-menu-item--head) > span:first-child')].map((s) => s.textContent.replace(/^\\S+\\s/, '')); const cap = (s) => s.toLowerCase().replace(/(^|\\s)(\\S)/g, (m, a, b) => a + b.toUpperCase()); return shown.length === 10 && shown.every((n, i) => n === cap(PRODUCTS[i].name) && !/[A-Z]{2}/.test(n)); })()`));
  check('the two big menu posters are shown whole, not cropped', await c.ev(`(() => { const imgs = [...document.querySelectorAll('.image-card img')]; return imgs.length === 2 && imgs.every((i) => i.complete && i.naturalWidth > 0 && getComputedStyle(i).objectFit === 'contain'); })()`));
  await c.click(...(await c.center('[data-tiles-next]'))); await sleep(500);
  check('menu "Featured" slider advances (2/3)', await c.ev(`document.querySelector('[data-tiles-fraction]').textContent === '2/3'`));
  check('while the menu is open the page behind it is inert and focus stays inside', await c.ev(`document.querySelector('#main').inert && document.querySelector('[data-menu-drawer]').contains(document.activeElement)`));
  await c.key('Escape', 'Escape', 27); await sleep(900);
  check('Escape closes the menu and returns focus to the menu button', await c.ev(`!document.querySelector('[data-menu-drawer]').classList.contains('open') && !document.documentElement.classList.contains('no-scroll') && !document.querySelector('#main').inert && document.activeElement === document.querySelector('[data-menu-open]')`));
  await c.click(...menuAt); await sleep(900);
  await c.click(1380, 450); await sleep(900);
  check('clicking outside the menu closes it', await c.ev(`!document.querySelector('[data-menu-drawer]').classList.contains('open')`));
  await c.click(...menuAt); await sleep(900);
  await c.ev(`document.querySelector('[data-menu-close]').focus()`);
  await c.key('Enter', 'Enter', 13, '\r'); await sleep(900);
  check('the menu close button works from the keyboard (Enter)', await c.ev(`!document.querySelector('[data-menu-drawer]').classList.contains('open')`));

  // bag (empty) and search
  const cartAt = await c.center('[data-cart-open]'); await c.click(...cartAt); await sleep(900);
  check('bag drawer opens (450px, from the right) and says it is empty', await c.ev(`(() => { const r = document.querySelector('#cart-overlay aside').getBoundingClientRect(); return document.querySelector('#cart-overlay').classList.contains('expanded') && Math.abs(r.left - 990) < 3 && Math.abs(r.width - 450) < 2 && /Your bag is currently empty/.test(document.querySelector('#cart-overlay').innerText); })()`));
  await c.key('Escape', 'Escape', 27); await sleep(700);
  check('Escape closes the bag', await c.ev(`!document.querySelector('#cart-overlay').classList.contains('expanded')`));
  await c.click(...cartAt); await sleep(800); await c.click(300, 450); await sleep(700);
  check('clicking outside closes the bag', await c.ev(`!document.querySelector('#cart-overlay').classList.contains('expanded')`));
  await c.click(...cartAt); await sleep(800); await c.click(...(await c.center('.cart-continue'))); await sleep(700);
  check('"Continue shopping" closes the bag', await c.ev(`!document.querySelector('#cart-overlay').classList.contains('expanded')`));
  await c.click(...(await c.center('[data-search-toggle]'))); await sleep(700);
  check('search icon opens an inline field and focuses it', await c.ev(`document.querySelector('[data-search-form]').classList.contains('is-open') && document.activeElement === document.querySelector('[data-search-input]')`));
  await c.type('rose'); await sleep(900);
  check('typing opens the search drawer with Velvet Rose, its notes and price', await c.ev(`(() => { const a = [...document.querySelectorAll('.predictive-item')]; return document.querySelector('#search-overlay').classList.contains('expanded') && a.length === 1 && /VELVET ROSE/.test(a[0].innerText) && /Rose · Raspberry · Musk · ₹999/.test(a[0].innerText) && a[0].getAttribute('href') === '/products/velvet-rose'; })()`));
  await c.key('Escape', 'Escape', 27); await sleep(900);
  check('Escape closes search', await c.ev(`!document.querySelector('#search-overlay').classList.contains('expanded')`));

  // statement headline, bottle parade, moving bands, collection grid, side posters, fan
  await c.warm();
  const stTop = await c.ev(`document.querySelector('.statement').getBoundingClientRect().top + scrollY`);
  await c.scroll(stTop - 100, 1800);
  check('the statement headline rises word by word and still reads "Passion in every drop"', await c.ev(`(() => { const h = document.querySelector('.statement-title'); return h.classList.contains('is-split') && h.classList.contains('is-in') && h.querySelectorAll('.split-word').length === 4 && h.textContent === 'Passion in every drop'; })()`));
  const lt = await c.ev(`document.querySelector('[data-lineup]').getBoundingClientRect().top + scrollY`);
  await c.scroll(lt - 60, 1800);
  check('the bottle parade lists the ten bottles in catalogue order, each linking to its fragrance, plus a hidden second set for the loop', await c.ev(`(async () => { const { PRODUCTS } = await import('/js/data/catalogue.js'); const lis = [...document.querySelectorAll('.lineup-track li')]; const a = (li) => li.querySelector('a'); return lis.length === 20 && lis.slice(0, 10).every((li, i) => a(li).getAttribute('href') === PRODUCTS[i].url && li.querySelector('.lineup-name').textContent === PRODUCTS[i].name && li.querySelector('.lineup-slogan').textContent === PRODUCTS[i].slogan && !li.hasAttribute('aria-hidden')) && lis.slice(10).every((li, i) => li.getAttribute('aria-hidden') === 'true' && a(li).tabIndex === -1 && a(li).getAttribute('href') === PRODUCTS[i].url); })()`));
  const lstate = await c.ev(`(() => { const s = document.querySelector('[data-lineup]'); const i = s.querySelector('.lineup-item img'); const r = i.getBoundingClientRect(); return { isIn: s.classList.contains('is-in'), opacity: getComputedStyle(s.querySelector('.lineup-viewport')).opacity, h: Math.round(r.height), ratio: +(r.width / r.height).toFixed(4), loaded: i.complete && i.naturalWidth === 600, fit: getComputedStyle(i).objectFit }; })()`);
  check('the parade rises into view; its bottles stand 300-560px tall, whole (not cropped) and loaded', lstate.isIn && lstate.opacity === '1' && lstate.h >= 300 && lstate.h <= 560 && Math.abs(lstate.ratio - 600 / 1103) < 0.01 && lstate.loaded && lstate.fit !== 'cover', JSON.stringify(lstate));
  check('the parade moves on its own', await c.ev(`(() => { const t = getComputedStyle(document.querySelector('.lineup-track')); return t.animationName === 'lineup' && t.animationPlayState === 'running'; })()`));
  const lmid = await c.ev(`(() => { const r = [...document.querySelectorAll('.lineup-item')].map((el) => el.getBoundingClientRect()).find((b) => b.left > innerWidth * 0.35 && b.right < innerWidth * 0.8); return r ? [Math.round(r.left + r.width * 0.8), Math.round(r.top + r.height / 2)] : null; })()`);
  await c.move(...lmid); await sleep(500);
  check('over a bottle the stage takes that bottle’s colour', await c.ev(`(async () => { const { PRODUCTS } = await import('/js/data/catalogue.js'); const s = document.querySelector('[data-lineup]'); const hov = [...document.querySelectorAll('.lineup-item')].find((el) => el.matches(':hover')); return !!hov && s.style.getPropertyValue('--tint') === hov.dataset.accent && PRODUCTS.some((p) => p.accent === hov.dataset.accent); })()`));
  check('the bottle under the pointer tilts towards it, and the gold ring grows over the link', await c.ev(`(() => { const hov = [...document.querySelectorAll('.lineup-item')].find((el) => el.matches(':hover')); const ring = document.querySelector('.cursor-ring'); return !!hov && parseFloat(hov.style.getPropertyValue('--ry')) > 3 && getComputedStyle(hov.querySelector('img')).transform.startsWith('matrix3d') && !!ring && ring.classList.contains('is-on') && ring.classList.contains('is-link') && getComputedStyle(ring).pointerEvents === 'none'; })()`));
  check('the parade pauses while the pointer is over it', await c.ev(`getComputedStyle(document.querySelector('.lineup-track')).animationPlayState === 'paused'`));
  await c.move(8, 8); await sleep(400);
  check('...and carries on when the pointer leaves', await c.ev(`getComputedStyle(document.querySelector('.lineup-track')).animationPlayState === 'running'`));
  check('smoke behind the bottles: a silent video loop (the 1280 file) is playing, screen-blended, decorative, and sits behind the heading and the bottles', await c.ev(`(async () => { const s = document.querySelector('.lineup-smoke'); const v = s.querySelector('video'); const t0 = v.currentTime; await new Promise((r) => setTimeout(r, 700)); const after = (el) => !!(s.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING); const st = getComputedStyle(s); return v.currentSrc.endsWith('amore-smoke-1280.mp4') && v.muted && v.loop && v.playsInline && !v.paused && v.readyState >= 2 && v.currentTime > t0 && v.classList.contains('is-playing') && s.getAttribute('aria-hidden') === 'true' && st.mixBlendMode === 'screen' && st.pointerEvents === 'none' && after(document.querySelector('.lineup-head')) && after(document.querySelector('.lineup-viewport')); })()`));
  const bandTop = await c.ev(`document.querySelector('[data-band]').getBoundingClientRect().top + scrollY`);
  const bandX = () => c.ev(`new DOMMatrix(getComputedStyle(document.querySelector('.band-track')).transform).e`);
  await c.scroll(bandTop - 700, 500); const a1 = await bandX();
  await c.scroll(bandTop - 200, 500); const a2 = await bandX();
  check('the moving headline slides left as you scroll down (and there is just the one)', (await c.ev(`document.querySelectorAll('[data-band]').length === 1`)) && a2 < a1 - 50, `${a1} -> ${a2}`);
  check('the band carries the brand’s own slogan, is decorative, and never leaves a gap at either edge', await c.ev(`(() => { const a = document.querySelector('[data-band]'); const t = a.querySelector('.band-track').getBoundingClientRect(); return a.getAttribute('aria-hidden') === 'true' && /Passion in every drop/.test(a.textContent) && t.left <= 1 && t.right >= innerWidth - 1; })()`));
  await c.scroll(0, 700);
  check('the smoke video pauses when the section is far off screen (no needless work for the browser)', await c.ev(`document.querySelector('.lineup-smoke video').paused`));
  const sg = await c.ev(`document.querySelector('[data-reveal-grid]').getBoundingClientRect().top + scrollY`);
  await c.scroll(sg - 200, 1800);
  check('the collection grid shows ten cards in five columns, each linking to its fragrance with the \u20b9999 price', await c.ev(`(() => { const g = document.querySelector('[data-reveal-grid]'); const cards = [...g.querySelectorAll('.collection-card')]; return getComputedStyle(g).gridTemplateColumns.split(' ').length === 5 && cards.length === 10 && cards.every((a) => /^\\/products\\//.test(a.getAttribute('href')) && /₹999/.test(a.innerText) && a.querySelector('img').naturalWidth > 0); })()`));
  check('cards fade in once they arrive', await c.ev(`[...document.querySelectorAll('.collection-card')].slice(0, 5).every((a) => a.classList.contains('is-in') && getComputedStyle(a).opacity === '1')`));
  const ch = await c.ev(`document.querySelector('[data-chase]').getBoundingClientRect().top + scrollY`);
  await c.scroll(ch - 800);
  const tx = await c.ev(`new DOMMatrix(getComputedStyle(document.querySelector('.chase-arrival-image.is-left [data-chase-image]')).transform).e`);
  check('side poster starts off-screen (-80% of 460px)', tx < -300 && tx > -380, String(tx));
  await c.scroll(ch + 150);
  check('side posters arrive at their resting place', await c.ev(`Math.abs(new DOMMatrix(getComputedStyle(document.querySelector('.chase-arrival-image.is-left [data-chase-image]')).transform).e) < 2`));
  check('the side posters belong to the first and last fragrance and link to them', await c.ev(`(() => { const t = [...document.querySelectorAll('.chase-arrival-cta')].map((a) => a.getAttribute('href')); return t.join() === '/products/royal-oud,/products/infinite-noir' && /ROYAL OUD/.test(document.querySelector('.chase-arrival-title').textContent); })()`));
  const fan = await c.ev(`document.querySelector('[data-fan-section]').getBoundingClientRect().top + scrollY`);
  await c.scroll(fan - 250, 2200);
  const pose = (i) => c.ev(`(() => { const m = new DOMMatrix(getComputedStyle(document.querySelectorAll('.fan-tile')[${i}]).transform); return [m.e, m.f, Math.atan2(m.b, m.a) * 180 / Math.PI]; })()`);
  const [p0, p9, p4] = [await pose(0), await pose(9), await pose(4)];
  check('the fan opens: ten tiles spread symmetrically (outer tiles at \u00b1441px, \u00b131.5\u00b0), the middle ones nearly upright', near(p0[0], -441, 6) && near(p9[0], 441, 6) && near(p0[2], -31.5, 1.5) && near(p9[2], 31.5, 1.5) && near(p0[1], p9[1], 2) && Math.abs(p4[2]) < 4 && await c.ev(`document.querySelectorAll('.fan-tile').length === 10`));
  await c.ev(`document.querySelectorAll('.fan-tile')[7].dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }))`); await sleep(900);
  check('hovering a tile pulls it forward (and the resting front tile steps back)', await c.ev(`(() => { const t = document.querySelectorAll('.fan-tile'); return t[7].classList.contains('is-front') && !t[4].classList.contains('is-front'); })()`));
  await c.ev(`document.querySelector('[data-fan]').dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }))`); await sleep(500);
  check('moving away puts the middle tile back in front', await c.ev(`document.querySelectorAll('.fan-tile')[4].classList.contains('is-front')`));

  // footer
  check('the footer has the ten fragrances, the house pages and the brand line', await c.ev(`(() => { const f = document.querySelector('footer.new-footer'); return f.querySelectorAll('.footer-products a').length === 10 && f.querySelectorAll('.footer-accordion-item').length === 2 && /Passion in every drop/.test(f.innerText); })()`));
  check('no console errors or failed requests during the desktop run', c.problems.length === 0, c.problems.slice(0, 4).join(' | '));
  c.close();
}

// ───────────────────────── homepage, phone ─────────────────────────
async function phone() {
  console.log('\n=== HOMEPAGE, PHONE 390x844');
  const c = await open({ w: 390, h: 844, mobile: true });
  await c.goto(3500);
  check('no console errors or failed requests on load (phone)', c.problems.length === 0, c.problems.join(' | '));
  check('header wordmark is 165px wide on phones', near(await c.ev(`[...document.querySelectorAll('.header-logo img')].find((i) => i.getBoundingClientRect().width > 0).getBoundingClientRect().width`), 165, 1));
  check('announcement bar is 46px (two lines) on phones', (await c.ev(`document.querySelector('#announcement').offsetHeight`)) === 46);
  check('the hero stage shows the posters one at a time, below the header', await c.ev(`(() => { const i = document.querySelector('.hero-strip img'); const r = i.getBoundingClientRect(); return r.top >= 96 && r.width > 280 && r.width < 390; })()`));
  for (const y of [0, 422, 844, 1100]) {
    await c.scroll(y);
    const r = await c.ev(`new DOMMatrix(getComputedStyle(document.querySelector('[data-hero-stage]')).transform).a`);
    const p = Math.min(1, y / 844);
    check(`phone hero at scroll ${y}: scale ${(1 - 0.45 * p).toFixed(3)}`, near(r, 1 - 0.45 * p, 0.012), String(r));
  }
  await c.scroll(0);
  await c.click(...(await c.center('[data-menu-open]'))); await sleep(1000);
  check('phone menu opens, fills the screen and lists the ten fragrances (no big image cards)', await c.ev(`(() => { const r = document.querySelector('[data-menu-drawer]').getBoundingClientRect(); return r.width > 360 && r.height > 800 && document.querySelectorAll('.header-menu-item').length === 11 && getComputedStyle(document.querySelector('.menu-three-column')).display === 'none'; })()`));
  await c.click(...(await c.center('[data-menu-close]'))); await sleep(900);
  check('phone menu closes', await c.ev(`!document.querySelector('[data-menu-drawer]').classList.contains('open')`));
  await c.click(...(await c.center('[data-cart-open]'))); await sleep(900);
  check('phone bag drawer fits the screen', await c.ev(`(() => { const r = document.querySelector('#cart-overlay aside').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1; })()`));
  await c.click(...(await c.center('#cart-overlay .close'))); await sleep(700);
  await c.warm();
  const lp = await c.ev(`document.querySelector('[data-lineup]').getBoundingClientRect().top + scrollY`);
  await c.scroll(lp - 40, 1600);
  check('phone: the bottle parade shows whole bottles 260-400px tall that fit the screen, and nothing sticks out sideways', await c.ev(`(() => { const s = document.querySelector('[data-lineup]'); const r = s.querySelector('.lineup-item img').getBoundingClientRect(); const t = s.querySelector('.lineup-title').getBoundingClientRect(); return s.classList.contains('is-in') && r.height >= 260 && r.height <= 400 && r.height < innerHeight * 0.6 && t.left >= 0 && t.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth; })()`));
  check('phone: the smaller 640 smoke file is the one fetched', await c.ev(`(document.querySelector('.lineup-smoke video').getAttribute('src') || '').endsWith('amore-smoke-640.mp4')`));
  check('phone: no gold ring (touch screen) and the moving band fits the screen', await c.ev(`!document.querySelector('.cursor-ring') && [...document.querySelectorAll('[data-band]')].every((b) => b.getBoundingClientRect().width <= innerWidth + 1)`));
  check('collection grid is two columns on phones', await c.ev(`getComputedStyle(document.querySelector('[data-reveal-grid]')).gridTemplateColumns.split(' ').length === 2`));
  const fan = await c.ev(`document.querySelector('[data-fan-section]').getBoundingClientRect().top + scrollY`);
  await c.scroll(fan - 100, 2200);
  check('the fan fits the phone: the centre of every tile is on the screen and none sticks out sideways by more than half a tile', await c.ev(`[...document.querySelectorAll('.fan-tile')].every((t) => { const r = t.getBoundingClientRect(); const mid = (r.left + r.right) / 2; return mid >= 0 && mid <= innerWidth && r.left >= -60 && r.right <= innerWidth + 60; })`));
  const ft = await c.ev(`document.documentElement.scrollHeight - innerHeight`);
  await c.scroll(ft, 900);
  check('phone footer groups start collapsed', await c.ev(`[...document.querySelectorAll('.footer-accordion-content')].every((e) => e.getBoundingClientRect().height < 2)`));
  await c.click(...(await c.center('.footer-accordion-header'))); await sleep(900);
  check('tapping a footer group opens it', await c.ev(`(() => { const i = document.querySelector('.footer-accordion-item'); return i.classList.contains('active') && i.querySelector('.footer-accordion-content').getBoundingClientRect().height > 50 && i.querySelector('button').getAttribute('aria-expanded') === 'true'; })()`));
  const over = [];
  for (const [w, h] of [[390, 844], [360, 740], [320, 640]]) {
    await c.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: true });
    await sleep(700);
    const ov = await c.ev(`document.documentElement.scrollWidth - innerWidth`);
    if (ov > 0) over.push(`${w}: +${ov}`);
  }
  check('no horizontal overflow at 390, 360 and 320px', over.length === 0, over.join(', '));
  check('no console errors during the whole phone run', c.problems.length === 0, c.problems.slice(0, 4).join(' | '));
  c.close();
}

// ───────────────────────── logo intro (plays once per visit) ─────────────────────────
async function intro() {
  console.log('\n=== LOGO INTRO');
  const c = await open({ w: 1440, h: 900 });
  await c.visit('/', 700);
  check('first visit: the logo intro plays over a dark screen, the page is locked underneath and the head holds the dark cover', await c.ev(`(async () => { const i = document.querySelector('.intro'); const src = await (await fetch('/')).text(); return !!i && i.querySelector('img').getAttribute('src').endsWith('amore-monogram-light.png') && document.documentElement.classList.contains('no-scroll') && getComputedStyle(i).position === 'fixed' && !document.documentElement.classList.contains('intro-pending') && src.includes('intro-pending'); })()`));
  check('the intro’s picture is preloaded because the intro is about to play', await c.ev(`!!document.head.querySelector('link[rel="preload"][as="image"][href$="amore-monogram-light.png"]')`));
  await sleep(3600);
  check('...it removes itself after about three seconds, frees the page and remembers it was shown', await c.ev(`!document.querySelector('.intro') && !document.documentElement.classList.contains('no-scroll') && sessionStorage.getItem('amore-intro-seen') === '1'`));
  await c.visit('/', 1200);
  check('later visits to the homepage in the same tab skip it', await c.ev(`!document.querySelector('.intro') && !document.documentElement.classList.contains('intro-pending')`));
  await c.visit('/?intro', 700);
  check('/?intro plays it again', await c.ev(`!!document.querySelector('.intro')`));
  await c.click(700, 450); await sleep(1400);
  check('a click skips it at once and frees the page', await c.ev(`!document.querySelector('.intro') && !document.documentElement.classList.contains('no-scroll')`));
  check('no console errors during the intro run', c.problems.length === 0, c.problems.slice(0, 4).join(' | '));
  c.close();
  const d = await open({ w: 1440, h: 900 });
  await d.goto(1500);
  check('/?nointro never plays it (this is how the tests open the site)', await d.ev(`!document.querySelector('.intro') && !document.documentElement.classList.contains('intro-pending') && !document.documentElement.classList.contains('no-scroll')`));
  check('...and then nothing is preloaded for it, so the browser has no unused preload to warn about', await d.ev(`!document.head.querySelector('link[rel="preload"][as="image"]')`) && d.problems.length === 0, d.problems.slice(0, 3).join(' | '));
  d.close();
}

// ───────────────────────── reduced motion ─────────────────────────
async function reduced() {
  console.log('\n=== REDUCED MOTION');
  const c = await open({ w: 1440, h: 900, reduce: true });
  await c.goto(3000);
  check('the marquee and the poster strip do not animate', await c.ev(`getComputedStyle(document.querySelector('.hero-reveal-marquee-track')).animationName === 'none' && getComputedStyle(document.querySelector('.hero-strip')).animationName === 'none'`));
  const sg = await c.ev(`document.querySelector('[data-reveal-grid]').getBoundingClientRect().top + scrollY`);
  await c.scroll(sg - 300, 900);
  check('collection cards are simply there (no fade)', await c.ev(`getComputedStyle(document.querySelector('.collection-card')).transitionDuration === '0s'`));
  check('fan tiles do not spring', await c.ev(`getComputedStyle(document.querySelector('.fan-tile')).transitionDuration === '0s'`));
  const rl = await c.ev(`document.querySelector('[data-lineup]').getBoundingClientRect().top + scrollY`);
  await c.scroll(rl - 100, 900);
  check('reduced motion: no word-by-word headlines, no gold ring, and the moving bands sit still', await c.ev(`document.querySelectorAll('.split-word').length === 0 && !document.querySelector('.cursor-ring') && [...document.querySelectorAll('.band-track')].every((t) => t.style.transform === '')`));
  check('the bottle parade stands still, shows each bottle once and scrolls sideways by hand', await c.ev(`(() => { const t = document.querySelector('.lineup-track'); const v = document.querySelector('.lineup-viewport'); return getComputedStyle(t).animationName === 'none' && getComputedStyle(v).transitionDuration === '0s' && getComputedStyle(v).overflowX === 'auto' && [...t.children].filter((li) => getComputedStyle(li).display !== 'none').length === 10 && v.scrollWidth > v.clientWidth; })()`));
  await c.visit('/', 900);
  check('reduced motion: the smoke stays a still frame (the video is never fetched or shown)', await c.ev(`(() => { const v = document.querySelector('.lineup-smoke video'); return !v.getAttribute('src') && getComputedStyle(v).display === 'none' && /amore-smoke-poster\\.jpg/.test(getComputedStyle(document.querySelector('.lineup-smoke')).backgroundImage); })()`));
  check('reduced motion: no logo intro and no dark cover left behind', await c.ev(`!document.querySelector('.intro') && !document.documentElement.classList.contains('intro-pending') && !document.documentElement.classList.contains('no-scroll')`));
  await c.visit('/products/royal-oud', 1500);
  check('reduced motion: the product bottle does not float or tilt and the rings do not animate', await c.ev(`getComputedStyle(document.querySelector('.pdp-bottle-float')).animationName === 'none' && getComputedStyle(document.querySelector('.pdp-orb')).animationName === 'none' && getComputedStyle(document.querySelector('.pdp-bottle img')).transform === 'none'`));
  c.close();
}

// ───────────────────────── shop pages, desktop ─────────────────────────
async function shopDesktop() {
  console.log('\n=== SHOP, DESKTOP 1440x900');
  const c = await open({ w: 1440, h: 900 });
  await c.visit('/products/royal-oud', 3000);
  check('product page: no console errors or failed requests', c.problems.length === 0, c.problems.join(' | '));
  const hosts = [...new Set([...c.reqs.values()].map((r) => new globalThis.URL(r.url).host))].filter(Boolean);
  check('product page contacts only this server',hosts.every((h) => h === new globalThis.URL(ORIGIN).host), hosts.join(', '));
  check('title, heading, slogan and key notes come from the brand document', await c.ev(`document.title === 'ROYAL OUD \\u2014 AMORE' && document.querySelector('h1').textContent === 'ROYAL OUD' && document.querySelector('.pdp-tagline').textContent === 'A Legacy in Scent' && /oud . saffron . leather/i.test(document.querySelector('.pdp-keynotes').textContent) && document.querySelector('.pdp-suffix').textContent === 'Eau de Parfum'`));
  check('the price is \u20b9999 and there is no size, rating, stock or delivery claim', await c.ev(`(() => { const t = document.querySelector('.pdp').innerText; return document.querySelector('[data-price]').textContent === '\\u20b9999' && !/\\bml\\b|\\u2605|\\u2606|out of stock|in stock|delivered by|reviews?\\b/i.test(t) && !document.querySelector('.pdp-size'); })()`));
  check('the description is open and the key notes and character words are listed as chips', await c.ev(`(() => { const d = document.querySelectorAll('.pdp-acc'); return d.length === 2 && d[0].open && d[1].open && /dark richness of oud/.test(d[0].innerText) && [...d[1].querySelectorAll('.pdp-note')].map((n) => n.textContent).join() === 'Oud,Saffron,Leather,Regal,Deep,Refined'; })()`));
  check('the poster is the page\u2019s picture, fully loaded and not stretched', await c.ev(`(() => { const i = document.querySelector('.pdp-poster img'); const r = i.getBoundingClientRect(); return i.naturalWidth === 261 && i.complete && Math.abs(r.width / r.height - 261 / 587) < 0.01; })()`));
  check('the bottle stands beside the poster, a little in front: loaded, to the right, shorter than the poster, resting at about the same level, inside the dark panel', await c.ev(`(() => { const g = document.querySelector('.pdp-gallery').getBoundingClientRect(); const p = document.querySelector('.pdp-poster img').getBoundingClientRect(); const bi = document.querySelector('.pdp-bottle img'); const b = bi.getBoundingClientRect(); return bi.complete && bi.naturalWidth === 600 && b.left > p.left + p.width * 0.6 && b.left < p.right && b.height < p.height && b.height > p.height * 0.7 && Math.abs(b.bottom - p.bottom) < 40 && p.left >= g.left && b.right <= g.right + 1; })()`));
  check('the page wears the fragrance’s own colour: the accent from the data, the glow behind the pictures and the line under the name', await c.ev(`(async () => { const { getProduct } = await import('/js/data/catalogue.js'); const a = getProduct('royal-oud').accent; const art = document.querySelector('.pdp'); const g = getComputedStyle(document.querySelector('.pdp-gallery')).backgroundImage; const line = getComputedStyle(document.querySelector('.pdp-title'), '::after').backgroundColor; const hex = (c) => '#' + c.match(/\\d+/g).slice(0, 3).map((n) => (+n).toString(16).padStart(2, '0')).join(''); return art.style.getPropertyValue('--accent').trim() === a && /radial-gradient/.test(g) && hex(line) === a; })()`));
  check('the three key notes are three rings in that colour and still read "Oud • Saffron • Leather"', await c.ev(`(() => { const o = [...document.querySelectorAll('.pdp-orb')]; const k = document.querySelector('.pdp-keynotes'); return o.length === 3 && o.map((e) => e.textContent).join() === 'Oud,Saffron,Leather' && o.every((e) => { const r = e.getBoundingClientRect(); return Math.abs(r.width - 120) < 1 && getComputedStyle(e).borderRadius === '50%'; }) && /oud . saffron . leather/i.test(k.textContent); })()`));
  const gpoint = await c.ev(`(() => { const r = document.querySelector('.pdp-gallery').getBoundingClientRect(); return [Math.round(r.left + r.width * 0.9), Math.round(r.top + r.height * 0.3)]; })()`);
  await c.move(...gpoint); await sleep(500);
  check('the bottle tilts towards the mouse', await c.ev(`parseFloat(document.querySelector('.pdp-bottle').style.getPropertyValue('--ry')) > 3 && getComputedStyle(document.querySelector('.pdp-bottle img')).transform.startsWith('matrix3d')`));
  await c.move(8, 8);
  check('back link and breadcrumb point at the collection', await c.ev(`document.querySelector('.pdp-back').getAttribute('href') === '/collections/the-fragrance-collection' && [...document.querySelectorAll('.shop-breadcrumb a')].map((a) => a.getAttribute('href')).join() === '/,/collections/the-fragrance-collection'`));
  check('four suggestions follow: Bleu Impérial, Velvet Rose, Ember Woods, Citrus Noir', await c.ev(`[...document.querySelectorAll('.pdp-suggestions .shop-card')].map((a) => a.getAttribute('href')).join() === '/products/bleu-imperial,/products/velvet-rose,/products/ember-woods,/products/citrus-noir'`));
  check('the page never shows the previous brand', await c.ev(`!new RegExp(${JSON.stringify(OLD_PATTERN)}, 'i').test(document.body.innerText + document.title)`));

  // quantity + bag
  await c.ev(`localStorage.clear()`); await c.reload(2500);
  check('bag starts empty: badge hidden, nothing stored', (await bagState(c)).hidden && !(await bagState(c)).stored);
  check('quantity stepper: minus is disabled at 1, plus raises it', await c.ev(`document.querySelector('[data-qty-dec]').disabled`) && (await c.click(...(await c.center('[data-qty-inc]'))), await sleep(150), await c.ev(`document.querySelector('[data-qty-value]').textContent === '2' && !document.querySelector('[data-qty-dec]').disabled`)));
  await c.click(...(await c.center('[data-add-to-bag]'))); await sleep(1200);
  let st = await bagState(c);
  check('add to bag (qty 2): drawer opens, badge shows 2, the bag is stored', await c.ev(`document.querySelector('#cart-overlay').classList.contains('expanded')`) && st.badge === '2' && !st.hidden && JSON.parse(st.stored).lines[0].qty === 2, JSON.stringify(st));
  check('the drawer lists ROYAL OUD with \u20b9999 each, quantity 2, line total and subtotal \u20b91,998', await c.ev(`(() => { const t = document.querySelector('#cart-overlay').innerText; return /ROYAL OUD/.test(t) && /\\u20b9999 each/.test(t) && document.querySelector('.cart-line [data-qty]').textContent === '2' && document.querySelector('.cart-line-total').textContent === '\\u20b91,998' && document.querySelector('[data-cart-subtotal]').textContent === '\\u20b91,998'; })()`));
  check('the bag says it is a demo and the checkout link says demo', await c.ev(`/Demo bag\\. Nothing is charged and no order is placed/.test(document.querySelector('.cart-note').textContent) && /demo/i.test(document.querySelector('.cart-checkout').textContent)`));
  check('add feedback: the button says "Added" and a live region announces it', await c.ev(`/Added/.test(document.querySelector('[data-add-label]').textContent) && /added to the bag/.test(document.querySelector('[role="status"].visually-hidden').textContent)`));
  check('while the bag is open Tab stays inside it', await (async () => { for (let i = 0; i < 14; i++) await c.key('Tab', 'Tab', 9); return c.ev(`!!document.activeElement.closest('#cart-overlay aside') && document.querySelector('#main').inert`); })());
  await c.click(...(await c.center('.cart-line [data-cart-inc]'))); await sleep(300);
  check('+ in the bag: quantity 3, subtotal \u20b92,997, badge 3, immediately', await c.ev(`document.querySelector('.cart-line [data-qty]').textContent === '3' && document.querySelector('[data-cart-subtotal]').textContent === '\\u20b92,997' && document.querySelector('[data-cart-count]').textContent === '3'`));
  await c.click(...(await c.center('.cart-line [data-cart-dec]'))); await sleep(300);
  check('- in the bag: back to 2 (\u20b91,998)', await c.ev(`document.querySelector('.cart-line [data-qty]').textContent === '2' && document.querySelector('[data-cart-subtotal]').textContent === '\\u20b91,998'`));
  await c.key('Escape', 'Escape', 27); await sleep(800);
  check('Escape closes the bag and focus returns to the Add to bag button', await c.ev(`!document.querySelector('#cart-overlay').classList.contains('expanded') && document.activeElement === document.querySelector('[data-add-to-bag]')`));
  await c.reload(2500);
  st = await bagState(c);
  check('the bag survives a reload (badge 2, same line)', st.badge === '2' && JSON.parse(st.stored).lines.length === 1, JSON.stringify(st));
  await c.visit('/products/tobacco-oud', 2500);
  check('the bag also shows on another fragrance\u2019s page', (await bagState(c)).badge === '2');
  await c.click(...(await c.center('[data-add-to-bag]'))); await sleep(1100);
  check('adding a second fragrance: two lines, subtotal 3 x \u20b9999 = \u20b92,997', await c.ev(`document.querySelectorAll('.cart-line').length === 2 && document.querySelector('[data-cart-subtotal]').textContent === '\\u20b92,997' && document.querySelector('[data-cart-count]').textContent === '3'`));
  await c.click(...(await c.center('.cart-line:last-child [data-cart-remove]'))); await sleep(300);
  check('Remove deletes a line (one line, \u20b91,998)', await c.ev(`document.querySelectorAll('.cart-line').length === 1 && document.querySelector('[data-cart-subtotal]').textContent === '\\u20b91,998'`));
  await c.click(...(await c.center('.cart-checkout'))); await sleep(2200);
  check('checkout page is clearly a demo: notice, lines, subtotal, no payment or order form', await c.ev(`(() => { const t = document.querySelector('.shop-checkout').innerText; return /Demo only/.test(t) && /No payment details are collected, no order is created/.test(t) && /\\u20b91,998/.test(t) && document.querySelectorAll('input:not([type=search]):not([type=radio]), textarea, select').length === 0 && !/thank you|order confirmed|order number|payment (received|successful)/i.test(document.body.innerText); })()`));
  await c.click(...(await c.center('[data-clear-bag]'))); await sleep(500);
  check('"Clear the demo bag" empties the bag and the badge disappears', await c.ev(`/Your bag is empty/.test(document.querySelector('.shop-message').innerText) && document.querySelector('[data-cart-count]').hidden && localStorage.getItem('${BAG_KEY}').includes('"lines":[]')`));

  // search
  await c.visit('/products/royal-oud', 2200);
  await c.click(...(await c.center('[data-search-toggle]'))); await sleep(600);
  await c.type('  BLEU   imp'); await sleep(900);
  check('search by name is case/space/accent-insensitive; the result shows thumbnail, notes and price', await c.ev(`(() => { const a = [...document.querySelectorAll('.predictive-item')]; return a.length === 1 && a[0].classList.contains('is-top') && !!a[0].querySelector('img') && /BLEU IMP/.test(a[0].innerText) && /Bergamot · Marine Notes · Amber · \\u20b9999/.test(a[0].innerText) && /1 result for/.test(document.querySelector('[data-search-results] h4').textContent); })()`));
  await c.key('Enter', 'Enter', 13); await sleep(2500);
  check('Enter opens the most relevant result', await c.ev(`location.pathname === '/products/bleu-imperial' && document.querySelector('h1').textContent === 'BLEU IMPÉRIAL'`));
  await c.visit('/products/royal-oud', 2200);
  await c.click(...(await c.center('[data-search-toggle]'))); await sleep(600);
  await c.type('oud'); await sleep(900);
  check('"oud" finds the two oud fragrances, Royal Oud first, and offers "See all results"', await c.ev(`[...document.querySelectorAll('.predictive-item')].map((a) => a.getAttribute('href')).join() === '/products/royal-oud,/products/tobacco-oud' && document.querySelector('.predictive-all').getAttribute('href') === '/search?q=oud'`));
  await c.key('ArrowDown', 'ArrowDown', 40); await sleep(250);
  check('ArrowDown moves focus into the results, again to the next, ArrowUp comes back', await (async () => {
    const first = await c.ev(`document.activeElement === document.querySelectorAll('.predictive-item')[0]`);
    await c.key('ArrowDown', 'ArrowDown', 40); const second = await c.ev(`document.activeElement === document.querySelectorAll('.predictive-item')[1]`);
    await c.key('ArrowUp', 'ArrowUp', 38); await c.key('ArrowUp', 'ArrowUp', 38); const back = await c.ev(`document.activeElement === document.querySelector('[data-search-drawer-input]')`);
    return first && second && back;
  })());
  await c.ev(`(() => { const i = document.querySelector('[data-search-drawer-input]'); i.value = ''; i.focus(); })()`);
  await c.type('zzzzqqq'); await sleep(900);
  check('a search with no matches says so, offers the collection and keeps the drawer open', await c.ev(`/No fragrances match/.test(document.querySelector('.predictive-empty').textContent) && !!document.querySelector('.predictive-all') && document.querySelectorAll('.predictive-item').length === 0`));
  await c.key('Enter', 'Enter', 13); await sleep(900);
  check('Enter with no match does not navigate', await c.ev(`location.pathname === '/products/royal-oud' && document.querySelector('#search-overlay').classList.contains('expanded')`));
  await c.ev(`(() => { const i = document.querySelector('[data-search-drawer-input]'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); })()`); await sleep(700);
  check('an empty search shows the three featured fragrances', await c.ev(`/Featured/.test(document.querySelector('[data-search-results] h4').textContent) && [...document.querySelectorAll('.predictive-item')].map((a) => a.getAttribute('href')).join() === '/products/royal-oud,/products/bleu-imperial,/products/velvet-rose'`));
  await c.key('Escape', 'Escape', 27); await sleep(800);
  check('Escape closes search', await c.ev(`!document.querySelector('#search-overlay').classList.contains('expanded') && !document.querySelector('#main').inert`));
  await c.visit('/search?q=%20%20Silver%20', 2200);
  check('the search page works from a URL: input prefilled, one card', await c.ev(`document.querySelector('#shop-search-input').value.trim() === 'Silver' && document.querySelectorAll('.shop-grid .shop-card').length === 1 && /SILVER VETIVER/.test(document.querySelector('.shop-card').innerText)`));
  await c.visit('/search?q=nothing-here', 2000);
  check('the search page shows an empty-results state', await c.ev(`/No fragrances match/.test(document.querySelector('.shop-message').innerText) && document.querySelectorAll('.shop-card').length === 0`));

  // collection, placeholders, not found
  await c.visit('/collections/the-fragrance-collection', 2500);
  check('the collection page lists all ten with posters, slogans and prices, and the brand\u2019s own intro', await c.ev(`(() => { const l = [...document.querySelectorAll('.shop-card')]; return document.querySelector('h1').textContent === 'The Fragrance Collection' && l.length === 10 && l.every((a) => a.querySelector('img') && /\\u20b9999/.test(a.innerText)) && /Ten distinct scent identities/.test(document.body.innerText) && /each with its own character, atmosphere and signature notes/.test(document.body.innerText) && !document.querySelector('.shop-collections-nav'); })()`));
  check('collection images all load', await imagesOk(c));
  await c.visit('/pages/about', 1800);
  check('the About page is an honest placeholder', await c.ev(`/has not been written yet/.test(document.querySelector('.shop-message').innerText) && document.querySelector('h1').textContent === 'About AMORE'`));
  await c.visit('/products/not-a-fragrance', 1800);
  check('an unknown fragrance shows a not-found page', await c.ev(`document.querySelector('h1').textContent === 'Fragrance not found'`));
  c.problems.splice(0, c.problems.length, ...c.problems.filter((p) => !/not-a-fragrance/.test(p))); // that 404 is the expected one
  check('menu links reach every fragrance and the Featured tiles reach the first three', await c.ev(`(() => { const h = [...document.querySelectorAll('.header-menu-item')].map((a) => a.getAttribute('href')); const t = [...document.querySelectorAll('.menu-tile')].map((a) => a.getAttribute('href')); return h.length === 11 && t.join() === '/products/royal-oud,/products/bleu-imperial,/products/velvet-rose'; })()`));

  // every product page, loaded directly
  const trouble = [];
  for (const h of HANDLES) {
    await c.visit(`/products/${h}`, 1400);
    const r = await c.ev(`(() => ({ h1: document.querySelector('h1').textContent.trim(), price: document.querySelector('[data-price]').textContent === '\\u20b9999', notes: document.querySelectorAll('.pdp-note').length, add: !document.querySelector('[data-add-to-bag]').disabled, sugg: document.querySelectorAll('.pdp-suggestions .shop-card').length, overflow: document.documentElement.scrollWidth - innerWidth }))()`);
    r.imgs = await imagesOk(c);
    r.bottle = await c.ev(`(() => { const i = document.querySelector('.pdp-bottle img'); return !!i && i.complete && i.naturalWidth === 600; })()`);
    r.orbs = await c.ev(`document.querySelectorAll('.pdp-orb').length`);
    r.accent = await c.ev(`/^#[0-9a-f]{6}$/i.test(document.querySelector('.pdp').style.getPropertyValue('--accent').trim())`);
    // the word in the middle ring must sit clear of the two neighbouring ring lines (the tightest spot of the three rings)
    r.fit = await c.ev(`(() => { const o = [...document.querySelectorAll('.pdp-orb')]; if (o.length !== 3) return false; const rg = document.createRange(); rg.selectNodeContents(o[1].querySelector('span')); const word = rg.getBoundingClientRect().width; const free = o[2].getBoundingClientRect().left - o[0].getBoundingClientRect().right; return word <= free - 6; })()`);
    if (!r.h1 || !r.price || !r.imgs || r.notes !== 6 || !r.add || r.sugg !== 4 || r.overflow > 0 || !r.bottle || r.orbs !== 3 || !r.accent || !r.fit) trouble.push(`${h}: ${JSON.stringify(r)}`);
  }
  check('all ten product pages load directly with name, \u20b9999, six chips, a working poster, four suggestions and no overflow', trouble.length === 0, trouble.join(' | '));
  check('no console errors or failed requests across the whole shop run (desktop)', c.problems.length === 0, c.problems.slice(0, 4).join(' | '));

  const wide = [];
  for (const [w, h] of [[1920, 1080], [1280, 800], [1024, 768], [768, 1024]]) {
    await c.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    for (const path of ['/', '/products/royal-oud', '/collections/the-fragrance-collection', '/search?q=a', '/checkout']) {
      await c.visit(path, 1100);
      const ov = await c.ev(`document.documentElement.scrollWidth - innerWidth`);
      if (ov > 0) wide.push(`${path}@${w}: +${ov}`);
    }
  }
  check('no horizontal overflow on any page at 1920, 1280, 1024 and 768px', wide.length === 0, wide.join(', '));
  c.close();
}

// ───────────────────────── shop pages, phone ─────────────────────────
async function shopPhone() {
  console.log('\n=== SHOP, PHONE 390x844');
  const c = await open({ w: 390, h: 844, mobile: true });
  await c.visit('/products/velvet-rose', 3000);
  check('phone product page: no console errors or failed requests', c.problems.length === 0, c.problems.join(' | '));
  check('phone product page: poster, title, price and add button are all within the screen width', await c.ev(`(() => { const ok = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1; }; return ['.pdp-poster img', '.pdp-title', '.pdp-price', '[data-add-to-bag]', '.pdp-accordions'].every(ok); })()`));
  check('phone: the poster is shown in full (not cropped)', await c.ev(`(() => { const r = document.querySelector('.pdp-poster img').getBoundingClientRect(); return Math.abs(r.width / r.height - 256 / 587) < 0.01 && r.height > 300; })()`));
  await c.ev(`(() => { const s = document.querySelector('.pdp-stage'); s.scrollTo({ left: s.clientWidth, behavior: 'auto' }); })()`); await sleep(600);
  check('phone: poster and bottle are two pictures to swipe between (two dots, the second turns gold) and the whole bottle is on screen', await c.ev(`(() => { const s = document.querySelector('.pdp-stage'); const d = [...document.querySelectorAll('.pdp-dots button')]; const r = document.querySelector('.pdp-bottle img').getBoundingClientRect(); return s.scrollWidth > s.clientWidth * 1.9 && d.length === 2 && getComputedStyle(document.querySelector('.pdp-dots')).display === 'flex' && !d[0].classList.contains('is-active') && d[1].classList.contains('is-active') && r.left >= 0 && r.right <= innerWidth + 1 && r.height > 300 && document.documentElement.scrollWidth <= innerWidth; })()`));
  await c.ev(`document.querySelector('.pdp-stage').scrollTo({ left: 0, behavior: 'auto' })`); await sleep(400);
  check('phone: the add button stays pinned at the bottom of the screen', await c.ev(`Math.abs(document.querySelector('.pdp-buy').getBoundingClientRect().bottom - innerHeight) < 2`));
  await c.click(...(await c.center('[data-add-to-bag]'))); await sleep(1200);
  check('phone: add to bag opens a drawer that fits the screen, with the line and subtotal \u20b9999', await c.ev(`(() => { const r = document.querySelector('#cart-overlay aside').getBoundingClientRect(); return document.querySelector('#cart-overlay').classList.contains('expanded') && r.left >= 0 && r.right <= innerWidth + 1 && document.querySelector('[data-cart-subtotal]').textContent === '\\u20b9999' && document.querySelector('[data-cart-count]').textContent === '1'; })()`));
  check('phone: bag controls are at least 30px tall touch targets', await c.ev(`[...document.querySelectorAll('.cart-line .qty-button, .cart-checkout, .cart-continue')].every((b) => b.getBoundingClientRect().height >= 30)`));
  await c.click(...(await c.center('#cart-overlay .close'))); await sleep(700);
  await c.ev(`localStorage.clear()`);
  const bad = [];
  for (const [w, h] of [[390, 844], [360, 740], [320, 640]]) {
    await c.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: true });
    for (const path of ['/products/velvet-rose', '/products/arctic-mineral', '/collections/the-fragrance-collection', '/search?q=a', '/checkout', '/pages/about']) {
      await c.visit(path, 1200);
      const ov = await c.ev(`document.documentElement.scrollWidth - innerWidth`);
      if (ov > 0) bad.push(`${path}@${w}: +${ov}`);
    }
  }
  check('no horizontal overflow on shop pages at 390, 360 and 320px', bad.length === 0, bad.join(', '));
  await c.visit('/collections/the-fragrance-collection', 2000);
  check('phone collection grid is two columns', await c.ev(`getComputedStyle(document.querySelector('.shop-grid')).gridTemplateColumns.split(' ').length === 2`));
  check('no console errors across the phone shop run', c.problems.length === 0, c.problems.slice(0, 4).join(' | '));
  c.close();
}

// ───────────────────────── the GitHub Pages build, served from a sub-folder ─────────────────────────
async function pagesBuild() {
  console.log('\n=== GITHUB PAGES BUILD (served from /amore/)');
  const BASE = '/amore/';
  const { buildPages } = await import(pathToFileURL(join(ROOT, 'tools', 'build-pages.mjs')).href);
  const out = mkdtempSync(join(tmpdir(), 'amore-pages-'));
  const routes = await buildPages(out, BASE);
  const handles = HANDLES.map((h) => `products/${h}`);
  check('the Pages build has the homepage, a 404 page, ten product pages, the collection, About, Contact, search and checkout', ['index.html', '404.html', '.nojekyll', ...routes.map((r) => `${r}/index.html`)].every((f) => existsSync(join(out, f))) && handles.every((h) => routes.includes(h)) && routes.length === 15, routes.join(', '));

  // no dead links: every address that points into the site resolves to a real file, and none escaped the sub-folder
  const htmlFiles = ['index.html', '404.html', ...routes.map((r) => `${r}/index.html`)];
  const dead = []; const escaped = [];
  for (const f of htmlFiles) {
    const html = readFileSync(join(out, f), 'utf8');
    for (const [, , value] of html.matchAll(/(\s(?:href|src|action)=")([^"]*)"/g)) {
      if (!value || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value)) continue;
      if (!value.startsWith(BASE)) { escaped.push(`${f}: ${value}`); continue; }
      const rel = value.slice(BASE.length).split(/[?#]/)[0];
      if (rel && !existsSync(join(out, rel)) && !existsSync(join(out, rel, 'index.html'))) dead.push(`${f}: ${value}`);
    }
  }
  check('every link, image, script and stylesheet in the built pages stays inside /amore/ and points at a file that exists', dead.length === 0 && escaped.length === 0, [...dead, ...escaped].slice(0, 4).join(' | '));

  // a small server that behaves like GitHub Pages: files and folder indexes under /amore/, a redirect to the trailing slash, 404.html for the rest
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.mp4': 'video/mp4' };
  const server = createServer((req, res) => {
    const url = new globalThis.URL(req.url, 'http://x');
    const send = (code, file) => { // like GitHub Pages, files can be fetched in byte ranges (browsers ask for video that way)
      const body = readFileSync(file); const type = types[extname(file)] || 'application/octet-stream';
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
      if (code === 200 && range && (range[1] || range[2])) {
        const start = range[1] ? Number(range[1]) : body.length - Number(range[2]);
        const end = range[1] && range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
        res.writeHead(206, { 'content-type': type, 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${body.length}`, 'content-length': end - start + 1 });
        res.end(body.subarray(start, end + 1));
        return;
      }
      res.writeHead(code, { 'content-type': type, 'accept-ranges': 'bytes' });
      res.end(body);
    };
    if (!url.pathname.startsWith(BASE)) { res.writeHead(404); res.end('not here'); return; }
    const rel = decodeURIComponent(url.pathname.slice(BASE.length));
    const file = join(out, rel);
    if (rel && !file.startsWith(out)) { res.writeHead(403); res.end(); return; }
    if (existsSync(file) && statSync(file).isFile()) return send(200, file);
    if (existsSync(file) && statSync(file).isDirectory() && existsSync(join(file, 'index.html'))) {
      if (!url.pathname.endsWith('/')) { res.writeHead(301, { location: url.pathname + '/' + url.search }); res.end(); return; }
      return send(200, join(file, 'index.html'));
    }
    send(404, join(out, '404.html'));
  });
  await new Promise((r) => server.listen(5199, '127.0.0.1', r));
  const site = 'http://localhost:5199';
  const go = async (c, path, wait = 2500) => { await c.send('Page.navigate', { url: site + path }); await sleep(wait); };
  try {
    const c = await open({ w: 1440, h: 900 });
    await go(c, '/amore/?nointro', 3500);
    check('Pages homepage: no console errors or failed requests, logo and hero images load from /amore/', c.problems.length === 0 && await c.ev(`(() => { const logo = [...document.querySelectorAll('.header-logo img')].find((i) => i.getBoundingClientRect().width > 0); const hero = document.querySelector('.hero-strip img'); return logo.src.includes('/amore/assets/logo/') && logo.naturalWidth > 0 && hero.src.includes('/amore/assets/') && hero.naturalWidth > 0; })()`), c.problems.slice(0, 3).join(' | '));
    check('Pages homepage: every internal link starts with /amore/', await c.ev(`[...document.querySelectorAll('a[href]')].filter((a) => { const h = a.getAttribute('href'); return h.startsWith('/') && !h.startsWith('/amore/'); }).length === 0`));
    await c.ev(`document.querySelector('[data-lineup]').scrollIntoView()`); await sleep(2800);
    check('Pages homepage: the smoke video plays from /amore/assets/video/ (byte ranges work) and the still frame is found', c.problems.length === 0 && await c.ev(`(async () => { const v = document.querySelector('.lineup-smoke video'); const bg = getComputedStyle(document.querySelector('.lineup-smoke')).backgroundImage; const still = bg.match(/url\\("?([^")]+)"?\\)/)[1]; const ok = (await fetch(still)).ok; return v.getAttribute('src').startsWith('/amore/assets/video/amore-smoke-1280.mp4') && !v.paused && v.readyState >= 2 && v.currentTime > 0 && /\\/amore\\/assets\\/video\\/amore-smoke-poster\\.jpg$/.test(still) && ok; })()`), c.problems.slice(0, 3).join(' | '));

    await go(c, '/amore/products/royal-oud', 3000); // no trailing slash: the host redirects to it
    check('Pages product page (reached without the trailing slash): ROYAL OUD, ₹999, poster and bottle load, links keep /amore/', await c.ev(`(() => { const p = document.querySelector('.pdp-poster img'); const b = document.querySelector('.pdp-bottle img'); const crumbs = [...document.querySelectorAll('.shop-breadcrumb a')].map((a) => a.getAttribute('href')).join(); return location.pathname === '/amore/products/royal-oud/' && document.querySelector('h1').textContent === 'ROYAL OUD' && document.querySelector('[data-price]').textContent === '\\u20b9999' && p.naturalWidth === 261 && b.naturalWidth === 600 && p.getAttribute('src').startsWith('/amore/assets/') && document.querySelector('.pdp-back').getAttribute('href') === '/amore/collections/the-fragrance-collection' && crumbs === '/amore/,/amore/collections/the-fragrance-collection'; })()`));
    await c.click(...(await c.center('[data-add-to-bag]'))); await sleep(1200);
    check('Pages: add to bag works, the bag line links to the product and the checkout link keeps /amore/', await c.ev(`(() => { const a = document.querySelector('#cart-overlay a[href*="/products/"]'); const ch = [...document.querySelectorAll('#cart-overlay a')].map((x) => x.getAttribute('href')).find((h) => /checkout/.test(h)); return document.querySelector('[data-cart-count]').textContent === '1' && !!a && a.getAttribute('href').startsWith('/amore/products/') && ch === '/amore/checkout'; })()`));

    await go(c, '/amore/search/?q=oud', 2500);
    check('Pages search: finds the oud fragrances and the search form posts to /amore/search', await c.ev(`document.querySelectorAll('.shop-card').length >= 2 && document.querySelector('.shop-search').getAttribute('action') === '/amore/search'`));
    await go(c, '/amore/collections/the-fragrance-collection/', 2500);
    check('Pages collection page lists all ten with links inside /amore/', await c.ev(`(() => { const a = [...document.querySelectorAll('.shop-card')]; return a.length === 10 && a.every((x) => x.getAttribute('href').startsWith('/amore/products/')); })()`));
    await go(c, '/amore/checkout/', 2500);
    check('Pages checkout (demo) shows the demo notice and the bag from the other pages', await c.ev(`/demo/i.test(document.querySelector('.shop-checkout').innerText) && document.querySelectorAll('.shop-checkout-lines li').length === 1`));
    await go(c, '/amore/products/not-a-fragrance/', 2500);
    check('Pages: an unknown address shows the shop’s own "not found" page (404.html) with a way home', await c.ev(`/not found/i.test(document.querySelector('[data-shop-view]').innerText) && !!document.querySelector('[data-shop-view] a[href="/amore/"]')`));
    c.problems.splice(0, c.problems.length, ...c.problems.filter((p) => !/not-a-fragrance/.test(p) && !/404/.test(p)));
    check('no console errors or failed requests across the whole Pages run', c.problems.length === 0, c.problems.slice(0, 4).join(' | '));
    c.close();

    // a first visit in a fresh browser: the intro plays from the sub-folder, its picture is preloaded, and nothing is logged
    const d = await open({ w: 1440, h: 900 });
    await go(d, '/amore/', 1800);
    check('Pages first visit: the intro plays with its picture from /amore/, preloaded, and the base is known before the script that needs it', await d.ev(`(() => { const i = document.querySelector('.intro'); const img = i && i.querySelector('img'); const link = document.head.querySelector('link[rel="preload"][as="image"]'); const meta = document.querySelector('meta[name="amore-base"]'); const script = document.head.querySelector('script:not([src])'); return !!img && img.getAttribute('src') === '/amore/assets/logo/amore-monogram-light.png' && img.naturalWidth > 0 && !!link && link.getAttribute('href') === '/amore/assets/logo/amore-monogram-light.png' && !!meta && !!script && !!(meta.compareDocumentPosition(script) & Node.DOCUMENT_POSITION_FOLLOWING); })()`));
    await sleep(3200);
    check('Pages first visit: then the page appears, and nothing was logged (no unused-preload warning, no failed request)', await d.ev(`!document.querySelector('.intro') && !document.documentElement.classList.contains('no-scroll') && !!document.querySelector('.hero-strip img')`) && d.problems.length === 0, d.problems.slice(0, 3).join(' | '));
    d.close();
  } finally {
    server.close();
    rmSync(out, { recursive: true, force: true });
  }
}

try { await units(); await desktop(); await intro(); await phone(); await reduced(); await shopDesktop(); await shopPhone(); await pagesBuild(); } catch (e) { failures.push('test run crashed: ' + e.message); console.log('CRASH', e.message); }
console.log(`\n${passed} passed, ${failures.length} failed`);
for (const f of failures) console.log('  FAIL: ' + f);
process.exit(failures.length ? 1 : 0);
