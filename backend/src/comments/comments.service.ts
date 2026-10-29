import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { IWorkspacesRepositoryToken } from '../common/interfaces/repository.interfaces';
import type { IWorkspacesRepository } from '../common/interfaces/repository.interfaces';
import { ExpensesService } from '../expenses/expenses.service';
import { CommentsRepository } from './comments.repository';
import { EventBus } from '../common/events/event-bus';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CommentsService {
  constructor(
    private readonly comments: CommentsRepository,
    private readonly expenses: ExpensesService,
    @Inject(IWorkspacesRepositoryToken)
    private readonly workspaces: IWorkspacesRepository,
    private readonly events: EventBus,
    private readonly notifications: NotificationsService,
  ) {}

  async list(expenseId: string, userId: string) {
    await this.expenses.findOneWithUserAccess(expenseId, userId);
    return this.comments.findByExpense(expenseId);
  }

  async add(expenseId: string, userId: string, body: string) {
    const expense = await this.expenses.findOneWithUserAccess(expenseId, userId);
    const comment = await this.comments.create({
      workspaceId: expense.workspaceId,
      expenseId,
      userId,
      body,
    });
    this.events.publish({
      workspaceId: expense.workspaceId,
      type: 'comment.added',
      entityId: expenseId,
      actorId: userId,
    });
    this.notifications.notifyLater(
      [expense.createdById, ...expense.splits.map((s: { userId: string }) => s.userId)],
      {
        kind: 'comment.added',
        workspaceId: expense.workspaceId,
        actorId: userId,
        payload: { expenseId, description: expense.description, snippet: body.slice(0, 80) },
      },
    );
    return comment;
  }

  /** Authors can delete their own comments; admins can delete anyone's. */
  async remove(commentId: string, userId: string) {
    const comment = await this.comments.findById(commentId);
    const role = comment ? await this.workspaces.findMemberRole(comment.workspaceId, userId) : null;
    if (!comment || !role) throw new NotFoundException('Comment not found');
    if (comment.userId !== userId && role !== 'ADMIN') {
      throw new ForbiddenException('You can only delete your own comments');
    }
    await this.comments.delete(commentId);
  }
}
