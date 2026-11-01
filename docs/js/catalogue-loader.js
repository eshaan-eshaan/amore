// The catalogue (about 85 KB of product copy) is only fetched when something needs it: a search, the bag, a shop page.
// The homepage itself never loads it.
let pending = null;
export const loadCatalogue = () => (pending ||= import('./data/catalogue.js'));
