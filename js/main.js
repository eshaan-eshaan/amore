// entry point for the homepage: the page is plain HTML and CSS; these modules only add behaviour
import { initAnnouncement, initHeader, initDrawers, initMenuTiles } from './chrome.js';
import { initCart } from './cart-ui.js';
import { initHero, initChase, initBands, initReveal } from './motion.js';
import { initFan, initFooter } from './sections.js';
import { initLineup, initParade, initSmoke } from './lineup.js';
import { initCursor, initIntro, initSplit } from './polish.js';

// styles that hide something until script reveals it only apply once this class is set
document.documentElement.classList.add('js-ready');

initIntro();
initAnnouncement();
initHeader();
initDrawers();
initCart();
initMenuTiles();
initHero();
initChase();
initBands();
initReveal();
initLineup();
initParade();
initSmoke();
initFan();
initFooter();
initSplit();
initCursor();
