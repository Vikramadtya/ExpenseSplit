import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_CLIENT } from '../database/database.module';
import type { DrizzleDb } from '../database/database.module';
import { eq, and, inArray, sql } from 'drizzle-orm';
import type { IWorkspacesRepository, Role } from '../common/interfaces/repository.interfaces';
import { workspaceMembers, workspaces, expenses, settlements } from '../database/schema';

@Injectable()
export class WorkspacesRepository implements IWorkspacesRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDb) {}

  async findAll(userId: string): Promise<any[]> {
    const memberships = await this.db.query.workspaceMembers.findMany({
      where: eq(workspaceMembers.userId, userId),
      with: { workspace: true },
    });
    return memberships.map((m) => m.workspace);
  }

  async findById(id: string): Promise<any> {
    const [workspace] = await this.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, id))
      .limit(1);
    return workspace || null;
  }

  async findByName(name: string): Promise<any> {
    const [workspace] = await this.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.name, name))
      .limit(1);
    return workspace || null;
  }

  async findByUserId(userId: string): Promise<any[]> {
    return this.findAll(userId);
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
    const members = await this.db.query.workspaceMembers.findMany({
      where: eq(workspaceMembers.workspaceId, workspaceId),
      with: { user: true },
    });
    return members.map((m) => ({
      ...m.user,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  async findMemberRole(workspaceId: string, userId: string): Promise<Role | null> {
    const [member] = await this.db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(
        and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)),
      )
      .limit(1);
    return member?.role ?? null;
  }

  async allAreMembers(workspaceId: string, userIds: string[]): Promise<boolean> {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return true;
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          inArray(workspaceMembers.userId, unique),
        ),
      );
    return row.count === unique.length;
  }

  async getActivity(workspaceId: string): Promise<any[]> {
    const exp = await this.db.query.expenses.findMany({
      where: eq(expenses.workspaceId, workspaceId),
      with: { createdBy: true },
      orderBy: (expenses, { desc }) => [desc(expenses.createdAt)],
      limit: 20,
    });

    const setts = await this.db.query.settlements.findMany({
      where: eq(settlements.workspaceId, workspaceId),
      with: { payer: true, payee: true },
      orderBy: (settlements, { desc }) => [desc(settlements.createdAt)],
      limit: 20,
    });

    const activity = [
      ...exp.map((e) => ({
        id: e.id,
        type: 'EXPENSE',
        description: e.description,
        amount: Number(e.amount),
        date: e.createdAt.toISOString(),
        actionBy: e.createdBy.name,
      })),
      ...setts.map((s) => ({
        id: s.id,
        type: 'SETTLEMENT',
        description: `Paid ${s.payee.name}`,
        amount: Number(s.amount),
        date: s.createdAt.toISOString(),
        actionBy: s.payer.name,
      })),
    ];

    return activity
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20);
  }

  async update(id: string, data: { name?: string; defaultCurrency?: string }): Promise<any> {
    const [workspace] = await this.db
      .update(workspaces)
      .set(data)
      .where(eq(workspaces.id, id))
      .returning();
    return workspace;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(workspaces).where(eq(workspaces.id, id));
  }

  async removeMember(workspaceId: string, userId: string): Promise<void> {
    await this.db
      .delete(workspaceMembers)
      .where(
        and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)),
      );
  }
}
