import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import type {
  IExpensesRepository,
  IWorkspacesRepository,
} from '../common/interfaces/repository.interfaces';
import {
  IExpensesRepositoryToken,
  IWorkspacesRepositoryToken,
} from '../common/interfaces/repository.interfaces';
import { SplitContext } from './strategies/split.context';
import { EqualSplitStrategy } from './strategies/equal-split.strategy';
import { ExactSplitStrategy } from './strategies/exact-split.strategy';

@Injectable()
export class ExpensesService {
  constructor(
    @Inject(IExpensesRepositoryToken)
    private readonly expensesRepository: IExpensesRepository,
    @Inject(IWorkspacesRepositoryToken)
    private readonly workspacesRepository: IWorkspacesRepository,
  ) {}

  async create(workspaceId: string, createdById: string, data: CreateExpenseDto) {
    let participants = data.participants || [];
    if (participants.length === 0) {
      if (data.splitType === 'EXACT' && data.exactAmounts) {
        participants = data.exactAmounts.map((ea) => ea.userId);
      } else if (data.payers.length > 0) {
        participants = data.payers.map((p) => p.userId);
      } else {
        throw new BadRequestException('Participants must be provided');
      }
    }

    const context = new SplitContext(new EqualSplitStrategy());
    if (data.splitType === 'EXACT') {
      context.setStrategy(new ExactSplitStrategy());
    } else if (data.splitType === 'PERCENTAGE') {
      throw new BadRequestException('Percentage split strategy is not implemented yet.');
    }

    const splits = context.executeSplit(data.amount, participants, data.exactAmounts);

    const newExpense = await this.expensesRepository.create({
      workspaceId,
      createdById,
      description: data.description,
      amount: data.amount.toString(),
      date: new Date(data.date),
      splitType: data.splitType,
      type: data.type,
      tags: data.tags || [],
      recurringInterval: data.recurringInterval,
    });

    const paidMap = new Map<string, number>();
    for (const p of data.payers) {
      paidMap.set(p.userId, (paidMap.get(p.userId) || 0) + p.amount);
    }

    const splitPromises = splits.map((split) => {
      const amountPaid = paidMap.get(split.userId) || 0;
      paidMap.delete(split.userId);
      return this.expensesRepository.createSplit({
        workspaceId,
        expenseId: newExpense.id,
        userId: split.userId,
        amountOwed: split.amountOwed.toString(),
        amountPaid: amountPaid.toString(),
      });
    });

    for (const [userId, amountPaid] of paidMap.entries()) {
      splitPromises.push(
        this.expensesRepository.createSplit({
          workspaceId,
          expenseId: newExpense.id,
          userId,
          amountOwed: '0',
          amountPaid: amountPaid.toString(),
        }),
      );
    }

    const createdSplits = await Promise.all(splitPromises);
    return { ...newExpense, splits: createdSplits };
  }

  async findAllByWorkspace(
    workspaceId: string,
    query: { q?: string; tags?: string; currency?: string; category?: string },
  ) {
    let expenses = await this.expensesRepository.findByWorkspace(workspaceId);

    if (query.q) {
      const search = query.q.toLowerCase();
      expenses = expenses.filter((e) => e.description.toLowerCase().includes(search));
    }
    if (query.tags) {
      const searchTags = query.tags.split(',');
      expenses = expenses.filter((e) => e.tags && searchTags.some((t) => e.tags.includes(t)));
    }

    return expenses;
  }

  async findOne(workspaceId: string, expenseId: string) {
    const expense = await this.expensesRepository.findById(expenseId);
    if (!expense || expense.workspaceId !== workspaceId) {
      throw new NotFoundException('Expense not found in this workspace');
    }
    return expense;
  }

  async update(workspaceId: string, expenseId: string, data: UpdateExpenseDto) {
    const expense = await this.findOne(workspaceId, expenseId);

    const updateData: any = {};
    if (data.description) updateData.description = data.description;
    if (data.amount) updateData.amount = data.amount.toString();
    if (data.date) updateData.date = new Date(data.date);
    if (data.splitType) updateData.splitType = data.splitType;

    if (Object.keys(updateData).length > 0) {
      await this.expensesRepository.update(expenseId, updateData);
    }

    return this.findOne(workspaceId, expenseId);
  }

  async remove(workspaceId: string, expenseId: string) {
    await this.findOne(workspaceId, expenseId);
    await this.expensesRepository.delete(expenseId);
    return true;
  }

  async verifyUserAccess(expenseId: string, userId: string) {
    const expense = await this.expensesRepository.findById(expenseId);
    if (!expense) throw new NotFoundException('Expense not found');

    const members = await this.workspacesRepository.getMembers(expense.workspaceId);
    const isMember = members.some((m) => m.id === userId);
    if (!isMember) {
      throw new UnauthorizedException('You do not have access to this expense');
    }
    return expense;
  }

  async findOneWithUserAccess(expenseId: string, userId: string) {
    return this.verifyUserAccess(expenseId, userId);
  }

  async updateWithUserAccess(expenseId: string, userId: string, data: UpdateExpenseDto) {
    const expense = await this.verifyUserAccess(expenseId, userId);
    return this.update(expense.workspaceId, expenseId, data);
  }

  async removeWithUserAccess(expenseId: string, userId: string) {
    const expense = await this.verifyUserAccess(expenseId, userId);
    return this.remove(expense.workspaceId, expenseId);
  }
}
