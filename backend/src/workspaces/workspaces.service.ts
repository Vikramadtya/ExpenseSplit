import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { IWorkspacesRepository } from '../common/interfaces/repository.interfaces';
import { IWorkspacesRepositoryToken } from '../common/interfaces/repository.interfaces';
import { UsersService } from '../users/users.service';

@Injectable()
export class WorkspacesService {
  constructor(
    @Inject(IWorkspacesRepositoryToken)
    private readonly repository: IWorkspacesRepository & {
      getActivity(id: string): Promise<any[]>;
    },
    private readonly usersService: UsersService,
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
}
