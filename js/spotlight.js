// Spotlight glow: a soft light in the fragrance's own colour follows the pointer across a card and lights the edge nearest to it.
// Cards opt in with data-spot (and carry --accent); css/brand.css draws the light from the --mx / --my set here.
// Mouse and pen hover only: touch screens, and reduced motion, get nothing.
import { reduced } from './util.js';

export function initSpotlight() {
  if (reduced.matches || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  let lit = null;
  let frame = 0;
  let pending = null;

  const paint = () => {
    frame = 0;
    if (!pending) return;
    const { card, x, y } = pending;
    const area = card.querySelector('.collection-card-image, .shop-card-media') || card;
    const r = area.getBoundingClientRect();
    card.style.setProperty('--mx', `${(x - r.left).toFixed(1)}px`);
    card.style.setProperty('--my', `${(y - r.top).toFixed(1)}px`);
  };
  const off = () => {
    if (lit) { lit.classList.remove('is-lit'); lit = null; }
  };

  // one listener for every card on the page, including the ones the shop pages draw later
  document.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    const card = event.target.closest && event.target.closest('[data-spot]');
    if (card !== lit) {
      off();
      if (card) { lit = card; card.classList.add('is-lit'); }
    }
    if (!card) return;
    pending = { card, x: event.clientX, y: event.clientY };
    if (!frame) frame = requestAnimationFrame(paint);
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', off);
}
