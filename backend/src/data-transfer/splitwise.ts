import { Currency, Money } from '../common/money/money';
import { parseCsv } from './csv';

export interface SplitwiseRow {
  /** 1-based line in the file, for error messages. */
  line: number;
  date: string;
  description: string;
  category: string;
  cost: number;
  currency: string;
  /** Each person's net for this row: positive = they are owed, negative = they owe. */
  nets: Record<string, number>;
}

export interface RowError {
  line: number;
  message: string;
}

export interface ParsedSplitwise {
  members: string[];
  rows: SplitwiseRow[];
  errors: RowError[];
}

const number = (text: string) => Number(text.replace(/,/g, '').trim());

/** Reads a Splitwise export: Date, Description, Category, Cost, Currency, then one column per person. */
export function parseSplitwiseCsv(text: string): ParsedSplitwise {
  const table = parseCsv(text);
  const headerAt = table.findIndex((r) => r[0]?.trim().toLowerCase() === 'date' && r.length >= 6);
  if (headerAt === -1)
    throw new Error('This does not look like a Splitwise export (no Date/Description/Cost header)');

  const header = table[headerAt].map((h) => h.trim());
  const members = header.slice(5).filter(Boolean);
  const rows: SplitwiseRow[] = [];
  const errors: RowError[] = [];

  table.slice(headerAt + 1).forEach((cells, i) => {
    const line = headerAt + i + 2;
    const [date, description = '', category = '', cost, currency = ''] = cells.map((c) => c.trim());
    // Splitwise ends with a "Total balance" row, and may leave blank spacer rows.
    if (!date || description.toLowerCase() === 'total balance') return;

    const day = new Date(`${date}T00:00:00Z`);
    const amount = number(cost ?? '');
    if (Number.isNaN(day.getTime()))
      return void errors.push({ line, message: `Unreadable date "${date}"` });
    if (!Number.isFinite(amount) || amount <= 0)
      return void errors.push({ line, message: `Unreadable amount "${cost}"` });
    if (!Currency.isValid(currency))
      return void errors.push({ line, message: `Unreadable currency "${String(currency)}"` });

    const nets: Record<string, number> = {};
    members.forEach((name, col) => {
      const net = number(cells[5 + col] ?? '0');
      if (Number.isFinite(net) && net !== 0) nets[name] = net;
    });
    rows.push({
      line,
      date,
      description,
      category,
      cost: amount,
      currency: currency.toUpperCase(),
      nets,
    });
  });

  return { members, rows, errors };
}

export const isPayment = (row: SplitwiseRow) =>
  row.category.toLowerCase() === 'payment' || row.description.toLowerCase() === 'payment';

export interface ExpenseShape {
  payers: { name: string; amount: number }[];
  owed: { name: string; amount: number }[];
}

/**
 * Splitwise only exports each person's net, not who paid what. When several people are owed
 * money, assume they paid in proportion to what they are owed (exact when one person paid).
 */
export function toExpenseShape(row: SplitwiseRow): ExpenseShape {
  const currency = row.currency;
  const entries = Object.entries(row.nets).map(([name, net]) => ({
    name,
    net: Money.fromMajor(net, currency).minor,
  }));

  if (entries.reduce((sum, e) => sum + e.net, 0) !== 0)
    throw new Error('The balances in this row do not add up to zero');
  const creditors = entries.filter((e) => e.net > 0);
  if (creditors.length === 0) throw new Error('Nobody is owed money in this row');

  // Weights only need to be proportional, so the raw minor-unit nets work for any currency.
  const paid = Money.fromMajor(row.cost, currency).allocate(creditors.map((c) => c.net));
  const paidByName = new Map(creditors.map((c, i) => [c.name, paid[i].minor]));

  const shape: ExpenseShape = { payers: [], owed: [] };
  for (const { name, net } of entries) {
    const paidMinor = paidByName.get(name) ?? 0;
    const owedMinor = paidMinor - net;
    if (owedMinor < 0) throw new Error(`${name}'s balance is larger than the cost`);
    if (paidMinor > 0)
      shape.payers.push({ name, amount: Money.fromMinor(paidMinor, currency).toMajor() });
    if (owedMinor > 0)
      shape.owed.push({ name, amount: Money.fromMinor(owedMinor, currency).toMajor() });
  }
  return shape;
}

/** A payment row: the person who is owed paid the person who owes. */
export function toPaymentShape(row: SplitwiseRow): { payer: string; payee: string } {
  const entries = Object.entries(row.nets);
  const payer = entries.filter(([, net]) => net > 0);
  const payee = entries.filter(([, net]) => net < 0);
  if (payer.length !== 1 || payee.length !== 1)
    throw new Error('A payment must be between exactly two people');
  return { payer: payer[0][0], payee: payee[0][0] };
}
