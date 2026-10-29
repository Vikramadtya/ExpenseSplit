import { Injectable, Inject, forwardRef, BadRequestException } from '@nestjs/common';
import { CreateSettlementDto } from './dto/create-settlement.dto';
import { ISettlementsRepositoryToken } from '../common/interfaces/repository.interfaces';
import type { ISettlementsRepository } from '../common/interfaces/repository.interfaces';
import { BalancesService } from '../balances/balances.service';
import { WorkspacesService } from '../workspaces/workspaces.service';

@Injectable()
export class SettlementsService {
  constructor(
    @Inject(ISettlementsRepositoryToken)
    private readonly repository: ISettlementsRepository,
    @Inject(forwardRef(() => BalancesService))
    private readonly balancesService: BalancesService,
    @Inject(forwardRef(() => WorkspacesService))
    private readonly workspacesService: WorkspacesService,
  ) {}

  async listSettlements(workspaceId: string) {
    return this.repository.findByWorkspace(workspaceId);
  }

  async recordSettlement(workspaceId: string, dto: CreateSettlementDto) {
    return this.repository.create(workspaceId, dto);
  }

  async recordGlobalSettlement(payerId: string, payeeId: string, amount: number, currency: string) {
    // Distribute settlement across shared workspaces
    const workspaces = await this.workspacesService.listWorkspaces(payerId);
    const workspaceIds = workspaces.filter((w) => w.defaultCurrency === currency).map((w) => w.id);

    if (workspaceIds.length === 0) {
      throw new BadRequestException('No shared workspaces with this currency');
    }

    let remainingToSettle = amount;
    const settlementsCreated = [];

    // For each workspace, check how much payer owes payee
    for (const wid of workspaceIds) {
      if (remainingToSettle <= 0) break;

      const debts = await this.balancesService.getDebts(wid, true);
      // Find debt where user owes the friend
      const debt = debts.find((d) => d.debtor === payerId && d.creditor === payeeId);

      if (debt && debt.amount > 0) {
        const settleAmount = Math.min(debt.amount, remainingToSettle);

        const settlement = await this.repository.create(wid, {
          payerId,
          payeeId,
          amount: settleAmount,
          date: new Date().toISOString(),
        });

        settlementsCreated.push(settlement);
        remainingToSettle -= settleAmount;
      }
    }

    // If still remaining, just dump it in the first workspace they share (overpayment)
    if (remainingToSettle > 0 && workspaceIds.length > 0) {
      const settlement = await this.repository.create(workspaceIds[0], {
        payerId,
        payeeId,
        amount: remainingToSettle,
        date: new Date().toISOString(),
      });
      settlementsCreated.push(settlement);
    }

    return settlementsCreated;
  }
}
