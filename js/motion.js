// scroll-driven motion. Every effect is a pure function of scroll position, so scrolling back reverses it.
import { $, $$, clamp, onScrub, phone, reduced, windowProgress } from './util.js';

/* ── hero: the stage shrinks into a rounded window while the text marquee behind it fades in ──
   progress p runs 0 -> 1 over the scroll run (1.4 screens on desktop, 1 on phones)
   scale  = 1 - (desktop 0.60 | phone 0.45) * p        radius = (12 | 8)px * p
   marquee opacity = 0 until p = .12, then rises to 1 at p = .40                              */
export function initHero() {
  const section = $('[data-hero]');
  const pin = $('[data-hero-pin]');
  const stage = $('[data-hero-stage]');
  const marquee = $('[data-hero-marquee]');
  if (!section) return;
  onScrub(() => {
    const run = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hero-run')) || 1.4;
    const p = clamp(-section.getBoundingClientRect().top / (run * pin.offsetHeight));
    const shrink = phone.matches ? 0.45 : 0.6;
    const radius = phone.matches ? 8 : 12;
    stage.style.transform = `translate3d(0,0,0) scale(${(1 - shrink * p).toFixed(4)})`;
    stage.style.borderRadius = `${(radius * p).toFixed(2)}px`;
    marquee.style.opacity = clamp((p - 0.12) / 0.28).toFixed(3);
  });
}

/* ── the two side posters slide in from beyond the edges, the text drifts into place ── */
export function initChase() {
  const section = $('[data-chase]');
  if (!section) return;
  const left = $('.chase-arrival-image.is-left [data-chase-image]', section);
  const right = $('.chase-arrival-image.is-right [data-chase-image]', section);
  const [textL, textR] = $$('[data-chase-content]', section);
  onScrub(() => {
    if (reduced.matches) return;
    const remaining = 1 - windowProgress(section);
    const drift = 0.0295 * innerWidth * remaining;
    left.style.transform = `translate3d(${-80 * remaining}%,0,0)`;
    right.style.transform = `translate3d(${80 * remaining}%,0,0)`;
    textL.style.transform = `translate3d(${-drift}px,0,0)`;
    textR.style.transform = `translate3d(${drift}px,0,0)`;
  });
}

/* ── moving headlines: each band slides sideways while it crosses the screen (data-band = the way it travels) ──
   x runs from 0 to -travel (left) or from -travel to 0 (right); travel is one set of the text, at most 1.1 screens */
export function initBands() {
  for (const band of $$('[data-band]')) {
    const track = $('.band-track', band);
    const toward = band.dataset.band === 'right' ? 1 : -1;
    onScrub(() => {
      if (reduced.matches) return;
      const travel = Math.min(track.offsetWidth / 3, innerWidth * 1.1);
      const rect = band.getBoundingClientRect();
      const t = clamp((innerHeight - rect.top) / (innerHeight + rect.height));
      const x = toward < 0 ? -t * travel : -(1 - t) * travel;
      track.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
    });
  }
}

/* ── the bottle parade rises into view once; the collection grid fades its cards in with a short stagger ── */
export function initReveal() {
  const lineup = $('[data-lineup]');
  if (lineup) {
    new IntersectionObserver((entries, io) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      lineup.classList.add('is-in');
      io.disconnect();
    }, { threshold: 0.15 }).observe(lineup);
  }
  const grid = $('[data-reveal-grid]');
  if (!grid) return;
  const cards = $$('.collection-card', grid);
  const columns = () => getComputedStyle(grid).gridTemplateColumns.split(' ').length;
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.style.transitionDelay = `${(cards.indexOf(entry.target) % columns()) * 90}ms`;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px 5% 0px' });
  cards.forEach((card) => io.observe(card));
}
