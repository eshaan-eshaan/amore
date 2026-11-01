// The shopping-bag drawer, the count on the header bag icon and the "added to your bag" feedback.
// Shared by the homepage and the shop pages; both load it through their entry file.
import { $ } from './util.js';
import { createCart, MAX_QTY } from './cart.js';
import { icon } from './icons.js';
import { loadCatalogue } from './catalogue-loader.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const storage = (() => { try { return window.localStorage; } catch { return null; } })();

export const cart = createCart({ storage });

let status; // a visually hidden live region: screen readers hear "added", "removed", "quantity changed"
export function announce(message) {
  if (!status) {
    status = document.createElement('div');
    status.className = 'visually-hidden';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    document.body.append(status);
  }
  status.textContent = '';
  setTimeout(() => { status.textContent = message; }, 40); // a changed text node is what triggers the announcement
}

export const openCart = () => document.dispatchEvent(new CustomEvent('amore:open-cart'));

let catalogue = null; // set once the catalogue module has loaded
const cartButtons = () => [...document.querySelectorAll('[data-cart-open]')];

function updateBadge() {
  const count = cart.count();
  cartButtons().forEach((button) => {
    let badge = $('[data-cart-count]', button);
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'cart-count';
      badge.setAttribute('data-cart-count', '');
      badge.setAttribute('aria-hidden', 'true');
      button.append(badge);
    }
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.hidden = count === 0;
    button.setAttribute('aria-label', count ? `Open shopping bag, ${count} ${count === 1 ? 'item' : 'items'}` : 'Open shopping bag');
  });
}

function render() {
  updateBadge();
  const main = $('#cart-overlay main');
  if (!main) return;
  if (!cart.count()) {
    main.innerHTML = '<div class="cart-empty"><p>Your bag is currently empty.</p><button class="cart-continue" type="button" data-drawer-close>Continue shopping</button></div>';
    return;
  }
  if (!catalogue) { main.innerHTML = '<div class="cart-empty"><p>Loading your bag…</p></div>'; return; }

  const { displayName, formatMoney, productUrl } = catalogue;
  const { items, subtotal, currency } = cart.summary();
  main.innerHTML = `
    <ul class="cart-list">${items.map(({ product: p, qty, unit, line }) => {
      const name = displayName(p);
      return `<li class="cart-line" data-handle="${p.handle}">
        <a class="cart-line-image" href="${productUrl(p.handle)}" tabindex="-1" aria-hidden="true"><img src="${p.thumb.src}" alt="" width="80" height="80"></a>
        <div class="cart-line-body">
          <a class="cart-line-name" href="${productUrl(p.handle)}">${esc(name)}</a>
          <p class="cart-line-meta">${formatMoney(unit, currency)} each</p>
          <div class="cart-line-controls">
            <div class="qty" role="group" aria-label="Quantity of ${esc(name)}">
              <button type="button" class="qty-button" data-cart-dec aria-label="Decrease quantity of ${esc(name)}">${icon('minus')}</button>
              <span class="qty-value" data-qty>${qty}</span>
              <button type="button" class="qty-button" data-cart-inc aria-label="Increase quantity of ${esc(name)}"${qty >= MAX_QTY ? ' disabled' : ''}>${icon('plus')}</button>
            </div>
            <button type="button" class="cart-remove" data-cart-remove aria-label="Remove ${esc(name)} from the bag">Remove</button>
          </div>
        </div>
        <p class="cart-line-total">${formatMoney(line, currency)}</p>
      </li>`;
    }).join('')}</ul>
    <div class="cart-footer">
      <p class="cart-subtotal"><span>Subtotal</span><strong data-cart-subtotal>${subtotal === null ? '—' : formatMoney(subtotal, currency)}</strong></p>
      <p class="cart-note">Demo bag. Nothing is charged and no order is placed.</p>
      <a class="cart-checkout" href="${catalogue.CHECKOUT_URL}">Review checkout (demo)</a>
      <button class="cart-continue" type="button" data-drawer-close>Continue shopping</button>
    </div>`;
}

async function ensureCatalogue() {
  if (catalogue) return;
  catalogue = await loadCatalogue();
  cart.attach(catalogue.getProduct);
}

export async function initCart() {
  cart.subscribe(render);
  updateBadge();

  const overlay = $('#cart-overlay');
  if (overlay) {
    overlay.addEventListener('click', (event) => {
      const line = event.target.closest('.cart-line');
      if (!line) return;
      const kind = event.target.closest('[data-cart-inc]') ? 'inc' : event.target.closest('[data-cart-dec]') ? 'dec' : event.target.closest('[data-cart-remove]') ? 'remove' : null;
      if (!kind) return;
      const handle = line.dataset.handle;
      const current = cart.lines.find((l) => l.handle === handle);
      const name = catalogue.displayName(catalogue.getProduct(handle));
      if (kind === 'inc') {
        const res = cart.add(handle, 1);
        announce(res.capped ? `Maximum of ${MAX_QTY} reached for ${name}` : `${name}, quantity ${res.qty}`);
      } else if (kind === 'dec' && current) {
        cart.setQty(handle, current.qty - 1);
        announce(current.qty - 1 < 1 ? `${name} removed from the bag` : `${name}, quantity ${current.qty - 1}`);
      } else if (kind === 'remove') {
        cart.remove(handle);
        announce(`${name} removed from the bag`);
      }
      // the list was redrawn: keep keyboard focus on the same control, or on a sensible neighbour when the line is gone
      const same = kind === 'remove' ? null : overlay.querySelector(`.cart-line[data-handle="${handle}"] [data-cart-${kind}]`);
      const fallback = same && !same.disabled ? same : overlay.querySelector('.cart-line-name, .cart-continue');
      if (fallback) fallback.focus({ preventScroll: true });
    });
  }

  document.addEventListener('amore:drawer-opened', async (event) => {
    if (event.detail.name !== 'cart') return;
    cart.reload(); // another tab may have changed the bag
    await ensureCatalogue();
    render();
  });
  addEventListener('storage', (event) => { if (event.key === null || event.key === 'amore-bag-v1') cart.reload(); });

  // a bag with items loads the catalogue right away so the drawer is ready and the stored lines are checked
  if (cart.count()) { await ensureCatalogue(); render(); } else render();
}

/** Add a product from a page and give feedback: live announcement, drawer opens on the updated bag. */
export async function addToBag(handle, qty = 1) {
  await ensureCatalogue();
  const product = catalogue.getProduct(handle);
  const result = cart.add(handle, qty);
  if (!result.ok) {
    announce(result.reason === 'no-verified-price' ? 'This product has no confirmed price, so it cannot be added to the bag.' : 'That product is not in the catalogue.');
    return result;
  }
  announce(`${catalogue.displayName(product)} added to the bag. ${cart.count()} ${cart.count() === 1 ? 'item' : 'items'} in the bag.`);
  render();
  openCart();
  return result;
}
