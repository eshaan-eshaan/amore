# Fonts

The site uses two typefaces and serves both from this folder (no Google Fonts requests at runtime).

| Family | Used for | Files | Licence |
| --- | --- | --- | --- |
| Jost (variable, weight 100–900, normal + italic) | all UI text | `jost/jost-latin-*.woff2`, `jost/jost-latin-ext-*.woff2` | SIL Open Font License 1.1, see `jost/OFL.txt` |
| Playfair Display (variable, weight 400–900, normal + italic) | the few serif accents | `playfair-display/playfair-display-latin-*.woff2`, `…-latin-ext-*.woff2` | SIL Open Font License 1.1, see `playfair-display/OFL.txt` |

- Source: Google Fonts (`fonts.googleapis.com/css2`), downloaded once. The files are the unmodified WOFF2 subsets Google serves.
- Subsets kept: `latin` and `latin-ext`. Cyrillic and Vietnamese were left out because the site is English; text in those scripts falls back to the system font stack.
- `css/fonts.css` declares the `@font-face` rules (with `unicode-range`, so the browser only fetches the subsets a page needs) and `css/base.css` keeps the fallback stack (`system-ui, -apple-system, "Segoe UI", sans-serif` for Jost and `Georgia, serif` for Playfair Display).
- The OFL permits bundling and redistributing the fonts with this project as long as the licence text travels with them, which is why each folder carries its `OFL.txt`. The fonts may not be sold on their own.
