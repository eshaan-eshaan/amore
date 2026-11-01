// the fan of posters and the footer accordions
import { $, $$, phone, tablet } from './util.js';
import { fanPose } from './fan-pose.js';

/* ── fan: stacked at first, springs open when the section arrives, hover pulls one tile forward ── */
export function initFan() {
  const section = $('[data-fan-section]');
  const fan = $('[data-fan]');
  if (!fan) return;
  const tiles = $$('.fan-tile', fan);
  const middle = (tiles.length - 1) / 2;
  const front = Math.floor(middle);
  let open = false;
  let hover = -1;

  const apply = () => {
    const k = phone.matches ? 0.4 : tablet.matches ? 0.7 : 1; // the fan is narrower on smaller screens
    tiles.forEach((tile, i) => {
      const pose = fanPose(i - middle);
      let tx = open ? pose.tx * k : 0;
      let ty = open ? pose.ty * k : 0;
      let sc = open ? pose.sc : 1;
      const rot = open ? pose.rot : 0;
      if (open && hover >= 0) {
        const d = i - hover;
        if (d === 0) { ty = Math.max(0, ty - 32 * k); sc = Math.min(1, sc + 0.14); }
        else tx += Math.sign(d) * 70 * k * Math.max(0, 1.1 - (Math.abs(d) - 1) * 0.25);
      }
      tile.style.setProperty('--tx', `${tx.toFixed(1)}px`);
      tile.style.setProperty('--ty', `${ty.toFixed(1)}px`);
      tile.style.setProperty('--rot', `${rot}deg`);
      tile.style.setProperty('--sc', sc.toFixed(4));
      tile.style.setProperty('--z', String(Math.round(20 - Math.abs(i - middle) * 2)));
      tile.classList.toggle('is-front', i === (hover >= 0 ? hover : front));
    });
  };

  new IntersectionObserver((entries, io) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    open = true;
    apply();
    io.disconnect();
  }, { threshold: 0.35 }).observe(section);

  tiles.forEach((tile, i) => tile.addEventListener('pointerenter', (event) => { if (event.pointerType === 'mouse') { hover = i; apply(); } }));
  fan.addEventListener('pointerleave', () => { hover = -1; apply(); });
  addEventListener('resize', apply);
  apply();
}

/* ── footer: link groups become accordions on phones (always open on larger screens) ── */
export function initFooter() {
  $$('.footer-accordion-header').forEach((button) => {
    button.addEventListener('click', () => {
      if (!phone.matches) return;
      const item = button.closest('.footer-accordion-item');
      button.setAttribute('aria-expanded', String(item.classList.toggle('active')));
    });
  });
}
