// Spotlight glow: a soft light in the fragrance's own colour follows the pointer across a card and lights the edge nearest to it.
// Cards opt in with data-spot (and carry --accent); css/brand.css draws the light from the --mx / --my set here.
// Mouse and pen hover only: touch screens, and reduced motion, get nothing.
import { reduced } from './util.js';

export function initSpotlight() {
  if (reduced.matches || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  let lit = null;
  let grid = null;
  let frame = 0;
  let pending = null;
  let timer = 0;

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
    clearTimeout(timer);
    timer = 0;
    if (lit) lit.classList.remove('is-lit');
    if (grid) grid.classList.remove('is-focusing');
    lit = null;
    grid = null;
  };

  // one listener for every card on the page, including the ones the shop pages draw later
  document.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    const card = event.target.closest && event.target.closest('[data-spot]');
    if (card && card !== lit) {
      off();
      lit = card;
      card.classList.add('is-lit');
      grid = card.closest('.collection-grid, .shop-grid'); // the other cards in this grid soften while this one is lit
      if (grid) grid.classList.add('is-focusing');
    }
    if (!card) return;
    clearTimeout(timer);
    timer = 0;
    pending = { card, x: event.clientX, y: event.clientY };
    if (!frame) frame = requestAnimationFrame(paint);
  }, { passive: true });
  // the gap between two cards does not end the focus at once, or the grid would flicker as the pointer crosses it
  document.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch' || !lit || timer) return;
    if (!(event.target.closest && event.target.closest('[data-spot]'))) timer = setTimeout(off, 240);
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', off);
}
