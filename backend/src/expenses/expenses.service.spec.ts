import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { EventBus } from '../common/events/event-bus';
import { SplitStrategyRegistry } from './strategies/split-strategy.registry';
import { EqualSplitStrategy } from './strategies/equal-split.strategy';
import { ExactSplitStrategy } from './strategies/exact-split.strategy';
import type {
  IExpensesRepository,
  IWorkspacesRepository,
} from '../common/interfaces/repository.interfaces';

const [A, B, C] = ['a', 'b', 'c'];

describe('ExpensesService', () => {
  let expenses: jest.Mocked<IExpensesRepository>;
  let workspaces: jest.Mocked<IWorkspacesRepository>;
  let service: ExpensesService;
  let events: jest.Mocked<EventBus>;

  beforeEach(() => {
    expenses = {
      findPage: jest.fn(),
      findById: jest.fn(),
      createWithSplits: jest.fn(async (e) => ({ id: 'e1', ...e })),
      updateWithSplits: jest.fn(async (id) => ({ id })),
      delete: jest.fn(),
    };
    workspaces = {
      allAreMembers: jest.fn().mockResolvedValue(true),
      findMemberRole: jest.fn().mockResolvedValue('MEMBER'),
    } as unknown as jest.Mocked<IWorkspacesRepository>;
    events = { publish: jest.fn(), subscribe: jest.fn() };
    service = new ExpensesService(
      expenses,
      workspaces,
      new SplitStrategyRegistry([new EqualSplitStrategy(), new ExactSplitStrategy()]),
      events,
    );
  });

  const dinner = {
    description: 'Dinner',
    amount: 100,
    currency: 'USD',
    date: '2026-01-01',
    splitType: 'EQUAL' as const,
    type: 'EXPENSE' as const,
    recurringInterval: 'NONE' as const,
    payers: [{ userId: A, amount: 100 }],
    participants: [A, B, C],
  };

  it('saves exact cents in one repository call', async () => {
    await service.create('w1', A, dinner);
    const [expense, splits] = expenses.createWithSplits.mock.calls[0];
    expect(expense.amount).toBe('100.00');
    expect(splits.map((s) => s.amountOwed)).toEqual(['33.34', '33.33', '33.33']);
    expect(splits.find((s) => s.userId === A)?.amountPaid).toBe('100.00');
  });

  it('announces the new expense to the workspace', async () => {
    await service.create('w1', A, dinner);
    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'w1', type: 'expense.created', actorId: A }),
    );
  });

  it('rejects people who are not workspace members', async () => {
    workspaces.allAreMembers.mockResolvedValue(false);
    await expect(service.create('w1', A, dinner)).rejects.toThrow(BadRequestException);
    expect(expenses.createWithSplits).not.toHaveBeenCalled();
  });

  it('defaults equal-split participants to the payers', async () => {
    await service.create('w1', A, { ...dinner, participants: undefined });
    const [, splits] = expenses.createWithSplits.mock.calls[0];
    expect(splits).toHaveLength(1);
  });

  describe('update', () => {
    const stored = {
      id: 'e1',
      workspaceId: 'w1',
      version: 3,
      amount: '90.00',
      currency: 'USD',
      splitType: 'EQUAL',
      splitInput: { participants: [A, B, C] },
      splits: [
        { userId: A, amountOwed: '30.00', amountPaid: '90.00' },
        { userId: B, amountOwed: '30.00', amountPaid: '0.00' },
        { userId: C, amountOwed: '30.00', amountPaid: '0.00' },
      ],
    };

    beforeEach(() => expenses.findById.mockResolvedValue(stored));

    it('only touches the expense row for a description change', async () => {
      await service.update('w1', 'e1', { description: 'Lunch' });
      expect(expenses.updateWithSplits).toHaveBeenCalledWith(
        'e1',
        { description: 'Lunch' },
        null,
        undefined,
      );
    });

    it('recomputes splits and rescales the payer when the amount changes', async () => {
      await service.update('w1', 'e1', { amount: 120 });
      const [, patch, splits] = expenses.updateWithSplits.mock.calls[0];
      expect(patch.amount).toBe('120.00');
      expect(splits?.map((s) => s.amountOwed)).toEqual(['40.00', '40.00', '40.00']);
      expect(splits?.find((s) => s.userId === A)?.amountPaid).toBe('120.00');
    });

    it('rejects a stale version before writing', async () => {
      await expect(service.update('w1', 'e1', { amount: 1, expectedVersion: 2 })).rejects.toThrow(
        ConflictException,
      );
      expect(expenses.updateWithSplits).not.toHaveBeenCalled();
    });

    it('turns a lost optimistic-lock race into a conflict', async () => {
      expenses.updateWithSplits.mockResolvedValue(null);
      await expect(
        service.update('w1', 'e1', { description: 'x', expectedVersion: 3 }),
      ).rejects.toThrow(ConflictException);
    });

    it('treats an expense from another workspace as missing', async () => {
      await expect(service.update('other', 'e1', { description: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  it('pages with a cursor only when more rows exist', async () => {
    const row = (n: number) => ({ id: `e${n}`, date: new Date(2026, 0, n) });
    expenses.findPage.mockResolvedValue([row(3), row(2), row(1)]);
    const page = await service.list('w1', { limit: 2 });
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBeTruthy();
    expect(expenses.findPage.mock.calls[0][1].limit).toBe(3);

    expenses.findPage.mockResolvedValue([row(1)]);
    expect((await service.list('w1', { limit: 2 })).nextCursor).toBeNull();
  });

  it('rejects a tampered cursor', async () => {
    await expect(service.list('w1', { cursor: 'not-a-cursor' })).rejects.toThrow(
      BadRequestException,
    );
  });
});
