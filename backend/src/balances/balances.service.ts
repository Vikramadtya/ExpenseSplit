import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IBalancesRepositoryToken } from '../common/interfaces/repository.interfaces';
import type { IBalancesRepository } from '../common/interfaces/repository.interfaces';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { DebtSimplificationAlgorithm } from './algorithms/debt-simplification.algorithm';

@Injectable()
export class BalancesService {
  constructor(
    @Inject(IBalancesRepositoryToken)
    private readonly repository: IBalancesRepository,
    private readonly workspacesService: WorkspacesService,
  ) {}

  async getBalances(workspaceId: string) {
    if (!workspaceId) {
      return { byCurrency: [] };
    }

    const workspace = await this.workspacesService.getWorkspace(workspaceId);
    if (!workspace) throw new NotFoundException('Workspace not found');

    const netBalances = await this.repository.getNetBalances(workspaceId);

    return {
      byCurrency: [
        {
          currency: workspace.defaultCurrency,
          total: netBalances.reduce((acc, curr) => acc + Math.abs(curr.net), 0) / 2,
          owedToYou: 0,
          youOwe: 0,
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

  async getFriendsBalances() {
    return [];
  }
}
