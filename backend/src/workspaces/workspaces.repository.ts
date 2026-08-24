import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_CLIENT } from '../database/database.module';
import type { DrizzleDb } from '../database/database.module';
import { eq } from 'drizzle-orm';
import { workspaceMembers, workspaces } from '../database/schema';

@Injectable()
export class WorkspacesRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDb) {}

  async findAll(userId: string): Promise<any[]> {
    return this.db.query.workspaceMembers.findMany({
      where: eq(workspaceMembers.userId, userId),
    });
  }

  async findById(id: string): Promise<any> {
    throw new Error('Not implemented — add your business logic here');
  }

  async findByName(name: string): Promise<any> {
    throw new Error('Not implemented — add your business logic here');
  }

  async findByUserId(userId: string): Promise<any[]> {
    throw new Error('Not implemented — add your business logic here');
  }

  async create(data: { name: string; defaultCurrency: string }): Promise<any> {
    const [newWorkspace] = await this.db.insert(workspaces).values(data).returning();
    return newWorkspace;
  }

  async addMember(workspaceId: string, userId: string, role?: string): Promise<any> {
    const [newWorkspaceMember] = await this.db
      .insert(workspaceMembers)
      .values({
        workspaceId,
        userId,
        role: (role as 'ADMIN' | 'MEMBER') || 'MEMBER',
      })
      .returning();
    return newWorkspaceMember;
  }

  async getMembers(workspaceId: string): Promise<any[]> {
    throw new Error('Not implemented — add your business logic here');
  }
}
