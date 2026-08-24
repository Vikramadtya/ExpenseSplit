import { Injectable, Inject } from '@nestjs/common';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { IExpensesRepositoryToken } from '../common/interfaces/repository.interfaces';
import type { IExpensesRepository } from '../common/interfaces/repository.interfaces';

const MOCK_EXPENSES = [
  {
    id: 'exp-1',
    workspaceId: 'ws-1',
    description: 'Airbnb Booking',
    amount: 1200.0,
    date: new Date('2024-06-10').toISOString(),
    splitType: 'EQUAL',
    type: 'EXPENSE',
    category: 'Accommodation',
    currency: 'USD',
    tags: ['trip', 'summer'],
    createdAt: new Date('2024-06-10').toISOString(),
    splits: [
      { id: 'sp-1', userId: 'dev-user-id', amountOwed: 300, amountPaid: 600 },
      { id: 'sp-2', userId: 'user-2', amountOwed: 300, amountPaid: 600 },
      { id: 'sp-3', userId: 'user-3', amountOwed: 300, amountPaid: 0 },
      { id: 'sp-4', userId: 'user-4', amountOwed: 300, amountPaid: 0 },
    ],
  },
];

@Injectable()
export class ExpensesService {
  constructor(
    @Inject(IExpensesRepositoryToken)
    private readonly expensesRepository: IExpensesRepository,
  ) {}

  async create(workspaceId: string, createdById: string, data: CreateExpenseDto) {
    // TODO: Implement actual database insertion
    // 1. Calculate how much each participant owes based on splitType (EQUAL, EXACT, PERCENTAGE).
    // 2. Insert into `expenses` table (type, tags, recurringInterval, etc).
    // 3. Insert into `expense_splits` using data.payers to set `amountPaid` and step 1 for `amountOwed`.

    const newExpense = {
      id: 'exp-' + Math.random().toString(36).substr(2, 9),
      workspaceId,
      ...data,
      createdById,
      createdAt: new Date().toISOString(),
      splits: data.payers.map((p) => ({
        id: 'sp-' + Math.random(),
        userId: p.userId,
        amountPaid: p.amount,
        amountOwed: 0, // Mock, you should calculate this based on splitType
      })),
    };
    MOCK_EXPENSES.push(newExpense as any);
    return newExpense;
  }

  async findAllByWorkspace(
    workspaceId: string,
    query: { q?: string; tags?: string; currency?: string; category?: string },
  ) {
    // TODO: Implement actual database query
    // 1. Fetch from `expenses` where workspaceId = workspaceId
    // 2. Apply filters: `ilike` for search `q`, array contains for `tags`.
    return MOCK_EXPENSES.filter((e) => e.workspaceId === workspaceId || workspaceId === 'ws-1');
  }

  async findOne(workspaceId: string, expenseId: string) {
    return MOCK_EXPENSES.find((e) => e.id === expenseId);
  }

  async update(workspaceId: string, expenseId: string, data: UpdateExpenseDto) {
    // TODO: Implement actual update
    const expIndex = MOCK_EXPENSES.findIndex((e) => e.id === expenseId);
    if (expIndex > -1) {
      MOCK_EXPENSES[expIndex] = { ...MOCK_EXPENSES[expIndex], ...data };
      return MOCK_EXPENSES[expIndex];
    }
    return null;
  }

  async remove(workspaceId: string, expenseId: string) {
    // TODO: Implement actual delete
    const expIndex = MOCK_EXPENSES.findIndex((e) => e.id === expenseId);
    if (expIndex > -1) {
      MOCK_EXPENSES.splice(expIndex, 1);
    }
    return true;
  }
}
