// "Meet the ten": the stage takes on the colour of the bottle in the middle of the screen (or under the pointer),
// and a bottle tilts a little towards the mouse
import { $, $$, phone, reduced } from './util.js';
import { withBase } from './base.js';

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

/* ── smoke behind the bottles ──
   A silent looping video (assets/video). It is fetched only when the section is near the screen, plays only while the section is
   on screen, uses a smaller file on phones, and is left out (the still frame stays) for reduced motion and data-saver. */
export function initSmoke() {
  const box = $('.lineup-smoke');
  const video = box && $('video', box);
  if (!video) return;
  const connection = navigator.connection;
  if (reduced.matches || (connection && connection.saveData)) return;

  let loaded = false;
  let inView = false;
  const sync = () => {
    if (inView && !document.hidden) {
      if (!loaded) {
        loaded = true;
        video.src = withBase(phone.matches ? video.dataset.srcSmall : video.dataset.src);
      }
      video.play().then(() => video.classList.add('is-playing')).catch(() => { /* blocked or failed: the still frame stays */ });
    } else if (loaded) {
      video.pause();
    }
  };
  new IntersectionObserver((entries) => {
    inView = entries.some((entry) => entry.isIntersecting);
    sync();
  }, { rootMargin: '300px 0px' }).observe(box);
  document.addEventListener('visibilitychange', sync);
}
