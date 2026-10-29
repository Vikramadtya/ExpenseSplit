import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { IWorkspacesRepositoryToken } from '../common/interfaces/repository.interfaces';
import type { IWorkspacesRepository } from '../common/interfaces/repository.interfaces';
import { suggestCategory } from '../common/categories';
import { Money } from '../common/money/money';
import { CreateExpenseDto } from '../expenses/dto/create-expense.dto';
import { ExpensesService } from '../expenses/expenses.service';
import { SettlementsService } from '../settlements/settlements.service';
import { UsersService } from '../users/users.service';
import { csvText, formatCsv } from './csv';
import { DataTransferRepository, expenseKey, paymentKey } from './data-transfer.repository';
import {
  RowError,
  isPayment,
  parseSplitwiseCsv,
  toExpenseShape,
  toPaymentShape,
} from './splitwise';

const MAX_IMPORT_ROWS = 2000;
const day = (d: Date) => d.toISOString().split('T')[0];

export interface ImportOptions {
  /** CSV column name -> workspace member id, for names that don't match a member automatically. */
  mapping?: Record<string, string>;
  dryRun?: boolean;
}

@Injectable()
export class DataTransferService {
  constructor(
    private readonly repository: DataTransferRepository,
    private readonly expenses: ExpensesService,
    private readonly settlements: SettlementsService,
    private readonly users: UsersService,
    @Inject(IWorkspacesRepositoryToken) private readonly workspaces: IWorkspacesRepository,
  ) {}

  /** Splitwise-style CSV, so an export can be imported into Splitwise-compatible tools and back. */
  async exportCsv(workspaceId: string, from?: Date, to?: Date): Promise<string> {
    const { expenses, settlements } = await this.repository.exportRows(workspaceId, from, to);
    const members: { id: string }[] = await this.workspaces.getMembers(workspaceId);

    // Members first, then anyone who left but still appears in the history.
    const ids = [
      ...new Set([
        ...members.map((m) => m.id),
        ...expenses.flatMap((e) => e.splits.map((s) => s.userId)),
        ...settlements.flatMap((s) => [s.payerId, s.payeeId]),
      ]),
    ];
    const people = new Map(
      (await this.users.findByIds(ids)).map((u) => [u.id as string, u.name as string]),
    );
    // Stable column order regardless of how the database returns members.
    ids.sort((a, b) =>
      (people.get(a) ?? '').localeCompare(people.get(b) ?? '', undefined, { sensitivity: 'base' }),
    );
    const seen = new Map<string, number>();
    const columns = ids.map((id) => {
      const name = people.get(id) ?? 'Unknown';
      const n = (seen.get(name) ?? 0) + 1;
      seen.set(name, n);
      return n === 1 ? name : `${name} (${n})`;
    });

    const money = (v: string, currency: string) => Money.fromMajor(v, currency);
    type Line = { at: number; cells: Array<string | number> };
    const lines: Line[] = [
      ...expenses.map((e): Line => ({
        at: e.date.getTime(),
        cells: [
          day(e.date),
          csvText(e.description),
          csvText(e.category),
          Number(e.amount),
          e.currency,
          ...ids.map((id) => {
            const split = e.splits.find((s) => s.userId === id);
            return split
              ? money(split.amountPaid, e.currency)
                  .subtract(money(split.amountOwed, e.currency))
                  .toMajor()
              : 0;
          }),
        ],
      })),
      ...settlements.map((s): Line => ({
        at: s.date.getTime(),
        cells: [
          day(s.date),
          'Payment',
          'Payment',
          Number(s.amount),
          s.currency,
          ...ids.map((id) =>
            id === s.payerId ? Number(s.amount) : id === s.payeeId ? -Number(s.amount) : 0,
          ),
        ],
      })),
    ].sort((a, b) => a.at - b.at);

    return formatCsv([
      ['Date', 'Description', 'Category', 'Cost', 'Currency', ...columns.map(csvText)],
      ...lines.map((l) => l.cells),
    ]);
  }

  async importSplitwise(
    workspaceId: string,
    actorId: string,
    text: string,
    options: ImportOptions = {},
  ) {
    let parsed;
    try {
      parsed = parseSplitwiseCsv(text);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Could not read the file');
    }
    if (parsed.rows.length > MAX_IMPORT_ROWS) {
      throw new BadRequestException(
        `Too many rows (${parsed.rows.length}); import at most ${MAX_IMPORT_ROWS} at a time`,
      );
    }

    const memberIds = await this.matchMembers(
      workspaceId,
      parsed.members,
      parsed.rows,
      options.mapping ?? {},
    );
    const existing = await this.repository.existingKeys(workspaceId);
    const errors: RowError[] = [...parsed.errors];
    const result = {
      expenses: 0,
      payments: 0,
      skippedDuplicates: 0,
      errors,
      dryRun: Boolean(options.dryRun),
    };

    for (const row of parsed.rows) {
      try {
        const id = (name: string) => memberIds.get(name) as string;
        if (isPayment(row)) {
          const { payer, payee } = toPaymentShape(row);
          const key = paymentKey(row.date, id(payer), id(payee), row.cost, row.currency);
          if (existing.has(key)) {
            result.skippedDuplicates++;
            continue;
          }
          if (!options.dryRun) {
            await this.settlements.recordSettlement(workspaceId, {
              payerId: id(payer),
              payeeId: id(payee),
              amount: row.cost,
              currency: row.currency,
              date: `${row.date}T12:00:00.000Z`,
            });
          }
          existing.add(key);
          result.payments++;
        } else {
          const shape = toExpenseShape(row);
          const key = expenseKey(row.date, row.description, row.cost, row.currency);
          if (existing.has(key)) {
            result.skippedDuplicates++;
            continue;
          }
          if (!options.dryRun) {
            await this.expenses.create(workspaceId, actorId, {
              description: row.description.slice(0, 255),
              amount: row.cost,
              currency: row.currency,
              category: suggestCategory(row.category, row.description),
              date: `${row.date}T12:00:00.000Z`,
              splitType: 'EXACT',
              type: 'EXPENSE',
              recurringInterval: 'NONE',
              payers: shape.payers.map((p) => ({ userId: id(p.name), amount: p.amount })),
              exactAmounts: shape.owed.map((o) => ({ userId: id(o.name), amount: o.amount })),
            });
          }
          existing.add(key);
          result.expenses++;
        }
      } catch (err) {
        errors.push({
          line: row.line,
          message: err instanceof Error ? err.message : 'Could not import this row',
        });
      }
    }
    return result;
  }

  /** Maps each CSV column that has activity to a workspace member; reports the ones it cannot. */
  private async matchMembers(
    workspaceId: string,
    csvNames: string[],
    rows: { nets: Record<string, number> }[],
    mapping: Record<string, string>,
  ): Promise<Map<string, string>> {
    const members: { id: string; name: string; email: string }[] =
      await this.workspaces.getMembers(workspaceId);
    const byLabel = new Map(
      members.flatMap(
        (m) =>
          [
            [m.name.toLowerCase(), m.id],
            [m.email.toLowerCase(), m.id],
          ] as const,
      ),
    );
    const memberIds = new Set(members.map((m) => m.id));
    const active = new Set(rows.flatMap((r) => Object.keys(r.nets)));

    const matched = new Map<string, string>();
    const unmatched: string[] = [];
    for (const name of csvNames.filter((n) => active.has(n))) {
      const id = mapping[name] ?? byLabel.get(name.toLowerCase());
      if (id && memberIds.has(id)) matched.set(name, id);
      else unmatched.push(name);
    }
    if (unmatched.length > 0) {
      throw new BadRequestException({
        message: `Match these names to workspace members: ${unmatched.join(', ')}`,
        unmatched,
        members: members.map((m) => ({ id: m.id, name: m.name })),
      });
    }
    return matched;
  }
}
