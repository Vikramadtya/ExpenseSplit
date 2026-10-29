import { Injectable, Inject } from '@nestjs/common';
import { IBalancesRepositoryToken } from '../common/interfaces/repository.interfaces';
import type { IBalancesRepository, NetBalance } from '../common/interfaces/repository.interfaces';
import { UsersService } from '../users/users.service';
import { DebtSimplificationAlgorithm, MinorDebt } from './algorithms/debt-simplification.algorithm';
import { pairwiseDebts } from './algorithms/pairwise-debts';
import { FxService } from '../fx/fx.service';

const toMajorDebt = (d: MinorDebt, currency: string) => ({
  debtor: d.debtor,
  creditor: d.creditor,
  amount: d.minor / 100,
  currency,
});

const groupBy = <T>(items: T[], key: (item: T) => string) => {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  return groups;
};

@Injectable()
export class BalancesService {
  private readonly algorithm = new DebtSimplificationAlgorithm();

  constructor(
    @Inject(IBalancesRepositoryToken)
    private readonly repository: IBalancesRepository,
    private readonly usersService: UsersService,
    private readonly fx: FxService,
  ) {}

  /** Balances of one workspace, or (with an empty id) of everything the user belongs to. */
  async getBalances(workspaceId: string, userId?: string, convertTo?: string) {
    const nets: NetBalance[] = workspaceId
      ? await this.repository.getNetBalances(workspaceId)
      : userId
        ? await this.repository.getNetBalancesForMember(userId)
        : [];

    const byCurrency = [...groupBy(nets, (n) => n.currency)].map(([currency, rows]) => {
      const mine = userId
        ? rows.filter((r) => r.userId === userId).reduce((sum, r) => sum + r.net.minor, 0)
        : 0;
      const owed = rows.filter((r) => r.net.minor > 0).reduce((sum, r) => sum + r.net.minor, 0);
      return {
        currency,
        total: owed / 100,
        owedToYou: Math.max(mine, 0) / 100,
        youOwe: Math.max(-mine, 0) / 100,
        perMember: workspaceId ? rows.map((r) => ({ userId: r.userId, net: r.net.toMajor() })) : [],
      };
    });
    return {
      byCurrency,
      converted: convertTo ? await this.convert(byCurrency, convertTo) : undefined,
    };
  }

  /** Sums every currency into one, at the latest exchange rate. */
  private async convert(
    rows: { currency: string; owedToYou: number; youOwe: number }[],
    to: string,
  ) {
    const target = to.toUpperCase();
    let owedToYou = 0;
    let youOwe = 0;
    for (const row of rows) {
      owedToYou += await this.fx.convertMinor(
        Math.round(row.owedToYou * 100),
        row.currency,
        target,
      );
      youOwe += await this.fx.convertMinor(Math.round(row.youOwe * 100), row.currency, target);
    }
    return { currency: target, owedToYou: owedToYou / 100, youOwe: youOwe / 100 };
  }

  /**
   * The un-simplified view reads every split in the workspace, which is the one expensive query
   * here. Results are kept per workspace and reused until the ledger fingerprint changes (read
   * from the database each time, so it stays correct with several server instances).
   */
  private readonly pairwiseCache = new Map<
    string,
    { fingerprint: string; debts: ReturnType<typeof toMajorDebt>[] }
  >();
  private static readonly PAIRWISE_CACHE_SIZE = 200;

  private async cachedPairwise(
    workspaceId: string,
    compute: () => Promise<ReturnType<typeof toMajorDebt>[]>,
  ) {
    const fingerprint = await this.repository.ledgerFingerprint(workspaceId);
    const hit = this.pairwiseCache.get(workspaceId);
    if (hit?.fingerprint === fingerprint) return hit.debts;

    const debts = await compute();
    this.pairwiseCache.delete(workspaceId);
    this.pairwiseCache.set(workspaceId, { fingerprint, debts });
    if (this.pairwiseCache.size > BalancesService.PAIRWISE_CACHE_SIZE) {
      this.pairwiseCache.delete(this.pairwiseCache.keys().next().value as string); // oldest first
    }
    return debts;
  }

  async getDebts(workspaceId: string, simplified = true) {
    if (!simplified) {
      return this.cachedPairwise(workspaceId, () => this.computeDebts(workspaceId, false));
    }
    return this.computeDebts(workspaceId, true);
  }

  private async computeDebts(workspaceId: string, simplified: boolean) {
    const nets = await this.repository.getNetBalances(workspaceId);
    const currencies = [...new Set(nets.map((n) => n.currency))];

    const perCurrency = await Promise.all(
      currencies.map(async (currency) => {
        if (simplified) {
          const balances = nets
            .filter((n) => n.currency === currency)
            .map((n) => ({ id: n.userId, minor: n.net.minor }));
          return this.algorithm.settleUp(balances).map((d) => toMajorDebt(d, currency));
        }
        const [splits, settlements] = await Promise.all([
          this.repository.getSplitRecords(workspaceId, currency),
          this.repository.getSettlementRecords(workspaceId, currency),
        ]);
        return pairwiseDebts(currency, splits, settlements).map((d) => toMajorDebt(d, currency));
      }),
    );
    return perCurrency.flat();
  }

  async hasOutstandingBalance(workspaceId: string, userId: string) {
    const nets = await this.repository.getNetBalances(workspaceId);
    return nets.some((n) => n.userId === userId && !n.net.isZero());
  }

  /** Net amount per friend (and currency) summed over every workspace you share with them. */
  async getFriendsBalances(userId: string) {
    const nets = await this.repository.getNetBalancesForMember(userId);

    const friends = new Map<string, { userId: string; currency: string; netBalance: number }>();
    for (const [, rows] of groupBy(nets, (n) => `${n.workspaceId}|${n.currency}`)) {
      const settleUp = this.algorithm.settleUp(
        rows.map((r) => ({ id: r.userId, minor: r.net.minor })),
      );
      const currency = rows[0].currency;
      for (const debt of settleUp) {
        if (debt.debtor !== userId && debt.creditor !== userId) continue;
        const friendId = debt.debtor === userId ? debt.creditor : debt.debtor;
        const signed = debt.debtor === userId ? -debt.minor : debt.minor;
        const key = `${friendId}|${currency}`;
        const entry = friends.get(key) ?? { userId: friendId, currency, netBalance: 0 };
        entry.netBalance += signed;
        friends.set(key, entry);
      }
    }

    const profiles = new Map(
      (
        await this.usersService.findByIds([...new Set([...friends.values()].map((f) => f.userId))])
      ).map((u) => [u.id, u]),
    );
    return [...friends.values()].map((f) => ({
      userId: f.userId,
      name: profiles.get(f.userId)?.name ?? 'Unknown',
      avatarUrl: profiles.get(f.userId)?.avatarUrl ?? null,
      netBalance: f.netBalance / 100,
      currency: f.currency,
    }));
  }
}
