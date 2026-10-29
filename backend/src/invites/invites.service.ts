import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { IWorkspacesRepositoryToken } from '../common/interfaces/repository.interfaces';
import type { IWorkspacesRepository } from '../common/interfaces/repository.interfaces';
import { UsersService } from '../users/users.service';
import { InvitesRepository } from './invites.repository';
import { EventBus } from '../common/events/event-bus';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const hash = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class InvitesService {
  constructor(
    private readonly invites: InvitesRepository,
    @Inject(IWorkspacesRepositoryToken)
    private readonly workspaces: IWorkspacesRepository,
    private readonly users: UsersService,
    private readonly events: EventBus,
  ) {}

  /** Creates a join link. The raw token is returned once and never stored. */
  async create(workspaceId: string, userId: string) {
    const workspace = await this.workspaces.findById(workspaceId);
    if (workspace?.type === 'DIRECT') {
      throw new BadRequestException('Direct ledgers cannot have invite links');
    }
    const token = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    await this.invites.create({
      workspaceId,
      createdById: userId,
      tokenHash: hash(token),
      expiresAt,
    });
    return { token, expiresAt };
  }

  revokeAll(workspaceId: string) {
    return this.invites.revokeAll(workspaceId);
  }

  /** What the join page shows before you accept. */
  async preview(token: string, userId: string) {
    const invite = await this.findActive(token);
    const [workspace, members, inviter, role] = await Promise.all([
      this.workspaces.findById(invite.workspaceId),
      this.workspaces.getMembers(invite.workspaceId),
      this.users.findById(invite.createdById),
      this.workspaces.findMemberRole(invite.workspaceId, userId),
    ]);
    return {
      workspaceName: workspace.name,
      memberCount: members.length,
      invitedBy: inviter?.name ?? null,
      alreadyMember: role !== null,
    };
  }

  async accept(token: string, userId: string) {
    const invite = await this.findActive(token);
    const role = await this.workspaces.findMemberRole(invite.workspaceId, userId);
    if (!role) {
      await this.workspaces.addMember(invite.workspaceId, userId, 'MEMBER');
      this.events.publish({
        workspaceId: invite.workspaceId,
        type: 'member.joined',
        entityId: userId,
        actorId: userId,
      });
    }
    return { workspaceId: invite.workspaceId };
  }

  private async findActive(token: string) {
    const invite = await this.invites.findActiveByHash(hash(token));
    if (!invite) throw new NotFoundException('This invite link is invalid or has expired');
    return invite;
  }
}
