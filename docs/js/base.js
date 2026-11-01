// Where the site lives. Normally that is the root. The GitHub Pages build adds <meta name="amore-base" content="/amore/">
// to its pages, so every address the scripts build (links, images, the route they read) carries the sub-folder.
const meta = typeof document === 'undefined' ? null : document.querySelector('meta[name="amore-base"]');

export const BASE = meta ? meta.getAttribute('content').replace(/\/?$/, '/') : '/';

/** '/products/royal-oud' -> '/amore/products/royal-oud' on Pages, unchanged at the root. */
export const withBase = (path) => BASE + String(path).replace(/^\//, '');

/** The route part of a pathname: '/amore/products/royal-oud/' -> '/products/royal-oud/'. */
export const withoutBase = (pathname) => (BASE !== '/' && pathname.startsWith(BASE) ? '/' + pathname.slice(BASE.length) : pathname);
