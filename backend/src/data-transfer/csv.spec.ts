import { csvText, formatCsv, parseCsv } from './csv';

describe('csv', () => {
  it('parses quoted fields, escaped quotes, embedded commas/newlines and CRLF', () => {
    const rows = parseCsv('a,"b,c","say ""hi"""\r\n1,"two\nlines",3\r\n');
    expect(rows).toEqual([
      ['a', 'b,c', 'say "hi"'],
      ['1', 'two\nlines', '3'],
    ]);
  });

  it('ignores a BOM, blank lines, and a missing final newline', () => {
    expect(parseCsv('﻿x,y\n\n1,2')).toEqual([
      ['x', 'y'],
      ['1', '2'],
    ]);
  });

  it('round-trips awkward text through format and parse', () => {
    const rows = [
      ['Date', 'Note'],
      ['2026-01-01', 'He said "wow", then left\nlater'],
    ];
    expect(parseCsv(formatCsv(rows))).toEqual(rows);
  });

  it('neutralises spreadsheet formulas in text cells', () => {
    expect(csvText('=HYPERLINK("http://evil","x")')).toBe(`'=HYPERLINK("http://evil","x")`);
    expect(csvText('+1')).toBe("'+1");
    expect(csvText('@cmd')).toBe("'@cmd");
    expect(csvText('-5 off')).toBe("'-5 off");
    expect(csvText('Dinner')).toBe('Dinner');
  });
});
