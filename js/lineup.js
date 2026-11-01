// "Meet the ten": the stage takes on the colour of the bottle in the middle of the screen (or under the pointer),
// and a bottle tilts a little towards the mouse
import { $, $$, reduced } from './util.js';

export function initLineup() {
  const section = $('[data-lineup]');
  if (!section) return;
  const items = $$('.lineup-item', section);
  let hovered = null;
  let centred = null;

  const paint = () => {
    const item = hovered || centred;
    if (item) section.style.setProperty('--tint', item.dataset.accent);
    else section.style.removeProperty('--tint');
  };

  // while nobody points at a bottle, the one crossing the middle of the screen sets the colour
  const inside = new Set();
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) (entry.isIntersecting ? inside.add(entry.target) : inside.delete(entry.target));
    const middle = innerWidth / 2;
    let best = null;
    let bestDistance = Infinity;
    for (const el of inside) {
      const r = el.getBoundingClientRect();
      const distance = Math.abs((r.left + r.right) / 2 - middle);
      if (distance < bestDistance) { best = el; bestDistance = distance; }
    }
    centred = best;
    paint();
  }, { rootMargin: '0px -42% 0px -42%' });
  items.forEach((item) => observer.observe(item));

  items.forEach((item) => {
    const leave = () => {
      item.style.removeProperty('--rx');
      item.style.removeProperty('--ry');
      if (hovered === item) { hovered = null; paint(); }
    };
    item.addEventListener('pointerenter', (event) => { if (event.pointerType === 'mouse') { hovered = item; paint(); } });
    item.addEventListener('pointermove', (event) => {
      if (event.pointerType !== 'mouse' || reduced.matches) return;
      const r = item.getBoundingClientRect();
      item.style.setProperty('--ry', `${(((event.clientX - r.left) / r.width - 0.5) * 18).toFixed(2)}deg`);
      item.style.setProperty('--rx', `${(-((event.clientY - r.top) / r.height - 0.5) * 9).toFixed(2)}deg`);
    });
    item.addEventListener('pointerleave', leave);
    item.addEventListener('focus', () => { hovered = item; paint(); });
    item.addEventListener('blur', leave);
  });
}
