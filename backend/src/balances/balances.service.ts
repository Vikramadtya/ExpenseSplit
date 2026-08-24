import { Injectable, Inject } from '@nestjs/common';
import { IBalancesRepositoryToken } from '../common/interfaces/repository.interfaces';
import type { IBalancesRepository } from '../common/interfaces/repository.interfaces';

@Injectable()
export class BalancesService {
  constructor(
    @Inject(IBalancesRepositoryToken)
    private readonly repository: IBalancesRepository,
  ) {}

  async getBalances(workspaceId: string) {
    return {
      byCurrency: [
        {
          currency: 'USD',
          total: 1700.5,
          owedToYou: 430.0,
          youOwe: 50.0,
          perMember: [
            { userId: 'dev-user-id', net: 380.0 },
            { userId: 'user-2', net: -340.5 },
            { userId: 'user-3', net: 90.5 },
            { userId: 'user-4', net: -130.0 },
          ],
        },
        {
          currency: 'EUR',
          total: 450.0,
          owedToYou: 257.5,
          youOwe: 112.5,
          perMember: [
            { userId: 'dev-user-id', net: -112.5 },
            { userId: 'user-2', net: 337.5 },
            { userId: 'user-3', net: -112.5 },
            { userId: 'user-4', net: -112.5 },
          ],
        },
      ],
    };
  }

  async getDebts(workspaceId: string, simplified: boolean = true) {
    if (simplified) {
      // Highly optimized minimal transactions
      return [
        {
          debtor: 'user-4',
          creditor: 'dev-user-id',
          amount: 130.0,
          currency: 'USD',
        },
        {
          debtor: 'user-2',
          creditor: 'dev-user-id',
          amount: 250.0,
          currency: 'USD',
        },
        { debtor: 'user-2', creditor: 'user-3', amount: 90.5, currency: 'USD' },
        {
          debtor: 'dev-user-id',
          creditor: 'user-2',
          amount: 112.5,
          currency: 'EUR',
        },
        {
          debtor: 'user-3',
          creditor: 'user-2',
          amount: 112.5,
          currency: 'EUR',
        },
        {
          debtor: 'user-4',
          creditor: 'user-2',
          amount: 112.5,
          currency: 'EUR',
        },
      ];
    } else {
      // Unoptimized, raw pairwise transactions based on who actually paid for what
      return [
        {
          debtor: 'user-4',
          creditor: 'dev-user-id',
          amount: 150.0,
          currency: 'USD',
        },
        {
          debtor: 'dev-user-id',
          creditor: 'user-4',
          amount: 20.0,
          currency: 'USD',
        },
        {
          debtor: 'user-2',
          creditor: 'dev-user-id',
          amount: 300.0,
          currency: 'USD',
        },
        {
          debtor: 'dev-user-id',
          creditor: 'user-2',
          amount: 50.0,
          currency: 'USD',
        },
        { debtor: 'user-2', creditor: 'user-3', amount: 50.5, currency: 'USD' },
        { debtor: 'user-2', creditor: 'user-3', amount: 40.0, currency: 'USD' },
        {
          debtor: 'dev-user-id',
          creditor: 'user-2',
          amount: 112.5,
          currency: 'EUR',
        },
        { debtor: 'user-3', creditor: 'user-2', amount: 50.0, currency: 'EUR' },
        { debtor: 'user-3', creditor: 'user-2', amount: 62.5, currency: 'EUR' },
        {
          debtor: 'user-4',
          creditor: 'user-2',
          amount: 112.5,
          currency: 'EUR',
        },
      ];
    }
  }

  async getFriendsBalances() {
    // TODO: Implement actual database aggregation across all workspaces.
    // Query group/workspace members, calculate net balances, return global friends list.
    return [
      {
        userId: 'user-2',
        name: 'Alice Cooper',
        avatarUrl: null,
        netBalance: -25.5,
        currency: 'USD',
      },
      {
        userId: 'user-3',
        name: 'Bob Marley',
        avatarUrl: null,
        netBalance: 120.0,
        currency: 'USD',
      },
    ];
  }
}
