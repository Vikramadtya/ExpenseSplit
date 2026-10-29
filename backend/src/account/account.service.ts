import { BadRequestException, Injectable } from '@nestjs/common';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { AccountRepository } from './account.repository';

@Injectable()
export class AccountService {
  constructor(
    private readonly repository: AccountRepository,
    private readonly workspaces: WorkspacesService,
  ) {}

  async exportData(userId: string) {
    const data = await this.repository.collect(userId);
    return { exportedAt: new Date().toISOString(), ...data };
  }

  /**
   * Deletes the account. Refused (with the reasons) while anything would be left dangling:
   * an unsettled balance, or being the only admin of a group that has other members.
   */
  async deleteAccount(userId: string) {
    const mine = await this.workspaces.listWorkspaces(userId);
    const blockers: { workspace: string; reason: string }[] = [];
    for (const workspace of mine) {
      const reason = await this.workspaces.whyCannotLeave(workspace.id, userId);
      if (reason) blockers.push({ workspace: workspace.name, reason });
    }
    if (blockers.length > 0) {
      throw new BadRequestException({
        message: 'Resolve these before deleting your account',
        blockers,
      });
    }

    for (const workspace of mine) {
      // A private ledger with a friend stays, so their history is not lost; you stay in it as
      // an anonymous "Deleted user" (the balance is already zero).
      if (workspace.type === 'GROUP') await this.workspaces.leave(workspace.id, userId);
    }
    await this.repository.anonymize(userId);
  }
}
