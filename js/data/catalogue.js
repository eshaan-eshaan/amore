// The catalogue: AMORE's product data joined to its posters and its one collection, plus the pure helpers the
// shop pages, the bag and the search all share. No DOM in here, so the dev server and the tests can import it too.
import { BRAND, PRODUCTS as DATA } from './products.js';
import { withBase } from '../base.js'; // the root normally; a sub-folder on the GitHub Pages build

export { BRAND };
export const CURRENCY = BRAND.currency;

export const productUrl = (handle) => withBase(`/products/${handle}`);
export const collectionUrl = (handle) => withBase(`/collections/${handle}`);
export const pageUrl = (slug) => withBase(`/pages/${slug}`);
export const searchUrl = (query = '') => withBase(`/search${query ? `?q=${encodeURIComponent(query)}` : ''}`);
export const CHECKOUT_URL = withBase('/checkout');

/** Pages the menu and footer link to. Their content has not been written yet, so the shop shows a placeholder. */
export const PAGES = [
  { slug: 'about', title: 'About AMORE' },
  { slug: 'contact', title: 'Contact' },
];

export const PRODUCTS = DATA.map((p) => {
  const poster = { src: withBase(`/assets/${p.poster.file}`), width: p.poster.width, height: p.poster.height, alt: `AMORE ${p.name} ${BRAND.type} poster`, kind: 'poster' };
  const bottle = { src: withBase(`/assets/${p.bottle.file}`), width: p.bottle.width, height: p.bottle.height, alt: `AMORE ${p.name} ${BRAND.type} bottle`, kind: 'bottle' };
  return {
    ...p,
    images: [poster],
    thumb: poster,
    bottleImage: bottle,
    collection: BRAND.collection.handle,
    collectionLabel: BRAND.collection.label,
    url: productUrl(p.handle),
  };
});
const productByHandle = new Map(PRODUCTS.map((p) => [p.handle, p]));

export const COLLECTIONS = [{
  ...BRAND.collection,
  url: collectionUrl(BRAND.collection.handle),
  products: PRODUCTS.map((p) => p.handle),
}];
const collectionByHandle = new Map(COLLECTIONS.map((c) => [c.handle, c]));

export const getProduct = (handle) => productByHandle.get(handle) || null;
export const getCollection = (handle) => collectionByHandle.get(handle) || null;
export const getPage = (slug) => PAGES.find((p) => p.slug === slug) || null;
export const collectionProducts = (handle) => (getCollection(handle) ? getCollection(handle).products.map(getProduct) : []);

export const displayName = (p) => p.name;

/** The three products the menu and the empty search drawer feature. */
export const featuredProducts = () => PRODUCTS.slice(0, 3);

/** Other fragrances to suggest: the ones that follow this one in the collection, wrapping round to the start. */
export function relatedProducts(handle, limit = 4) {
  const at = PRODUCTS.findIndex((p) => p.handle === handle);
  if (at < 0) return [];
  return Array.from({ length: Math.min(limit, PRODUCTS.length - 1) }, (_, k) => PRODUCTS[(at + 1 + k) % PRODUCTS.length]);
}

/* ── price ── */
/** A product can only go in the bag if it carries a real price. */
export const hasVerifiedPrice = (p) => Boolean(p && p.price && Number.isFinite(p.price.amount) && p.price.amount > 0 && p.price.currency);
export const toMinor = (amount) => Math.round(amount * 100);
/** 99900 -> "₹999", 299700 -> "₹2,997", 12345 -> "₹123.45" (Indian digit grouping). Other currencies: "USD 12.30". */
export function formatMoney(minor, currency = CURRENCY) {
  if (currency === 'INR') {
    return `₹${(minor / 100).toLocaleString('en-IN', { minimumFractionDigits: minor % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
  }
  return `${currency} ${(minor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
export const priceLabel = (p) => (hasVerifiedPrice(p) ? formatMoney(toMinor(p.price.amount), p.price.currency) : '');

/* ── search ── */
/** Lower-case, accents folded, punctuation turned into spaces: "Bleu Impérial" -> "bleu imperial". */
export const fold = (text) => String(text || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const WEIGHTS = { name: 10, notes: 8, slogan: 4, character: 4, description: 2 };
const searchIndex = PRODUCTS.map((p) => ({
  product: p,
  fields: [
    ['name', fold(`${p.name} ${p.handle.replace(/-/g, ' ')}`)],
    ['notes', fold(p.keyNotes.join(' '))],
    ['slogan', fold(p.slogan)],
    ['character', fold(p.character.join(' '))],
    ['description', fold(p.description)],
  ],
}));

/** Every query word has to match somewhere (at the start of a word, or inside one once it is 3+ letters). */
function tokenScore(fields, token) {
  let best = 0;
  for (const [key, text] of fields) {
    if (!text) continue;
    const words = text.split(' ');
    let hit = 0;
    if (words.includes(token)) hit = WEIGHTS[key] * 1.5;
    else if (words.some((w) => w.startsWith(token))) hit = WEIGHTS[key];
    else if (token.length >= 3 && text.includes(token)) hit = WEIGHTS[key] * 0.5;
    if (hit > best) best = hit;
  }
  return best;
}

/** Ranked products for a query ("  ROYAL   oud "), best match first; ties keep collection order. */
export function searchProducts(query, { limit = Infinity } = {}) {
  const q = fold(query);
  if (!q) return [];
  const tokens = q.split(' ');
  const hits = [];
  searchIndex.forEach(({ product, fields }, order) => {
    let score = 0;
    for (const token of tokens) {
      const s = tokenScore(fields, token);
      if (!s) return;
      score += s;
    }
    const name = fields[0][1];
    if (name.startsWith(q)) score += 20;
    else if (name.includes(q)) score += 8;
    hits.push({ product, score, order });
  });
  hits.sort((a, b) => b.score - a.score || a.order - b.order);
  return hits.slice(0, limit).map((h) => h.product);
}
