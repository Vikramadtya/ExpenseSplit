import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IBalancesRepositoryToken } from '../common/interfaces/repository.interfaces';
import type { IBalancesRepository } from '../common/interfaces/repository.interfaces';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { UsersService } from '../users/users.service';
import { DebtSimplificationAlgorithm } from './algorithms/debt-simplification.algorithm';

@Injectable()
export class BalancesService {
  constructor(
    @Inject(IBalancesRepositoryToken)
    private readonly repository: IBalancesRepository,
    private readonly workspacesService: WorkspacesService,
    private readonly usersService: UsersService,
  ) {}

  async getBalances(workspaceId: string, userId?: string) {
    if (!workspaceId) {
      return { byCurrency: [] };
    }

    const workspace = await this.workspacesService.getWorkspace(workspaceId);
    if (!workspace) throw new NotFoundException('Workspace not found');

    const netBalances = await this.repository.getNetBalances(workspaceId);

    // If userId is provided, calculate owedToYou and youOwe
    let owedToYou = 0;
    let youOwe = 0;
    if (userId) {
      const myNet = netBalances.find((b) => b.userId === userId)?.net || 0;
      if (myNet > 0) owedToYou = myNet;
      if (myNet < 0) youOwe = Math.abs(myNet);
    }

    return {
      byCurrency: [
        {
          currency: workspace.defaultCurrency,
          total: netBalances.reduce((acc, curr) => acc + Math.abs(curr.net), 0) / 2,
          owedToYou,
          youOwe,
          perMember: netBalances.map((b) => ({ userId: b.userId, net: b.net })),
        },
      ],
    };
  }

  async getDebts(workspaceId: string, simplified: boolean = true) {
    if (!workspaceId) return [];

    const workspace = await this.workspacesService.getWorkspace(workspaceId);
    const rawDebts = await this.repository.getExpenseDebts(workspaceId);

    let debtsToReturn = rawDebts.map((d) => ({
      debtor: d.debtor,
      creditor: d.creditor,
      amount: d.amount,
      currency: workspace.defaultCurrency,
    }));

    if (simplified) {
      const algorithm = new DebtSimplificationAlgorithm();
      const simplifiedDebts = algorithm.simplifyDebts(
        debtsToReturn.map((d) => ({
          debtor: d.debtor,
          creditor: d.creditor,
          amount: d.amount,
        })),
      );

      debtsToReturn = simplifiedDebts.map((d) => ({
        debtor: d.debtor,
        creditor: d.creditor,
        amount: d.amount,
        currency: workspace.defaultCurrency,
      }));
    }

    return debtsToReturn;
  }

  async getFriendsBalances(userId: string) {
    // 1. Get all workspaces user is a member of
    const workspaces = await this.workspacesService.listWorkspaces(userId);
    if (workspaces.length === 0) return [];

    const workspaceIds = workspaces.map((w) => w.id);
    const workspaceCurrencyMap = new Map(workspaces.map((w) => [w.id, w.defaultCurrency]));

    // 2. Get all raw debts for these workspaces
    const rawDebts = await this.repository.getExpenseDebtsByWorkspaces(workspaceIds);

    // 3. Group raw debts by currency
    const debtsByCurrency = new Map<string, any[]>();
    for (const debt of rawDebts) {
      const currency = workspaceCurrencyMap.get(debt.workspaceId) || 'USD';
      if (!debtsByCurrency.has(currency)) debtsByCurrency.set(currency, []);
      debtsByCurrency.get(currency)!.push(debt);
    }

    // 4. Simplify debts globally per currency and extract those involving the user
    const friendBalancesMap = new Map<
      string,
      {
        userId: string;
        name: string;
        avatarUrl: string | null;
        netBalance: number;
        currency: string;
      }
    >();

    const algorithm = new DebtSimplificationAlgorithm();

    // We need user details for friends
    // To minimize DB calls, we can fetch users as we process, or collect all unique user IDs first
    const uniqueUserIds = new Set<string>();
    rawDebts.forEach((d) => {
      uniqueUserIds.add(d.debtor);
      uniqueUserIds.add(d.creditor);
    });

    // Pre-fetch all user details
    const usersList = await this.usersService.findAll();
    const userMap = new Map(usersList.map((u) => [u.id, u]));

    for (const [currency, debts] of debtsByCurrency.entries()) {
      const simplified = algorithm.simplifyDebts(
        debts.map((d) => ({
          debtor: d.debtor,
          creditor: d.creditor,
          amount: d.amount,
        })),
      );

      for (const debt of simplified) {
        if (debt.debtor === userId || debt.creditor === userId) {
          const isDebtor = debt.debtor === userId;
          const friendId = isDebtor ? debt.creditor : debt.debtor;
          const amount = isDebtor ? -debt.amount : debt.amount; // Negative if user owes friend, positive if friend owes user

          const key = `${friendId}-${currency}`;
          if (!friendBalancesMap.has(key)) {
            const friendData = userMap.get(friendId);
            friendBalancesMap.set(key, {
              userId: friendId,
              name: friendData?.name || 'Unknown',
              avatarUrl: friendData?.avatarUrl || null,
              netBalance: 0,
              currency,
            });
          }

          friendBalancesMap.get(key)!.netBalance += amount;
        }
      }
    }

    return Array.from(friendBalancesMap.values());
  }
}
