// The shop pages. One template (shop.html) serves every route; this file reads the URL and renders the matching view:
//   /products/<handle>  /collections/<handle>  /search?q=  /checkout  /pages/<slug>
// Everything shown comes from data/catalogue.js. Nothing the brand has not supplied (sizes, ratings, stock, delivery
// promises) is shown, and the bag is a demo that says so.
import { $, $$, reduced } from './util.js';
import { withBase, withoutBase } from './base.js';
import {
  BRAND, COLLECTIONS, collectionProducts, collectionUrl, displayName, formatMoney, getCollection, getPage, getProduct, hasVerifiedPrice,
  priceLabel, relatedProducts, searchProducts, searchUrl,
} from './data/catalogue.js';
import { cart, addToBag } from './cart-ui.js';
import { MAX_QTY } from './cart.js';
import { icon } from './icons.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const view = () => $('[data-shop-view]');
const COLLECTION = BRAND.collection.handle;

function setMeta(title, description) {
  document.title = `${title} — ${BRAND.name}`;
  const meta = $('meta[name="description"]');
  if (meta && description) meta.setAttribute('content', description);
}

/* ── shared pieces ── */
function card(p) {
  return `<li><a class="shop-card" href="${p.url}">
    <span class="shop-card-media"><img src="${p.thumb.src}" alt="${esc(p.thumb.alt)}" width="${p.thumb.width}" height="${p.thumb.height}" loading="lazy"></span>
    <span class="shop-card-body">
      <span class="shop-card-name">${esc(p.name)}</span>
      <span class="shop-card-slogan">${esc(p.slogan)}</span>
      <span class="shop-card-meta">${esc(priceLabel(p))}</span>
    </span></a></li>`;
}
const grid = (products) => `<ul class="shop-grid">${products.map(card).join('')}</ul>`;

function breadcrumb(trail) {
  const items = trail.map((t, i) => (i === trail.length - 1
    ? `<li aria-current="page">${esc(t.label)}</li>`
    : `<li><a href="${t.href}">${esc(t.label)}</a></li>`));
  return `<nav class="shop-breadcrumb" aria-label="Breadcrumb"><ol>${items.join('')}</ol></nav>`;
}

const chips = (list) => `<span class="pdp-chips">${list.map((n) => `<span class="pdp-note">${esc(n)}</span>`).join('')}</span>`;

/* ── product page ── */
function productView(p) {
  const col = getCollection(p.collection);
  const priced = hasVerifiedPrice(p);
  const poster = p.images[0];
  const bottle = p.bottleImage;
  const accent = /^#[0-9a-f]{6}$/i.test(p.accent || '') ? p.accent : '';
  const suggestions = relatedProducts(p.handle, 4);
  const accordion = (title, body, open = false) => `<details class="pdp-acc"${open ? ' open' : ''}><summary><span>${title}</span><span class="pdp-acc-icon" aria-hidden="true"></span></summary><div class="pdp-acc-panel">${body}</div></details>`;

  return `
  <article class="pdp" data-product="${p.handle}"${accent ? ` style="--accent: ${accent}"` : ''}>
    <div class="pdp-top">
      <div class="pdp-gallery" data-pdp-gallery>
        <div class="pdp-stage" role="group" aria-label="${esc(p.name)}: poster and bottle">
          <figure class="pdp-poster"><img src="${poster.src}" alt="${esc(poster.alt)}" width="${poster.width}" height="${poster.height}" fetchpriority="high"></figure>
          <div class="pdp-bottle"><div class="pdp-bottle-float"><img src="${bottle.src}" alt="${esc(bottle.alt)}" width="${bottle.width}" height="${bottle.height}" decoding="async"></div></div>
        </div>
        <div class="pdp-dots" aria-label="Choose a picture"><button type="button" class="is-active" aria-label="Show the poster"></button><button type="button" aria-label="Show the bottle"></button></div>
      </div>

      <div class="pdp-summary">
        <a class="pdp-back" href="${col.url}"><span aria-hidden="true">←</span> Back to ${esc(col.label)}</a>
        <header class="pdp-title">
          <p class="pdp-prefix">${esc(BRAND.name)}</p>
          <h1>${esc(p.name)}</h1>
          <p class="pdp-suffix">${esc(BRAND.type)}</p>
        </header>
        <p class="pdp-tagline">${esc(p.slogan)}</p>
        <p class="pdp-keynotes-label">Key notes</p>
        <div class="pdp-keynotes">${p.keyNotes.map((n, i) => `${i ? '<span class="visually-hidden"> • </span>' : ''}<span class="pdp-orb" style="--i: ${i}"><span>${esc(n)}</span></span>`).join('')}</div>

        <div class="pdp-price-block">
          ${priced ? `<p class="pdp-price" data-price>${esc(priceLabel(p))}</p>` : '<p class="pdp-price-note">No price has been set for this fragrance yet, so it cannot be added to the bag.</p>'}
        </div>

        <div class="pdp-buy">
          <div class="qty qty--large" role="group" aria-label="Quantity">
            <button type="button" class="qty-button" data-qty-dec aria-label="Decrease quantity" disabled>${icon('minus')}</button>
            <output class="qty-value" data-qty-value aria-live="polite">1</output>
            <button type="button" class="qty-button" data-qty-inc aria-label="Increase quantity">${icon('plus')}</button>
          </div>
          <button type="button" class="pdp-add" data-add-to-bag ${priced ? '' : 'disabled'}><span data-add-label>Add to bag</span></button>
        </div>
        <p class="pdp-demo-note">Demo bag: nothing is charged, shipped or ordered.</p>

        <div class="pdp-accordions">
          ${accordion('Description', `<p>${esc(p.description)}</p>`, true)}
          ${accordion('Key notes and character', `
            <dl class="pdp-notes">
              <div><dt>Key notes</dt><dd>${chips(p.keyNotes)}</dd></div>
              <div><dt>Character</dt><dd>${chips(p.character)}</dd></div>
            </dl>`, true)}
        </div>
      </div>
    </div>

    ${breadcrumb([{ label: 'Home', href: withBase('/') }, { label: col.label, href: col.url }, { label: displayName(p) }])}

    <section class="pdp-suggestions" aria-labelledby="suggestions-title"><h2 id="suggestions-title">You may also like</h2>${grid(suggestions)}</section>
  </article>`;
}

function initProduct(p) {
  const root = $('.pdp');
  let qty = 1;
  const value = $('[data-qty-value]', root);
  const dec = $('[data-qty-dec]', root);
  const inc = $('[data-qty-inc]', root);
  const paint = () => { value.textContent = String(qty); dec.disabled = qty <= 1; inc.disabled = qty >= MAX_QTY; };
  dec.addEventListener('click', () => { qty = Math.max(1, qty - 1); paint(); });
  inc.addEventListener('click', () => { qty = Math.min(MAX_QTY, qty + 1); paint(); });

  // the bottle tilts a little towards the mouse (fine pointers only), and on phones the dots follow the swipe
  const gallery = $('[data-pdp-gallery]', root);
  const bottleBox = $('.pdp-bottle', root);
  if (gallery && bottleBox && !reduced.matches) {
    gallery.addEventListener('pointermove', (event) => {
      if (event.pointerType !== 'mouse') return;
      const r = gallery.getBoundingClientRect();
      bottleBox.style.setProperty('--ry', `${(((event.clientX - r.left) / r.width - 0.5) * 16).toFixed(2)}deg`);
      bottleBox.style.setProperty('--rx', `${(-((event.clientY - r.top) / r.height - 0.5) * 8).toFixed(2)}deg`);
    });
    gallery.addEventListener('pointerleave', () => { bottleBox.style.removeProperty('--rx'); bottleBox.style.removeProperty('--ry'); });
  }
  const stage = $('.pdp-stage', root);
  const dots = $$('.pdp-dots button', root);
  if (stage && dots.length) {
    stage.addEventListener('scroll', () => {
      const index = Math.round(stage.scrollLeft / Math.max(1, stage.clientWidth));
      dots.forEach((dot, i) => dot.classList.toggle('is-active', i === index));
    }, { passive: true });
    dots.forEach((dot, i) => dot.addEventListener('click', () => stage.scrollTo({ left: i * stage.clientWidth, behavior: reduced.matches ? 'auto' : 'smooth' })));
  }

  const add = $('[data-add-to-bag]', root);
  const label = $('[data-add-label]', root);
  let timer = 0;
  add.addEventListener('click', async () => {
    const result = await addToBag(p.handle, qty);
    if (!result.ok) return;
    label.innerHTML = `${icon('check')} Added`;
    add.classList.add('is-added');
    clearTimeout(timer);
    timer = setTimeout(() => { label.textContent = 'Add to bag'; add.classList.remove('is-added'); }, 1800);
    qty = 1; paint();
  });
}

/* ── collection page ── */
function collectionView(c) {
  const products = collectionProducts(c.handle);
  const others = COLLECTIONS.filter((o) => o.handle !== c.handle);
  return `
  <div class="shop-page-head">
    ${breadcrumb([{ label: 'Home', href: withBase('/') }, { label: c.label }])}
    <h1>${esc(c.label)}</h1>
    <p class="shop-page-sub">${esc(c.subtitle)}</p>
    <p class="shop-page-lead">${esc(c.heading)}</p>
  </div>
  <div class="shop-collection">
    <div class="shop-collection-body">
      ${products.length ? `<p class="shop-count" role="status">${products.length} ${products.length === 1 ? 'fragrance' : 'fragrances'}</p>${grid(products)}` : '<div class="shop-message"><p>No fragrances are listed here yet.</p></div>'}
    </div>
  </div>
  ${others.length ? `<nav class="shop-collections-nav" aria-label="Other collections"><h2>More collections</h2><ul>${others.map((o) => `<li><a href="${o.url}">${esc(o.label)}</a></li>`).join('')}</ul></nav>` : ''}`;
}

/* ── search page ── */
function searchView(query) {
  const q = query.trim();
  const hits = q ? searchProducts(q) : [];
  return `
  <div class="shop-page-head">
    ${breadcrumb([{ label: 'Home', href: withBase('/') }, { label: 'Search' }])}
    <h1>Search</h1>
    <form class="shop-search" role="search" action="${withBase('/search')}" method="get">
      <label class="visually-hidden" for="shop-search-input">Search the collection</label>
      <input id="shop-search-input" name="q" type="search" value="${esc(q)}" placeholder="A name, a note or a mood" autocomplete="off">
      <button type="submit">Search</button>
    </form>
  </div>
  <div class="shop-collection-body shop-search-results">
    ${q ? `<p class="shop-count" role="status">${hits.length} ${hits.length === 1 ? 'result' : 'results'} for “${esc(q)}”</p>` : '<p class="shop-count">Try a name, a note such as “oud”, or a word like “fresh”.</p>'}
    ${hits.length ? grid(hits) : q ? `<div class="shop-message"><p>No fragrances match “${esc(q)}”.</p><p><a href="${collectionUrl(COLLECTION)}">Browse the whole collection</a></p></div>` : ''}
  </div>`;
}

/* ── checkout (demo) ── */
function checkoutView() {
  const { items, subtotal, currency } = cart.summary();
  if (!items.length) {
    return `<div class="shop-page-head"><h1>Checkout <span class="shop-demo-tag">demo</span></h1></div>
      <div class="shop-message"><p>Your bag is empty.</p><p><a href="${collectionUrl(COLLECTION)}">Browse the collection</a></p></div>`;
  }
  return `
  <div class="shop-page-head">${breadcrumb([{ label: 'Home', href: withBase('/') }, { label: 'Checkout (demo)' }])}<h1>Checkout <span class="shop-demo-tag">demo</span></h1></div>
  <div class="shop-checkout">
    <p class="shop-notice" role="note"><strong>Demo only.</strong> No payment details are collected, no order is created and nothing will be shipped. This page only shows what the bag adds up to.</p>
    <ul class="shop-checkout-lines">${items.map(({ product: p, qty, unit, line }) => `
      <li><img src="${p.thumb.src}" alt="" width="64" height="64">
        <span class="shop-checkout-name"><a href="${p.url}">${esc(displayName(p))}</a><span>${formatMoney(unit, currency)} × ${qty}</span></span>
        <span class="shop-checkout-total">${formatMoney(line, currency)}</span></li>`).join('')}</ul>
    <p class="shop-checkout-subtotal"><span>Subtotal</span><strong>${subtotal === null ? '—' : formatMoney(subtotal, currency)}</strong></p>
    <div class="shop-actions">
      <button type="button" class="shop-button" data-open-bag>Edit the bag</button>
      <button type="button" class="shop-button shop-button--ghost" data-clear-bag>Clear the demo bag</button>
      <a class="shop-link" href="${collectionUrl(COLLECTION)}">Continue shopping</a>
    </div>
  </div>`;
}

function initCheckout() {
  const draw = () => {
    view().innerHTML = checkoutView();
    $('[data-open-bag]')?.addEventListener('click', () => document.dispatchEvent(new CustomEvent('amore:open-cart')));
    $('[data-clear-bag]')?.addEventListener('click', () => cart.clear());
  };
  draw();
  cart.subscribe(draw);
}

/* ── placeholder + not found ── */
const pageView = (page) => `
  <div class="shop-page-head">${breadcrumb([{ label: 'Home', href: withBase('/') }, { label: page.title }])}<h1>${esc(page.title)}</h1></div>
  <div class="shop-message"><p>This page has not been written yet.</p><p><a href="${withBase('/')}">Back to the homepage</a></p></div>`;

const notFoundView = (what) => `
  <div class="shop-page-head"><h1>${esc(what)} not found</h1></div>
  <div class="shop-message"><p>That address is not part of this site.</p>
    <p><a href="${collectionUrl(COLLECTION)}">Browse the collection</a> · <a href="${searchUrl()}">Search</a> · <a href="${withBase('/')}">Homepage</a></p></div>`;

/* ── router ── */
export function renderShop() {
  cart.attach(getProduct); // the catalogue is already loaded here, so the bag can price its lines straight away
  const path = decodeURIComponent(withoutBase(location.pathname)).replace(/\/+$/, '');
  const [, section, handle] = path.split('/'); // ['', 'products', 'royal-oud']
  const out = view();

  if (section === 'products' && handle) {
    const p = getProduct(handle);
    if (p) { setMeta(displayName(p), `${p.name}: ${p.slogan}. ${p.description}`); out.innerHTML = productView(p); initProduct(p); return; }
    setMeta('Fragrance not found'); out.innerHTML = notFoundView('Fragrance'); return;
  }
  if (section === 'collections' && handle) {
    const c = getCollection(handle);
    if (c) { setMeta(c.label, `${c.label}: ${c.subtitle}. ${c.heading}`); out.innerHTML = collectionView(c); return; }
    setMeta('Collection not found'); out.innerHTML = notFoundView('Collection'); return;
  }
  if (section === 'pages' && handle) {
    const page = getPage(handle);
    if (page) { setMeta(page.title); out.innerHTML = pageView(page); return; }
    setMeta('Page not found'); out.innerHTML = notFoundView('Page'); return;
  }
  if (section === 'search') {
    const q = new URLSearchParams(location.search).get('q') || '';
    setMeta(q ? `Search: ${q}` : 'Search'); out.innerHTML = searchView(q); return;
  }
  if (section === 'checkout') { setMeta('Checkout (demo)'); initCheckout(); return; }
  setMeta('Page not found'); out.innerHTML = notFoundView('Page');
}
