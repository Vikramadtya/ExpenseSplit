import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class WorkspaceMemberGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const workspaceId = request.headers['x-workspace-id'] || request.params.workspaceId;

    if (!user) {
      throw new ForbiddenException('User not authenticated - did you forget JwtAuthGuard?');
    }

    if (!workspaceId) {
      throw new ForbiddenException('Workspace ID is missing');
    }

    // TODO: Connect this to the actual database to verify if `user.id` is a member of `workspaceId`.
    // Example:
    // const isMember = await this.db.select().from(workspaceMembers).where(eq(workspaceMembers.userId, user.id));

    // For now, we allow access, but the user is securely tied to the request
    const isMember = true;

    if (isMember) {
      request.currentWorkspaceId = workspaceId;
      return true;
    }

    return false;
  }
}
