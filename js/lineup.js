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
    item.addEventListener('focus', () => { if (item.matches(':focus-visible')) { hovered = item; paint(); } }); // keyboard focus only: a mouse click must not pin the colour
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

/* ── the parade: it drifts on its own, and can be pressed and slid ──
   The row's position x (always between -half and 0) is applied as a transform. Its speed eases towards the drift speed, or towards
   zero while the mouse rests on the row or a bottle has keyboard focus, so letting go after a drag glides on and then settles back
   into the drift. Two copies of the ten bottles make it endless in both directions. A press-and-slide works with a mouse, a finger
   or a pen; a horizontal two-finger swipe on a trackpad moves it too; a plain click or tap still opens the bottle.
   With reduced motion there is no drift and no glide: the row is a plain scrollable strip that the mouse can still drag. */
export function initParade() {
  const section = $('[data-lineup]');
  const viewport = section && $('.lineup-viewport', section);
  const track = viewport && $('.lineup-track', viewport);
  if (!track) return;

  const driven = !reduced.matches;
  const DRIFT = -35; // px per second to the left: one full cycle in about 90 seconds
  const GLIDE = 2.4; // how quickly the speed eases to its target, per second
  let half = 0;      // the width of one set of ten bottles
  let x = 0;
  let v = DRIFT;
  let hover = false;
  let keyboard = false;
  let onScreen = false;
  let drag = null;
  let suppressClick = false;
  let raf = 0;
  let last = 0;

  const measure = () => { half = track.offsetWidth / 2; };
  const wrap = (position) => {
    if (!half) return 0;
    const q = position % half;
    return q > 0 ? q - half : q;
  };
  const place = () => { track.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`; };

  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!drag) {
      v += ((hover || keyboard ? 0 : DRIFT) - v) * (1 - Math.exp(-dt * GLIDE));
      x = wrap(x + v * dt);
      place();
    }
    raf = onScreen && !document.hidden ? requestAnimationFrame(frame) : 0;
  };
  const run = () => {
    if (!driven || !onScreen || document.hidden || raf) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };

  measure();
  if (driven) section.classList.add('is-driven');
  new IntersectionObserver((entries) => { onScreen = entries.some((entry) => entry.isIntersecting); run(); }, { threshold: 0.15 }).observe(section);
  document.addEventListener('visibilitychange', run);
  addEventListener('resize', () => { measure(); x = wrap(x); if (driven) place(); });

  viewport.addEventListener('pointerenter', (event) => { if (event.pointerType === 'mouse') hover = true; });
  viewport.addEventListener('pointerleave', (event) => { if (event.pointerType === 'mouse') hover = false; });

  // press and slide
  viewport.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' ? event.button !== 0 : !driven) return;
    drag = { id: event.pointerId, originX: event.clientX, originPosition: driven ? x : viewport.scrollLeft, lastX: event.clientX, lastTime: event.timeStamp, velocity: 0, moved: false };
  });
  viewport.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.originX;
    if (!drag.moved) {
      if (Math.abs(dx) < 5) return; // a press that barely moves is still a click
      drag.moved = true;
      viewport.setPointerCapture(event.pointerId);
      section.classList.add('is-dragging');
    }
    const dt = Math.max(1, event.timeStamp - drag.lastTime) / 1000;
    drag.velocity += ((event.clientX - drag.lastX) / dt - drag.velocity) * 0.4;
    drag.lastX = event.clientX;
    drag.lastTime = event.timeStamp;
    if (driven) { x = wrap(drag.originPosition + dx); place(); } else viewport.scrollLeft = drag.originPosition - dx;
  });
  const end = (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    if (drag.moved) {
      // letting go while still moving glides on; letting go after a pause just settles
      v = driven && event.timeStamp - drag.lastTime < 90 ? Math.max(-3500, Math.min(3500, drag.velocity)) : 0;
      suppressClick = true; // the click that follows a drag must not open the bottle under the pointer
      setTimeout(() => { suppressClick = false; }, 60);
    }
    drag = null;
    section.classList.remove('is-dragging');
  };
  viewport.addEventListener('pointerup', end);
  viewport.addEventListener('pointercancel', end);
  viewport.addEventListener('click', (event) => { if (suppressClick) { event.preventDefault(); event.stopPropagation(); } }, true);
  viewport.addEventListener('dragstart', (event) => event.preventDefault());

  if (driven) {
    // a sideways trackpad swipe moves the row; a vertical scroll stays the page's
    viewport.addEventListener('wheel', (event) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      event.preventDefault();
      x = wrap(x - event.deltaX);
      place();
    }, { passive: false });
    // the row is moved by the script, so the browser must never scroll it by itself (it tries to when a link gets focus)
    viewport.addEventListener('scroll', () => { if (viewport.scrollLeft) viewport.scrollLeft = 0; });
  }

  // keyboard: Tab to a bottle that is out of sight slides it into view, and the drift waits while it has focus
  viewport.addEventListener('focusin', (event) => {
    const item = event.target.closest && event.target.closest('.lineup-item');
    if (!item || !item.matches(':focus-visible')) return;
    keyboard = true;
    if (!driven) return;
    const r = item.getBoundingClientRect();
    const vr = viewport.getBoundingClientRect();
    if (r.left < vr.left + 16 || r.right > vr.right - 16) {
      const offset = r.left - track.getBoundingClientRect().left; // the bottle's place inside the track
      x = wrap(Math.min(0, (vr.width - r.width) / 2 - offset));
      v = 0; // stay exactly where the bottle was put, not a few pixels further on
      place();
    }
  });
  viewport.addEventListener('focusout', (event) => { if (!viewport.contains(event.relatedTarget)) keyboard = false; });
}
