import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { DRIZZLE_CLIENT } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.module';
import { workspaceMembers } from '../../database/schema';
import { eq, and } from 'drizzle-orm';

@Injectable()
export class WorkspaceMemberGuard implements CanActivate {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDb) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const workspaceId = request.headers['x-workspace-id'] || request.params.workspaceId;

    if (!user) {
      throw new ForbiddenException('User not authenticated - did you forget JwtAuthGuard?');
    }

    if (!workspaceId) {
      throw new ForbiddenException('Workspace ID is missing');
    }

    const [member] = await this.db
      .select()
      .from(workspaceMembers)
      .where(
        and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, user.id)),
      )
      .limit(1);

    if (member) {
      request.currentWorkspaceId = workspaceId;
      return true;
    }

    throw new ForbiddenException('You are not a member of this workspace');
  }
}
