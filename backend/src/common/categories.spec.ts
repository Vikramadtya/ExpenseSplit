import { isCategory, suggestCategory } from './categories';

describe('categories', () => {
  it.each([
    ['Whole Foods Market', 'Groceries'],
    ['Marriott Hotel', 'Accommodation'],
    ['Uber trip', 'Transport'],
    ['Joe’s Pizza Restaurant', 'Food & Drink'],
    ['CVS Pharmacy', 'Health'],
    ['AMC Cinema', 'Entertainment'],
    ['Broadband bill', 'Utilities'],
    ['IKEA', 'Shopping'],
    ['Mystery Co', 'Other'],
  ])('%s -> %s', (name, expected) => {
    expect(suggestCategory(name)).toBe(expected);
  });

  it('uses item names too, and copes with missing text', () => {
    expect(suggestCategory(null, 'Margherita pizza')).toBe('Food & Drink');
    expect(suggestCategory(undefined, null)).toBe('Other');
  });

  it('prefers the more specific rule: a grocery store is groceries, not shopping', () => {
    expect(suggestCategory('Walmart store')).toBe('Groceries');
  });

  it('matches whole words, so a Cola on a pizza receipt is not a cab ride', () => {
    expect(suggestCategory('Joe’s Pizza Restaurant', 'Margherita', 'Cola')).toBe('Food & Drink');
    expect(suggestCategory('Ola cabs')).toBe('Transport');
    expect(suggestCategory('Restraint & Co')).toBe('Other');
  });

  it('recognises valid categories only', () => {
    expect(isCategory('Health')).toBe(true);
    expect(isCategory('Pets')).toBe(false);
  });
});
