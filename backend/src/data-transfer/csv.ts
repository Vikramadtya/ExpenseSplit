/** Parses CSV text (RFC 4180: quoted fields, "" escapes, CRLF or LF, optional BOM). */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

/**
 * Makes text safe to open in a spreadsheet: a cell starting with = + - @ (or a control char)
 * would otherwise run as a formula, so it is prefixed with an apostrophe.
 */
export const csvText = (value: string): string =>
  /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;

const escapeCell = (cell: string | number): string => {
  const text = String(cell);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const formatCsv = (rows: Array<Array<string | number>>): string =>
  rows.map((r) => r.map(escapeCell).join(',')).join('\r\n') + '\r\n';
