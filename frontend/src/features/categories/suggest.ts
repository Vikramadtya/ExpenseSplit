/** Words that hint at one of the starter categories; used only when that category still exists. */
const HINTS: Array<[string, RegExp]> = [
  [
    'Groceries',
    /grocer|supermarket|whole foods|trader joe|walmart|costco|aldi|lidl|tesco|bigbasket|dmart/i,
  ],
  ['Accommodation', /\bhotel|hostel|airbnb|resort|\binn\b|lodg|motel/i],
  [
    'Transport',
    /\buber|\blyft|taxi|\bcab\b|\bmetro|\btrains?\b|\bbus\b|flight|airline|\bfuel|petrol|parking|\btoll|\bola\b/i,
  ],
  ['Health', /pharmac|clinic|hospital|doctor|dental|medical|medicine/i],
  ['Entertainment', /cinema|movie|concert|netflix|spotify|museum|bowling|\bgames?\b|tickets?/i],
  [
    'Utilities',
    /electric|water bill|internet|broadband|wifi|utilit|\brent\b|mobile bill|gas bill/i,
  ],
  [
    'Food & Drink',
    /restaurant|caf[eé]|coffee|lunch|dinner|breakfast|brunch|pizza|burger|\bbar\b|\bpub\b|drinks?|sushi|bakery|starbucks|snacks?|biryani|thali/i,
  ],
  ['Shopping', /\bstore\b|\bshop|amazon|\bmall\b|clothes|fashion|ikea|gift/i],
];

/** A category name the description points to, if the workspace has it; undefined otherwise. */
export function suggestCategoryName(description: string, existing: string[]): string | undefined {
  const text = description.trim();
  if (text.length < 3) return undefined;
  const [name] = HINTS.find(([n, re]) => re.test(text) && existing.includes(n)) ?? [];
  return name;
}
