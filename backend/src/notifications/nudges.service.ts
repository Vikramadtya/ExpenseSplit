import { BadRequestException, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { IWorkspacesRepositoryToken } from '../common/interfaces/repository.interfaces';
import type { IWorkspacesRepository } from '../common/interfaces/repository.interfaces';
import { BalancesService } from '../balances/balances.service';
import { UsersService } from '../users/users.service';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class NudgesService {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly repository: NotificationsRepository,
    private readonly balances: BalancesService,
    private readonly users: UsersService,
    @Inject(IWorkspacesRepositoryToken) private readonly workspaces: IWorkspacesRepository,
  ) {}

  /** A friendly reminder to someone who owes you, at most once a day per person. */
  async nudge(workspaceId: string, fromUserId: string, targetId: string) {
    if (
      !(await this.workspaces.allAreMembers(workspaceId, [targetId])) ||
      targetId === fromUserId
    ) {
      throw new BadRequestException('Pick another member of this workspace');
    }

    const debts = await this.balances.getDebts(workspaceId, true);
    const owed = debts.filter((d) => d.debtor === targetId && d.creditor === fromUserId);
    if (owed.length === 0) throw new BadRequestException('They do not owe you anything here');

    if (
      await this.repository.existsSince(
        targetId,
        fromUserId,
        workspaceId,
        'nudge',
        new Date(Date.now() - ONE_DAY_MS),
      )
    ) {
      throw new HttpException(
        'You already sent a reminder in the last 24 hours',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const [me, workspace] = await Promise.all([
      this.users.findById(fromUserId),
      this.workspaces.findById(workspaceId),
    ]);
    const [debt] = owed;
    await this.notifications.notify([targetId], {
      kind: 'nudge',
      workspaceId,
      actorId: fromUserId,
      payload: {
        byName: me.name,
        amount: debt.amount,
        currency: debt.currency,
        workspaceName: workspace.name,
      },
    });
    return { sent: true };
  }
}
