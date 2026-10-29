import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BalancesService } from '../balances/balances.service';
import type { IWorkspacesRepository, Role } from '../common/interfaces/repository.interfaces';
import { IWorkspacesRepositoryToken } from '../common/interfaces/repository.interfaces';
import { UsersService } from '../users/users.service';
import { EventBus } from '../common/events/event-bus';

@Injectable()
export class WorkspacesService {
  constructor(
    @Inject(IWorkspacesRepositoryToken)
    private readonly repository: IWorkspacesRepository & {
      getActivity(id: string): Promise<any[]>;
    },
    private readonly usersService: UsersService,
    private readonly balancesService: BalancesService,
    private readonly events: EventBus,
  ) {}

  async listWorkspaces(userId: string) {
    return this.repository.findAll(userId);
  }

  async createWorkspace(name: string, defaultCurrency: string, userId: string) {
    const newWorkspace = await this.repository.create({
      name,
      defaultCurrency: defaultCurrency || 'USD',
    });

    await this.repository.addMember(newWorkspace.id, userId, 'ADMIN');

    return {
      id: newWorkspace.id,
      name: newWorkspace.name,
      defaultCurrency: newWorkspace.defaultCurrency,
      createdAt: newWorkspace.createdAt,
    };
  }

  async getWorkspace(id: string) {
    const workspace = await this.repository.findById(id);
    if (!workspace) throw new NotFoundException('Workspace not found');
    return workspace;
  }

  async inviteMember(workspaceId: string, email: string) {
    await this.assertIsGroup(workspaceId);
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found. They must sign up first.');
    }

    // Check if already a member
    const members = await this.repository.getMembers(workspaceId);
    if (members.some((m) => m.id === user.id)) {
      throw new BadRequestException('User is already a member of this workspace');
    }

    await this.repository.addMember(workspaceId, user.id, 'MEMBER');
    return { success: true };
  }

  async getMembers(workspaceId: string) {
    return this.repository.getMembers(workspaceId);
  }

  async getActivity(workspaceId: string) {
    return this.repository.getActivity(workspaceId);
  }

  async updateWorkspace(id: string, data: { name?: string; defaultCurrency?: string }) {
    return this.repository.update(id, data);
  }

  async deleteWorkspace(id: string) {
    return this.repository.delete(id);
  }

  async removeMember(workspaceId: string, userId: string) {
    await this.assertIsGroup(workspaceId);
    if (await this.balancesService.hasOutstandingBalance(workspaceId, userId)) {
      throw new BadRequestException(
        'Cannot remove member with non-zero balance. Settle debts first.',
      );
    }
    await this.repository.removeMember(workspaceId, userId);
    this.events.publish({ workspaceId, type: 'member.left', entityId: userId, actorId: userId });
    await this.deleteIfEmpty(workspaceId);
  }

  /** A member leaving on their own. Admins must hand over before leaving a group with others. */
  async leave(workspaceId: string, userId: string) {
    const role = await this.repository.findMemberRole(workspaceId, userId);
    if (role === 'ADMIN' && (await this.repository.countAdmins(workspaceId)) === 1) {
      const members = await this.repository.getMembers(workspaceId);
      if (members.length > 1) {
        throw new BadRequestException('Make another member an admin before leaving');
      }
    }
    await this.removeMember(workspaceId, userId);
  }

  async setMemberRole(workspaceId: string, userId: string, role: Role) {
    const current = await this.repository.findMemberRole(workspaceId, userId);
    if (!current) throw new NotFoundException('Member not found');
    if (
      current === 'ADMIN' &&
      role === 'MEMBER' &&
      (await this.repository.countAdmins(workspaceId)) === 1
    ) {
      throw new BadRequestException('A workspace needs at least one admin');
    }
    await this.repository.setMemberRole(workspaceId, userId, role);
    this.events.publish({ workspaceId, type: 'member.role_changed', entityId: userId });
    return { userId, role };
  }

  /** The private two-person ledger with someone you already share a workspace with. */
  async getOrCreateDirect(userId: string, friendId: string) {
    if (userId === friendId)
      throw new BadRequestException('You cannot open a ledger with yourself');
    const friend = await this.usersService.findVisibleTo(userId, friendId);
    const me = await this.usersService.findById(userId);

    const directKey = [userId, friendId].sort().join(':');
    return (
      (await this.repository.findDirect(directKey)) ??
      (await this.repository.createDirect({
        directKey,
        name: `${me.name} & ${friend.name}`,
        defaultCurrency: 'USD',
        userIds: [userId, friendId],
      }))
    );
  }

  private async assertIsGroup(workspaceId: string) {
    const workspace = await this.getWorkspace(workspaceId);
    if (workspace.type === 'DIRECT') {
      throw new BadRequestException('Members of a direct ledger cannot be changed');
    }
  }

  /** Nobody left to own the data: remove the (necessarily settled) workspace. */
  private async deleteIfEmpty(workspaceId: string) {
    if ((await this.repository.getMembers(workspaceId)).length === 0) {
      await this.repository.delete(workspaceId);
    }
  }
}
