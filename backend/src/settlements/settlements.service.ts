import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { CreateSettlementDto } from './dto/create-settlement.dto';
import {
  ISettlementsRepositoryToken,
  IWorkspacesRepositoryToken,
} from '../common/interfaces/repository.interfaces';
import type {
  ISettlementsRepository,
  IWorkspacesRepository,
} from '../common/interfaces/repository.interfaces';
import { Money } from '../common/money/money';
import { BalancesService } from '../balances/balances.service';
import { WorkspacesService } from '../workspaces/workspaces.service';

@Injectable()
export class SettlementsService {
  constructor(
    @Inject(ISettlementsRepositoryToken)
    private readonly repository: ISettlementsRepository,
    @Inject(IWorkspacesRepositoryToken)
    private readonly workspacesRepository: IWorkspacesRepository,
    private readonly balancesService: BalancesService,
    private readonly workspacesService: WorkspacesService,
  ) {}

  async listSettlements(workspaceId: string) {
    return this.repository.findByWorkspace(workspaceId);
  }

  async recordSettlement(workspaceId: string, dto: CreateSettlementDto) {
    if (dto.payerId === dto.payeeId) {
      throw new BadRequestException('Payer and payee must be different people');
    }
    if (!(await this.workspacesRepository.allAreMembers(workspaceId, [dto.payerId, dto.payeeId]))) {
      throw new BadRequestException('Payer and payee must be members of the workspace');
    }

    const currency =
      dto.currency ?? (await this.workspacesService.getWorkspace(workspaceId)).defaultCurrency;
    return this.repository.create(workspaceId, {
      payerId: dto.payerId,
      payeeId: dto.payeeId,
      amount: Money.fromMajor(dto.amount, currency).toDecimal(),
      currency,
      date: new Date(dto.date),
    });
  }

  /** Pays a friend across every workspace you share, clearing what you owe them first. */
  async recordGlobalSettlement(payerId: string, payeeId: string, amount: number, currency: string) {
    if (payerId === payeeId) {
      throw new BadRequestException('You cannot settle with yourself');
    }
    const [mine, theirs] = await Promise.all([
      this.workspacesService.listWorkspaces(payerId),
      this.workspacesService.listWorkspaces(payeeId),
    ]);
    const theirIds = new Set(theirs.map((w) => w.id));
    const shared = mine.filter((w) => theirIds.has(w.id));
    if (shared.length === 0) {
      throw new BadRequestException('You do not share a workspace with this person');
    }

    let remaining = Money.fromMajor(amount, currency);
    const created: unknown[] = [];
    const record = async (workspaceId: string, value: Money) => {
      created.push(
        await this.repository.create(workspaceId, {
          payerId,
          payeeId,
          amount: value.toDecimal(),
          currency: value.currency,
          date: new Date(),
        }),
      );
    };

    for (const workspace of shared) {
      if (remaining.minor <= 0) break;
      const debts = await this.balancesService.getDebts(workspace.id, true);
      const debt = debts.find(
        (d) => d.debtor === payerId && d.creditor === payeeId && d.currency === currency,
      );
      if (!debt) continue;

      const pay = Money.fromMajor(debt.amount, currency);
      const part = pay.minor < remaining.minor ? pay : remaining;
      await record(workspace.id, part);
      remaining = remaining.subtract(part);
    }

    // Anything left over is an overpayment, recorded in the first shared workspace.
    if (remaining.minor > 0) await record(shared[0].id, remaining);
    return created;
  }
}
