import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IWorkspacesRepositoryToken } from '../../common/interfaces/repository.interfaces';
import type { IWorkspacesRepository, Role } from '../../common/interfaces/repository.interfaces';
import { ROLES_KEY } from '../decorators';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Registered globally, after the JWT guard. Any route with a `:workspaceId` param is only
 * reachable by members of that workspace (and by the roles named in `@Roles`, when present).
 */
@Injectable()
export class WorkspaceMemberGuard implements CanActivate {
  constructor(
    @Inject(IWorkspacesRepositoryToken)
    private readonly workspaces: IWorkspacesRepository,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const workspaceId: string | undefined = request.params?.workspaceId;
    if (!workspaceId) return true;

    if (!request.user) throw new ForbiddenException('Not authenticated');
    if (!UUID.test(workspaceId)) throw new NotFoundException('Workspace not found');

    const role = await this.workspaces.findMemberRole(workspaceId, request.user.id);
    // Non-members get the same answer as for a workspace that doesn't exist.
    if (!role) throw new NotFoundException('Workspace not found');

    const allowed = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed && !allowed.includes(role)) {
      throw new ForbiddenException('Only workspace admins can do this');
    }

    request.currentWorkspaceId = workspaceId;
    request.workspaceRole = role;
    return true;
  }
}
