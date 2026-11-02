// entry point for shop.html: the same header, drawers and footer as the homepage, then the page content
import { initAnnouncement, initHeader, initDrawers, initMenuTiles } from './chrome.js';
import { initCart } from './cart-ui.js';
import { initFooter } from './sections.js';
import { initCursor } from './polish.js';
import { initSpotlight } from './spotlight.js';
import { renderShop } from './shop.js';

document.documentElement.classList.add('js-ready');

initAnnouncement();
initHeader();
initDrawers();
initCart();
initMenuTiles();
initFooter();
renderShop();
initCursor();
initSpotlight();
