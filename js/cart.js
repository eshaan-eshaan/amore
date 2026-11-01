// The demo bag: what is in it, how many, what it adds up to, and how it is kept in localStorage.
// No DOM and no catalogue import: the page passes in `lookup(handle) -> product | null`, so this file also runs in Node.
// Only handles and quantities are stored. Prices are always read from the catalogue, so a stale or edited
// localStorage entry cannot produce a wrong total, and a product without a verified price can never enter the bag.

export const CART_KEY = 'amore-bag-v1';
export const MAX_QTY = 10;

const clampQty = (n) => Math.min(MAX_QTY, Math.max(1, Math.floor(Number(n)) || 1));
const isLine = (l) => l && typeof l.handle === 'string' && Number.isFinite(Number(l.qty)) && Number(l.qty) >= 1;

/** Parse whatever is in storage; anything malformed becomes an empty bag. */
export function parseStored(raw) {
  try {
    const data = JSON.parse(raw);
    if (!data || data.v !== 1 || !Array.isArray(data.lines)) return [];
    const merged = new Map();
    for (const l of data.lines.filter(isLine)) merged.set(l.handle, clampQty((merged.get(l.handle) || 0) + Number(l.qty)));
    return [...merged].map(([handle, qty]) => ({ handle, qty }));
  } catch { return []; }
}

const toMinor = (amount) => Math.round(amount * 100);
const usable = (p) => Boolean(p && p.price && Number.isFinite(p.price.amount) && p.price.amount > 0 && p.price.currency);

/** Lines joined to their products, with the subtotal in minor units (fils). Lines whose product is unknown are dropped. */
export function summarise(lines, lookup) {
  const items = [];
  let subtotal = 0;
  let currency = '';
  let mixed = false;
  for (const { handle, qty } of lines) {
    const product = lookup(handle);
    if (!usable(product)) continue;
    const unit = toMinor(product.price.amount);
    if (currency && currency !== product.price.currency) mixed = true;
    currency = product.price.currency;
    items.push({ product, qty, unit, line: unit * qty });
    subtotal += unit * qty;
  }
  return { items, count: items.reduce((n, i) => n + i.qty, 0), subtotal: mixed ? null : subtotal, currency };
}

/**
 * createCart({ storage, lookup }) -> store.
 * `lookup` may be supplied later with attach() (the homepage loads the catalogue only when the bag is first needed);
 * until then count() works from the stored quantities alone.
 */
export function createCart({ storage = null, lookup = null, key = CART_KEY } = {}) {
  const read = () => { try { return storage ? parseStored(storage.getItem(key)) : []; } catch { return []; } };
  let lines = read();
  let find = lookup;
  const listeners = new Set();

  const persist = () => { try { if (storage) storage.setItem(key, JSON.stringify({ v: 1, lines })); } catch { /* storage can be full or blocked; the bag still works for this page */ } };
  const emit = () => listeners.forEach((fn) => fn(api));
  const change = (next) => { lines = next; persist(); emit(); };

  const api = {
    get lines() { return lines.map((l) => ({ ...l })); },
    attach(fn) { find = fn; lines = lines.filter((l) => usable(find(l.handle))); emit(); },
    /** Add `qty` of a product. Returns { ok, qty } or { ok: false, reason }. */
    add(handle, qty = 1) {
      const product = find ? find(handle) : null;
      if (!product) return { ok: false, reason: 'unknown-product' };
      if (!usable(product)) return { ok: false, reason: 'no-verified-price' };
      const current = lines.find((l) => l.handle === handle);
      const total = Math.min(MAX_QTY, (current ? current.qty : 0) + clampQty(qty));
      change(current ? lines.map((l) => (l.handle === handle ? { handle, qty: total } : l)) : [...lines, { handle, qty: total }]);
      return { ok: true, qty: total, capped: total === MAX_QTY };
    },
    /** Set an exact quantity; 0 (or less) removes the line. */
    setQty(handle, qty) {
      if (!lines.some((l) => l.handle === handle)) return false;
      if (!(Number(qty) >= 1)) return api.remove(handle);
      change(lines.map((l) => (l.handle === handle ? { handle, qty: clampQty(qty) } : l)));
      return true;
    },
    remove(handle) {
      if (!lines.some((l) => l.handle === handle)) return false;
      change(lines.filter((l) => l.handle !== handle));
      return true;
    },
    clear() { change([]); },
    count() { return lines.reduce((n, l) => n + l.qty, 0); },
    summary() { return summarise(lines, find || (() => null)); },
    /** Re-read storage (another tab changed the bag). */
    reload() { lines = read(); emit(); },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
  return api;
}
