# AMORE: The Fragrance Collection

A storefront for AMORE's ten fragrances: a homepage, ten product pages, the collection page, search, a shopping bag and a demo checkout. It is plain HTML, CSS and ES modules with no build step, no dependencies and no third-party requests (the fonts are self-hosted).

*Passion in every drop.*

## Run it

```bash
npm run dev      # http://localhost:5174   (PORT=8080 npm run dev for another port)
npm run verify   # end-to-end checks in headless Chrome or Edge (start `npm run dev` first)
```

Node 18 or newer is the only requirement. To run the checks in Microsoft Edge: `set CHROME_PATH=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` and run `npm run verify` again.

## Publishing (GitHub Pages)

The live copy is served from the `docs/` folder of this repository: https://eshaan-eshaan.github.io/amore/

GitHub Pages is a plain file host. It cannot rewrite `/products/royal-oud` to `shop.html` the way the dev server does, and a project site lives in a sub-folder. So `npm run build:pages` writes `docs/`: the same site with every address prefixed by `/amore/`, one real page per route (`docs/products/royal-oud/index.html` and so on) and a `404.html` that shows the shop's own "not found" page. The sources are not changed, and `npm run dev` still serves the site at the root.

To update the live site after any change: run `npm run build:shop` (if you touched the shared header, menu or footer), then `npm run build:pages`, then commit and push. Pages republishes in a minute or two. `npm run verify` builds the Pages version into a temporary folder, serves it from `/amore/` the way GitHub does and checks it in Chrome.

The live pages carry `noindex, nofollow` (search engines are asked to skip them) because this is still a preview. Remove that tag in `index.html` and `tools/build-shop.mjs` when you launch, then rebuild.

## What is here

| URL | What it is |
| --- | --- |
| `/` | Homepage: pinned poster hero, the statement, the ten fragrances, two side posters, the fan of ten posters, footer |
| `/products/<handle>` | One fragrance: poster, name, slogan, key notes, price, quantity, Add to bag, description, key notes and character, three more to try |
| `/collections/the-fragrance-collection` | All ten, with the brand's own intro text |
| `/search?q=...` | Search (also in the header: type, Enter opens the best match, arrow keys walk the results) |
| `/checkout` | **Demo only.** Shows what the bag adds up to; takes no payment and creates no order |
| `/pages/about`, `/pages/contact` | Placeholders: their text has not been written yet |

The ten handles are `royal-oud`, `bleu-imperial`, `velvet-rose`, `ember-woods`, `citrus-noir`, `spiced-elixir`, `arctic-mineral`, `tobacco-oud`, `silver-vetiver`, `infinite-noir`.

The bag is saved in the browser (`localStorage`, key `amore-bag-v1`; handles and quantities only, prices are read from the catalogue), holds up to 10 of each fragrance, and the header shows the count. Prices are in Indian rupees: ₹999 for every fragrance.

`tools/dev-server.mjs` rewrites those paths to `shop.html`, so a refresh or a pasted link always works. A static host without rewrite rules (GitHub Pages, say) cannot serve them; this server can.

## Where the content comes from

| What | Source |
| --- | --- |
| Names, key notes, slogans, descriptions, character words, collection title and intro, the tagline | `AMORE_Perfume_Collection_Descriptions.pdf` (copied word for word) |
| The ten posters | `AMORE_10_separate_perfume_posters.zip`, used as supplied in `assets/` |
| Price (₹999 each) | The owner, in chat |
| "Eau de Parfum" | Printed on every poster |

Nothing else is invented: **no bottle sizes** (the brief has none), no ratings or reviews, no stock levels, no delivery or returns promises.

## Motion and detail

- **"Meet the ten"** is a slow parade of the bottle cut-outs. The stage takes the colour of the bottle in the middle of the screen, or of the one under the mouse (each fragrance's `accent` in `js/data/products.js`, sampled from its bottle and adjusted by eye). A bottle tilts towards the mouse. The parade starts moving only once it is on screen, pauses on hover, and sits still, scrollable by hand, with reduced motion.
- **Moving headline**: one band ("Passion in every drop", gold on dark, between the parade and the collection) slides sideways as the page scrolls past it. It is decorative and hidden from screen readers. (A second band of key notes was tried and removed at the owner's request.)
- **Fine detail**: headlines rise word by word (`data-split` in `index.html`), a thin gold ring follows the mouse on desktop (never on touch screens), faint film grain on the dark sections, hairlines beside the small headings.
- **Logo intro** (the monogram fades in over a dark screen for about two seconds): **on**. It plays once per visit (the tab remembers it, so going back to the homepage does not replay it), never with reduced motion, and a click or key press skips it. `/?intro` always plays it and `/?nointro` never does (the tests use that). A small inline script and style in the head of `index.html` put a dark cover over the page from the first paint so it never flashes before the intro starts. To switch the intro off for everyone set `INTRO_ENABLED` to `false` in `js/polish.js`.
- Left out on purpose: smooth-scroll libraries (they fight the scroll-driven animations and reduce accessibility) and a page-to-page cross-fade (the browser feature for it threw console errors when pages changed quickly).
- Everything above is switched off or simplified with `prefers-reduced-motion`.

## Still to supply

1. **A cleaner logo file, ideally a vector.** The logo is the brand's chosen "Glow" design (dark bronze monogram with orbit and star, the AMORE wordmark and "FINE FRAGRANCES"), cut out of the picture the brand supplied (the three candidates are kept in `amore-assets/logo-options`). It is in `assets/logo/` as transparent PNGs (bronze for light backgrounds, champagne for dark ones, wordmark and lockup, plus `favicon.png`). The **registered-trademark mark (®) was left out on purpose**; add it back only once the brand is registered. If an SVG or a high-resolution PNG of the logo is ever supplied, replace those files (same names) and run `npm run build:shop`.
2. **Larger posters and cleaner bottle cut-outs.** The posters are only about 260 × 590 px, so they look soft on large screens (the hero and the product page enlarge them about 1.4 times). Drop larger versions into `assets/` with the same file names and nothing else needs to change; keep the same proportions. The bottle cut-outs in `assets/bottles/` (used by the "Meet the ten" parade) still carry a few leftover background halos at the caps and shoulders, which hide on the dark stage; cleaner files with the same names can be dropped in.
3. **Bottle sizes, if wanted.** Add a `size` to a product in `js/data/products.js` and show it in `js/shop.js`.
4. **About, Contact, shipping, returns and legal text.** The About and Contact pages are placeholders.
5. **Social links.** None were supplied, so the footer has none.
6. **Before going live:** remove `<meta name="robots" content="noindex, nofollow">` from `index.html` and `tools/build-shop.mjs` (it is there so a development copy is not indexed), put the site on a host with rewrite rules, and connect a real checkout and payment provider. The bag here is a demonstration.

## Folder layout

```
amore-site/
  index.html          the homepage: announcement bar, header, menu, search and bag drawers, every section, footer
  shop.html           GENERATED from index.html by tools/build-shop.mjs (same header, drawers and footer; the page area is filled by js/shop.js)
  assets/             the ten posters, bottles/ (ten transparent cut-outs) and logo/ (wordmark, lockup, tab icon)
  fonts/              Jost and Playfair Display (WOFF2) with their SIL OFL licence texts
  css/
    fonts.css         @font-face rules
    base.css          colours (--gold, --wine, --paper, --night ...), reset, type
    chrome.css        announcement bar, header, menu, search and bag drawers
    brand.css         AMORE's colours laid over chrome.css
    home.css          hero, statement, collection grid, side posters, fan
    footer.css        the footer revealed behind the page
    shop.css          product, collection, search, checkout and placeholder pages
  js/
    main.js           homepage entry              shop-main.js    shop pages entry
    chrome.js         announcement bar, header, drawers, search
    cart.js           bag logic and persistence   cart-ui.js      the bag drawer
    motion.js         hero reveal, side posters, the moving band, card reveal
    lineup.js         the "Meet the ten" colour and tilt   polish.js    word reveal, gold ring, optional intro
    sections.js       the fan, footer accordions  fan-pose.js     the fan's geometry
    shop.js           renders product, collection, search, checkout and placeholder pages
    icons.js          inline SVG icons            util.js         small helpers
    data/products.js  the ten fragrances (edit here)
    data/catalogue.js posters, collection, URLs, price and search helpers
  tools/
    dev-server.mjs    zero-dependency server with route rewrites and real 404s
    build-shop.mjs    regenerates shop.html (`--check` fails if it is stale)
    verify.mjs        end-to-end tests
```

## Changing things

| To change | Edit |
| --- | --- |
| A fragrance's text, notes, price | `js/data/products.js` |
| The tagline, collection title, intro | `BRAND` at the top of `js/data/products.js` |
| Colours | `:root` in `css/base.css` |
| Announcement messages | the two `.announcement-slide` blocks in `index.html` (then `npm run build:shop`) |
| Menu and footer links | `index.html` (then `npm run build:shop`) |
| Bag limit per fragrance | `MAX_QTY` in `js/cart.js` |
| Currency | `currency` in `BRAND` and each product's `price`; `formatMoney` in `js/data/catalogue.js` |

After editing the shared header, menu, drawers or footer in `index.html`, run `npm run build:shop` so `shop.html` matches. `npm run verify` fails if it is out of date.

## Accessibility and motion

Every drawer is a real dialog-style panel: while one is open the page behind it is `inert`, Tab stays inside it, and Escape closes it (menu, search or bag). Buttons have names, the bag announces changes through a live region, and focus returns to the control that opened a drawer. `prefers-reduced-motion` turns off the marquee, the poster strip, the side-poster slide, card fades and the fan's spring.
