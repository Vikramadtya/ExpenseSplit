export const CATEGORIES = [
  'Food & Drink',
  'Transport',
  'Accommodation',
  'Entertainment',
  'Groceries',
  'Utilities',
  'Health',
  'Shopping',
  'Other',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const isCategory = (value: string): value is Category =>
  (CATEGORIES as readonly string[]).includes(value);

// Order matters: the first matching rule wins, so specific places come before general ones.
const RULES: Array<[Category, RegExp]> = [
  [
    'Groceries',
    /grocer|supermarket|whole foods|trader joe|walmart|costco|aldi|lidl|tesco|kroger|safeway|bigbasket|dmart/i,
  ],
  ['Accommodation', /\bhotel|hostel|airbnb|resort|\binn\b|lodg|motel/i],
  [
    'Transport',
    /\buber|\blyft|taxi|\bcab\b|\bmetro|\btrains?\b|\bbus\b|airline|airways|flight|\bfuel|petrol|gas station|parking|\btoll|\bola\b/i,
  ],
  ['Health', /pharmac|drug ?store|clinic|hospital|doctor|dental|medical|\bcvs\b|walgreens/i],
  ['Entertainment', /cinema|movie|theat|concert|netflix|spotify|museum|bowling|arcade|\bgame/i],
  [
    'Utilities',
    /electric|\bwater bill|internet|broadband|wifi|utility|utilities|\brent\b|mobile bill/i,
  ],
  [
    'Food & Drink',
    /restaurant|caf[eé]|coffee|pizza|burger|\bbar\b|\bpub\b|diner|bistro|grill|sushi|bakery|starbucks|mcdonald|kitchen|taco|noodle|biryani|thali/i,
  ],
  ['Shopping', /\bstore\b|\bshop\b|amazon|\bmall\b|clothes|fashion|ikea|boutique/i],
];

/** A best guess from merchant and item names; 'Other' when nothing matches. */
export function suggestCategory(...texts: Array<string | null | undefined>): Category {
  const haystack = texts.filter(Boolean).join(' ');
  return RULES.find(([, pattern]) => pattern.test(haystack))?.[0] ?? 'Other';
}
