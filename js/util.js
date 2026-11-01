// small shared helpers: selectors, math, media queries and one rAF-throttled scroll/resize scheduler
export const $ = (selector, scope = document) => scope.querySelector(selector);
export const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
export const lerp = (a, b, t) => a + (b - a) * t;

export const reduced = matchMedia('(prefers-reduced-motion: reduce)');
export const phone = matchMedia('(max-width: 768px)'); // the reference switches layouts at 768px
export const tablet = matchMedia('(max-width: 991px)'); // ...and again at 991px

const jobs = new Set();
let queued = false;
function run() { queued = false; for (const job of jobs) job(); }
function queue() { if (!queued) { queued = true; requestAnimationFrame(run); } }
addEventListener('scroll', queue, { passive: true });
addEventListener('resize', queue);

/** Run `job` once now and then once per frame while the page scrolls or resizes. */
export function onScrub(job) { jobs.add(job); job(); return () => jobs.delete(job); }

/** 0 when the section's top is 90% down the screen, 1 when it has passed just above the top. */
export function windowProgress(element) {
  const vh = innerHeight;
  const top = element.getBoundingClientRect().top;
  const start = vh * 0.9;
  const end = -vh * 0.0355;
  return clamp((start - top) / (start - end));
}
