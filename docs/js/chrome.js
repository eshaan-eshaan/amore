// announcement bar, header, menu drawer, cart + search drawers
import { $, $$ } from './util.js';
import { loadCatalogue } from './catalogue-loader.js';

const DISMISS_KEY = 'amore-announcement-dismissed';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ── announcement bar: two messages that slide sideways every 3s (the close button stays in the markup, hidden) ── */
export function initAnnouncement() {
  const bar = $('#announcement');
  const header = $('#main-header');
  const track = $('[data-announcement-track]');
  if (!bar || !track) return;

  const dismiss = () => { bar.classList.add('is-dismissed'); header.classList.add('no-announcement'); };
  try { if (sessionStorage.getItem(DISMISS_KEY)) dismiss(); } catch { /* storage can be blocked */ }
  $('[data-announcement-close]', bar).addEventListener('click', () => {
    dismiss();
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  });

  const slides = $$('.announcement-slide', track);
  if (slides.length < 2) return;
  const clone = slides[0].cloneNode(true);
  clone.setAttribute('aria-hidden', 'true');
  track.append(clone); // a copy of the first slide lets the loop keep sliding the same way

  let index = 0;
  let hovering = false;
  const go = (n) => {
    index = n;
    track.classList.add('is-sliding');
    track.style.transform = `translate3d(${-100 * index}%,0,0)`;
  };
  track.addEventListener('transitionend', () => {
    if (index !== slides.length) return;
    track.classList.remove('is-sliding'); // jump back to the real first slide without animating
    index = 0;
    track.style.transform = 'translate3d(0,0,0)';
  });
  bar.addEventListener('mouseenter', () => { hovering = true; });
  bar.addEventListener('mouseleave', () => { hovering = false; });
  setInterval(() => {
    if (!hovering && !document.hidden && !bar.classList.contains('is-dismissed')) go(index + 1);
  }, 3000);
}

/* ── header: sits on the hero and scrolls away; scrolling back up brings it back as a white bar.
      Thresholds measured on the reference (desktop and phone alike): scrolling up switches the bar on after a nudge of 5px
      or more (4px does nothing); scrolling down switches it off at once, even for 1px; and the bar stays on all the way
      up the page until scrollY is exactly 0. ── */
export function initHeader() {
  const header = $('#main-header');
  const bar = $('#announcement');
  let last = scrollY;
  let ticking = false;
  const set = (on) => {
    header.classList.toggle('header-scroll-up', on);
    bar.classList.toggle('header-scroll-up', on);
  };
  const apply = () => {
    ticking = false;
    const y = scrollY;
    const delta = y - last;
    if (y <= 0 || delta > 0) set(false);
    else if (delta <= -5) set(true);
    last = y;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(apply); } }, { passive: true });
}

/* ── drawers + search ── */
export function initDrawers() {
  const root = document.documentElement;
  const header = $('#main-header');
  const menu = $('[data-menu-drawer]');
  const menuOverlay = $('[data-menu-overlay]');
  let opener = null;

  // while a drawer is open the page behind it is inert: Tab stays inside the drawer and screen readers skip the page
  const behind = $$('#announcement, #main-header, #main, footer.new-footer');
  const lock = (on) => {
    root.classList.toggle('no-scroll', on);
    behind.forEach((el) => { if (on) el.setAttribute('inert', ''); else el.removeAttribute('inert'); });
  };

  function openMenu(trigger) {
    opener = trigger;
    menu.classList.add('open');
    menu.setAttribute('aria-hidden', 'false');
    menuOverlay.classList.add('show');
    $$('[data-menu-open]').forEach((b) => b.setAttribute('aria-expanded', 'true'));
    lock(true);
    setTimeout(() => $('[data-menu-close]', menu).focus({ preventScroll: true }), 50);
  }
  function closeMenu() {
    if (!menu.classList.contains('open')) return;
    menu.classList.remove('open');
    menu.setAttribute('aria-hidden', 'true');
    menuOverlay.classList.remove('show');
    $$('[data-menu-open]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
    lock(false);
    if (opener) opener.focus({ preventScroll: true });
  }

  function openAside(name, trigger) {
    const overlay = $(`[data-drawer-overlay="${name}"]`);
    if (!overlay || overlay.classList.contains('expanded')) return overlay;
    opener = trigger || document.activeElement;
    overlay.classList.add('expanded');
    $('aside', overlay).setAttribute('aria-hidden', 'false');
    lock(true);
    document.dispatchEvent(new CustomEvent('amore:drawer-opened', { detail: { name } }));
    return overlay;
  }
  function closeAside(overlay) {
    if (!overlay.classList.contains('expanded')) return;
    overlay.classList.remove('expanded');
    $('aside', overlay).setAttribute('aria-hidden', 'true');
    lock(false);
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  }
  const closeAsides = () => $$('[data-drawer-overlay]').forEach(closeAside);

  $$('[data-menu-open]').forEach((b) => b.addEventListener('click', () => openMenu(b)));
  $$('[data-menu-close]').forEach((b) => b.addEventListener('click', closeMenu));
  menuOverlay.addEventListener('click', closeMenu);
  const openCart = (trigger) => {
    const overlay = openAside('cart', trigger);
    setTimeout(() => $('.close', overlay).focus({ preventScroll: true }), 60);
  };
  $$('[data-cart-open]').forEach((b) => b.addEventListener('click', () => openCart(b)));
  // the drawer content is re-rendered (bag lines), so close buttons are handled by delegation
  $$('[data-drawer-overlay]').forEach((overlay) => {
    overlay.addEventListener('click', (event) => { if (event.target.closest('[data-drawer-close]')) closeAside(overlay); });
  });
  document.addEventListener('amore:open-cart', () => openCart(document.activeElement));

  // Escape closes whichever drawer is open: the menu, the search or the bag.
  addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { closeMenu(); closeAsides(); }
  });

  /* ── search: the icon opens an inline field in the header; typing opens the SEARCH drawer with matching products ── */
  const form = $('[data-search-form]');
  const input = $('[data-search-input]');
  const drawerInput = $('[data-search-drawer-input]');
  const results = $('[data-search-results]');
  const drawerForm = $('.predictive-search-form');
  let token = 0;

  /** Render the matches for `query` into the drawer. Returns the products shown. */
  async function render(query) {
    const mine = ++token;
    const { searchProducts, featuredProducts, displayName, priceLabel, searchUrl, collectionUrl } = await loadCatalogue();
    if (mine !== token) return [];
    const q = query.trim().replace(/\s+/g, ' ');
    const list = q ? searchProducts(q, { limit: 8 }) : featuredProducts();
    const heading = q ? `${list.length} ${list.length === 1 ? 'result' : 'results'} for “${esc(q)}”` : 'Featured';
    if (!list.length) {
      results.innerHTML = `<h4>${heading}</h4><p class="predictive-empty">No fragrances match “${esc(q)}”. Try a name or a note such as “oud”.</p><a class="predictive-all" href="${collectionUrl('the-fragrance-collection')}">Browse the collection</a>`;
      return list;
    }
    results.innerHTML = `<h4>${heading}</h4><ul class="predictive-list">${list.map((p, i) => `
      <li><a class="predictive-item${q && i === 0 ? ' is-top' : ''}" href="${p.url}">
        <img src="${p.thumb.src}" alt="" width="50" height="50" loading="lazy">
        <span class="predictive-text"><span class="predictive-name">${esc(displayName(p))}</span><span class="predictive-meta">${esc(p.keyNotes.join(' · '))}${priceLabel(p) ? ' · ' + esc(priceLabel(p)) : ''}</span></span>
      </a></li>`).join('')}</ul>${q ? `<a class="predictive-all" href="${searchUrl(q)}">See all results</a>` : ''}`;
    return list;
  }

  const openField = () => { form.classList.add('is-open'); header.classList.add('search-open'); input.focus({ preventScroll: true }); };
  const closeField = () => { form.classList.remove('is-open'); header.classList.remove('search-open'); input.value = ''; };
  const showResults = (query) => {
    drawerInput.value = query;
    render(query);
    openAside('search', input);
    setTimeout(() => drawerInput.focus({ preventScroll: true }), 60);
  };
  /** Enter: go straight to the best match. With no match the drawer stays open and says so. */
  async function submit(query) {
    const q = query.trim();
    if (!q) return;
    const { searchProducts } = await loadCatalogue();
    const [best] = searchProducts(q, { limit: 1 });
    if (best) location.assign(best.url);
    else showResults(query);
  }
  const focusFirstResult = () => { const first = $('.predictive-item', results); if (first) first.focus(); };

  $('[data-search-toggle]').addEventListener('click', () => {
    if (!form.classList.contains('is-open')) openField();
    else if (input.value.trim()) showResults(input.value);
    else closeField();
  });
  input.addEventListener('input', () => { if (input.value.trim()) showResults(input.value); });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); submit(input.value); }
    else if (event.key === 'ArrowDown' && input.value.trim()) { event.preventDefault(); showResults(input.value); setTimeout(focusFirstResult, 120); }
  });
  input.addEventListener('blur', () => { setTimeout(() => { if (!input.value.trim() && document.activeElement !== input) closeField(); }, 200); });

  drawerInput.addEventListener('input', () => render(drawerInput.value));
  drawerInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); submit(drawerInput.value); }
    else if (event.key === 'ArrowDown') { event.preventDefault(); focusFirstResult(); }
  });
  drawerForm.addEventListener('submit', (event) => { event.preventDefault(); submit(drawerInput.value); });
  // arrow keys walk the result links; ArrowUp from the first one goes back to the field
  results.addEventListener('keydown', (event) => {
    const links = $$('.predictive-item, .predictive-all', results);
    const at = links.indexOf(document.activeElement);
    if (at < 0) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); links[Math.min(at + 1, links.length - 1)].focus(); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); if (at === 0) drawerInput.focus(); else links[at - 1].focus(); }
  });
  // the drawer opens with the featured products so it is never blank
  document.addEventListener('amore:drawer-opened', (event) => {
    if (event.detail.name === 'search' && !drawerInput.value.trim() && !results.children.length) render('');
  });
  $('#search-overlay').addEventListener('transitionend', (event) => {
    if (event.target.id === 'search-overlay' && !event.target.classList.contains('expanded')) closeField();
  });
}

/* ── menu drawer: the "Featured" tile slider ── */
export function initMenuTiles() {
  const wrap = $('[data-tiles]');
  if (!wrap) return;
  const track = $('[data-tiles-track]', wrap);
  const tiles = $$('.menu-tile', track);
  const prev = $('[data-tiles-prev]', wrap);
  const next = $('[data-tiles-next]', wrap);
  const fraction = $('[data-tiles-fraction]', wrap);
  const toggle = $('[data-tiles-toggle]', wrap);
  let index = 0;
  const render = () => {
    const step = tiles[0].offsetWidth + 12;
    track.style.transform = `translateX(${-index * step}px)`;
    fraction.textContent = `${index + 1}/${tiles.length}`;
    prev.classList.toggle('is-disabled', index === 0);
    next.classList.toggle('is-disabled', index === tiles.length - 1);
  };
  prev.addEventListener('click', () => { index = Math.max(0, index - 1); render(); });
  next.addEventListener('click', () => { index = Math.min(tiles.length - 1, index + 1); render(); });
  toggle.addEventListener('click', () => {
    const collapsed = wrap.classList.toggle('is-collapsed');
    toggle.setAttribute('aria-expanded', String(!collapsed));
  });
  addEventListener('resize', render);
  render();
}
