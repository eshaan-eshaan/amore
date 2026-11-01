// AMORE product data.
// Names, key notes, slogans, descriptions and character words are copied from the brand's own document
// (AMORE_Perfume_Collection_Descriptions.pdf). The posters are the brand's AMORE_10_separate_perfume_posters.zip.
// The price (Rs. 999 for every fragrance) was given by the brand owner in chat.
// The bottle cut-outs (assets/bottles) are the brand's own transparent images, cropped to one shared frame.
// accent: each bottle's main colour, sampled from the artwork and adjusted by eye; it only tints the "Meet the ten" stage.
// The brief has no bottle sizes, so none are shown. Nothing here is invented.

export const BRAND = {
  name: 'AMORE',
  tagline: 'Passion in every drop',
  collection: {
    handle: 'the-fragrance-collection',
    label: 'The Fragrance Collection',
    subtitle: 'Ten distinct scent identities',
    heading: 'A curated collection of fragrance concepts, each with its own character, atmosphere and signature notes.',
  },
  type: 'Eau de Parfum', // printed on every poster
  currency: 'INR',
};

const price = { amount: 999, currency: 'INR' };

export const PRODUCTS = [
  {
    number: 1, handle: 'royal-oud', name: 'ROYAL OUD', slogan: 'A Legacy in Scent',
    keyNotes: ['Oud', 'Saffron', 'Leather'], character: ['Regal', 'Deep', 'Refined'],
    description: 'A commanding and opulent fragrance concept built around the dark richness of oud. Saffron brings a warm, subtly spiced glow, while leather adds depth and a smooth, confident finish. Royal Oud is imagined for evenings, formal occasions and moments when understated power makes the strongest impression.',
    poster: { file: '01_Royal_Oud.png', width: 261, height: 587 }, bottle: { file: 'bottles/01_Royal_Oud.webp', width: 600, height: 1103 }, accent: '#7b2d9b', price,
  },
  {
    number: 2, handle: 'bleu-imperial', name: 'BLEU IMPÉRIAL', slogan: 'Freshness with Power',
    keyNotes: ['Bergamot', 'Marine Notes', 'Amber'], character: ['Fresh', 'Aquatic', 'Confident'],
    description: 'Crisp bergamot opens with a bright, invigorating freshness, followed by a cool marine character that evokes open water and clear skies. Amber lends a warm base that gives the composition presence and staying appeal. Bleu Impérial is envisioned as a polished, versatile scent for daytime wear and smart occasions.',
    poster: { file: '02_Bleu_Imperial.png', width: 261, height: 587 }, bottle: { file: 'bottles/02_Bleu_Imperial.webp', width: 600, height: 1103 }, accent: '#1c58a8', price,
  },
  {
    number: 3, handle: 'velvet-rose', name: 'VELVET ROSE', slogan: 'Romance Reimagined',
    keyNotes: ['Rose', 'Raspberry', 'Musk'], character: ['Floral', 'Luscious', 'Elegant'],
    description: 'Velvet Rose pairs the timeless elegance of rose with the juicy brightness of raspberry. A soft musk accord rounds the fragrance, creating a smooth, intimate impression that feels romantic without becoming overly sweet. It is imagined for dinners, celebrations and any occasion that calls for graceful sophistication.',
    poster: { file: '03_Velvet_Rose.png', width: 256, height: 587 }, bottle: { file: 'bottles/03_Velvet_Rose.webp', width: 600, height: 1103 }, accent: '#a8283f', price,
  },
  {
    number: 4, handle: 'ember-woods', name: 'EMBER WOODS', slogan: 'The Warmth of the Wild',
    keyNotes: ['Smoke', 'Amber', 'Cedar'], character: ['Smoky', 'Woody', 'Warm'],
    description: 'Inspired by glowing embers and dark timber, Ember Woods blends a smoky atmosphere with the golden warmth of amber and the dry character of cedar. The result is a bold, atmospheric fragrance concept with a rugged edge and a luxurious finish. Best suited to cool evenings and statement-making moments.',
    poster: { file: '04_Ember_Woods.png', width: 259, height: 587 }, bottle: { file: 'bottles/04_Ember_Woods.webp', width: 600, height: 1103 }, accent: '#c2641a', price,
  },
  {
    number: 5, handle: 'citrus-noir', name: 'CITRUS NOIR', slogan: 'A Modern Classic',
    keyNotes: ['Lemon', 'Neroli', 'Vetiver'], character: ['Citrusy', 'Green', 'Sophisticated'],
    description: 'Luminous lemon and elegant neroli create a sparkling, clean opening. Vetiver anchors the brightness with an earthy, gently dry finish, giving Citrus Noir its balance of freshness and sophistication. This concept is designed for those who enjoy a crisp signature scent that moves effortlessly from workdays to weekends.',
    poster: { file: '05_Citrus_Noir.png', width: 263, height: 587 }, bottle: { file: 'bottles/05_Citrus_Noir.webp', width: 600, height: 1103 }, accent: '#a58a1c', price,
  },
  {
    number: 6, handle: 'spiced-elixir', name: 'SPICED ELIXIR', slogan: 'Bold & Sensual',
    keyNotes: ['Cinnamon', 'Cardamom', 'Amber'], character: ['Spicy', 'Amber', 'Seductive'],
    description: 'Spiced Elixir opens with the inviting warmth of cinnamon and the aromatic lift of cardamom. Amber deepens the blend with a smooth, resinous richness that feels enveloping and sensual. Its character is made for cooler weather, evening plans and anyone drawn to warm fragrances with a memorable trail.',
    poster: { file: '06_Spiced_Elixir.png', width: 261, height: 609 }, bottle: { file: 'bottles/06_Spiced_Elixir.webp', width: 600, height: 1103 }, accent: '#a8541c', price,
  },
  {
    number: 7, handle: 'arctic-mineral', name: 'ARCTIC MINERAL', slogan: 'The Chill of Elegance',
    keyNotes: ['Mint', 'Aquatic Notes', 'Musk'], character: ['Cool', 'Clean', 'Refreshing'],
    description: 'Cool mint gives Arctic Mineral an immediate sense of clarity, while aquatic notes suggest fresh air and glacial water. A clean musk base softens the composition and keeps it smooth against the skin. The concept is light, modern and refreshing—an easy choice for daytime wear and warm-weather settings.',
    poster: { file: '07_Arctic_Mineral.png', width: 261, height: 609 }, bottle: { file: 'bottles/07_Arctic_Mineral.webp', width: 600, height: 1103 }, accent: '#6a8cab', price,
  },
  {
    number: 8, handle: 'tobacco-oud', name: 'TOBACCO OUD', slogan: 'Deep, Rich, Enduring',
    keyNotes: ['Tobacco', 'Oud', 'Vanilla'], character: ['Dark', 'Rich', 'Smooth'],
    description: 'Tobacco OUD explores the contrast between dark, aromatic tobacco and the resinous depth of oud. Vanilla introduces a mellow sweetness that rounds the edges and adds a velvety finish. Rich and contemplative, this fragrance concept is intended for intimate evenings and those who prefer a darker, more luxurious scent profile.',
    poster: { file: '08_Tobacco_Oud.png', width: 256, height: 609 }, bottle: { file: 'bottles/08_Tobacco_Oud.webp', width: 600, height: 1103 }, accent: '#8f5932', price,
  },
  {
    number: 9, handle: 'silver-vetiver', name: 'SILVER VETIVER', slogan: 'Pure Sophistication',
    keyNotes: ['Vetiver', 'Lavender', 'Tonka'], character: ['Aromatic', 'Earthy', 'Polished'],
    description: 'Earthy vetiver gives Silver Vetiver its crisp, tailored foundation. Lavender adds an aromatic freshness, while tonka brings a gentle warmth that makes the finish feel polished rather than heavy. The result is imagined as a composed, versatile fragrance for everyday refinement, professional settings and understated elegance.',
    poster: { file: '09_Silver_Vetiver.png', width: 259, height: 609 }, bottle: { file: 'bottles/09_Silver_Vetiver.webp', width: 600, height: 1103 }, accent: '#8a8d91', price,
  },
  {
    number: 10, handle: 'infinite-noir', name: 'INFINITE NOIR', slogan: 'Intensity Without Limits',
    keyNotes: ['Black Pepper', 'Patchouli', 'Amber'], character: ['Spicy', 'Earthy', 'Intense'],
    description: 'A striking opening of black pepper sets a bold tone, leading into the earthy depth of patchouli. Amber adds a warm, lingering richness that gives Infinite Noir its dark and magnetic character. Designed as the collection’s most intense concept, it is envisioned for nights out and occasions where a distinctive presence is part of the style.',
    poster: { file: '10_Infinite_Noir.png', width: 263, height: 609 }, bottle: { file: 'bottles/10_Infinite_Noir.webp', width: 600, height: 1103 }, accent: '#a37853', price,
  },
];
