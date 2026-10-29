import { sniffImageType } from './image-type';
import { normalizeReceipt } from './receipts.service';

describe('sniffImageType', () => {
  it('recognises JPEG, PNG and WebP by their first bytes', () => {
    expect(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]))).toBe('image/jpeg');
    expect(
      sniffImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])),
    ).toBe('image/png');
    expect(
      sniffImageType(
        Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]),
      ),
    ).toBe('image/webp');
  });

  it('rejects anything else, including HTML and SVG pretending to be an image', () => {
    expect(sniffImageType(Buffer.from('<html><script>alert(1)</script>'))).toBeNull();
    expect(sniffImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(sniffImageType(Buffer.alloc(0))).toBeNull();
    expect(sniffImageType(Buffer.from([0xff, 0xd8]))).toBeNull();
  });
});

describe('normalizeReceipt', () => {
  const scan = {
    merchant: ' Joe’s Pizza Restaurant ',
    date: '2026-10-01',
    currency: 'usd',
    items: [
      { name: ' Margherita ', amount: 12.5 },
      { name: 'Cola', amount: 3 },
      { name: '', amount: 4 },
      { name: 'Free refill', amount: 0 },
      { name: 'Broken', amount: Number.NaN },
    ],
    tax: 1.24,
    tip: 3,
    total: 19.74,
  };

  it('tidies items, drops unusable lines, and suggests a category', () => {
    const r = normalizeReceipt(scan);
    expect(r.items).toEqual([
      { name: 'Margherita', amount: 12.5 },
      { name: 'Cola', amount: 3 },
    ]);
    expect(r.merchant).toBe('Joe’s Pizza Restaurant');
    expect(r.currency).toBe('USD');
    expect(r.suggestedCategory).toBe('Food & Drink');
    expect(r.mismatch).toBe(false);
  });

  it('flags a scan whose lines do not add up to the total', () => {
    expect(normalizeReceipt({ ...scan, total: 25 }).mismatch).toBe(true);
  });

  it('works out the total when it was not printed, and never goes negative', () => {
    const r = normalizeReceipt({ ...scan, total: null, tax: -5, tip: null });
    expect(r.total).toBe(15.5);
    expect(r.tax).toBe(0);
    expect(r.mismatch).toBe(false);
  });
});
