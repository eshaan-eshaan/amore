// finer details: headlines that rise word by word, a thin gold ring that follows the mouse, and an optional logo intro
import { $$, reduced } from './util.js';
import { withBase } from './base.js';

/* ── headlines marked data-split rise word by word the first time they come into view ── */
export function initSplit() {
  if (reduced.matches) return;
  const heads = $$('[data-split]');
  if (!heads.length) return;
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    }
  }, { threshold: 0.4 });
  for (const head of heads) {
    const words = head.textContent.trim().split(/\s+/);
    head.textContent = '';
    words.forEach((word, i) => {
      const outer = document.createElement('span');
      outer.className = 'split-word';
      outer.style.setProperty('--i', String(i));
      const inner = document.createElement('span');
      inner.textContent = word;
      outer.append(inner);
      head.append(outer);
      if (i < words.length - 1) head.append(' ');
    });
    head.classList.add('is-split');
    io.observe(head);
  }
}

/* ── a gold ring follows the mouse and grows over links and buttons (mouse only, never on touch screens) ── */
export function initCursor() {
  if (reduced.matches || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const ring = document.createElement('div');
  ring.className = 'cursor-ring';
  ring.setAttribute('aria-hidden', 'true');
  document.body.append(ring);
  let x = -100;
  let y = -100;
  let targetX = -100;
  let targetY = -100;
  let frame = 0;
  let seen = false;
  const tick = () => {
    x += (targetX - x) * 0.22;
    y += (targetY - y) * 0.22;
    ring.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    frame = Math.abs(targetX - x) + Math.abs(targetY - y) > 0.3 ? requestAnimationFrame(tick) : 0;
  };
  addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return;
    targetX = event.clientX;
    targetY = event.clientY;
    if (!seen) { seen = true; x = targetX; y = targetY; }
    ring.classList.add('is-on');
    ring.classList.toggle('is-link', !!(event.target.closest && event.target.closest('a, button, input, select, [role="button"]')));
    if (!frame) frame = requestAnimationFrame(tick);
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => ring.classList.remove('is-on'));
}

/* ── intro: the monogram fades in over a dark screen, then the page appears ──
   It plays once per visit (the tab remembers it), never with reduced motion, and a click or key press skips it.
   /?intro always plays it and /?nointro never does. Set INTRO_ENABLED to false to switch it off for everyone.
   index.html adds an 'intro-pending' class (a dark cover) in the head so the page never flashes before it starts. */
const INTRO_ENABLED = true;
const INTRO_KEY = 'amore-intro-seen';

export function initIntro() {
  const html = document.documentElement;
  const params = new URLSearchParams(location.search);
  let seen = false;
  try { seen = sessionStorage.getItem(INTRO_KEY) === '1'; } catch { /* storage blocked: the intro then plays on every load */ }
  const remember = () => { try { sessionStorage.setItem(INTRO_KEY, '1'); } catch { /* ignore */ } };
  if (params.has('nointro')) remember();
  const show = !reduced.matches && !params.has('nointro') && (params.has('intro') || (INTRO_ENABLED && !seen));
  if (!show) { html.classList.remove('intro-pending'); return; }
  remember();

  const intro = document.createElement('div');
  intro.className = 'intro';
  intro.setAttribute('aria-hidden', 'true');
  intro.innerHTML = `<div class="intro-inner"><img src="${withBase('/assets/logo/amore-monogram-light.png')}" alt="" width="467" height="301"><span class="intro-line"></span></div>`;
  document.body.append(intro);
  html.classList.add('no-scroll');
  html.classList.remove('intro-pending');

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    removeEventListener('keydown', finish);
    intro.classList.add('is-out');
    setTimeout(() => { intro.remove(); html.classList.remove('no-scroll'); }, 900);
  };
  const timer = setTimeout(finish, 2200);
  intro.addEventListener('pointerdown', finish);
  addEventListener('keydown', finish);
}
