import { occurrenceAt } from './occurrence';
import { RecurringRepository, RecurringRule } from './recurring.repository';
import { RecurringService } from './recurring.service';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-06-10T12:00:00Z');

const makeRule = (over: Partial<RecurringRule> = {}): RecurringRule => ({
  id: 'r1',
  workspaceId: 'w1',
  createdById: 'u1',
  template: { description: 'Netflix', amount: 15 },
  interval: 'DAILY',
  startAt: new Date(NOW.getTime() - 3 * DAY),
  runCount: 0,
  nextRunAt: new Date(NOW.getTime() - 3 * DAY),
  active: true,
  lastError: null,
  createdAt: NOW,
  ...over,
});

/** A tiny in-memory repository with the same compare-and-set rule as the real one. */
const fakeRepo = (rule: RecurringRule) => {
  const state = { rule };
  const repo = {
    findDue: jest.fn(async () =>
      state.rule.active && state.rule.nextRunAt <= NOW ? [state.rule] : [],
    ),
    advance: jest.fn(async (_id: string, expected: Date, runCount: number, nextRunAt: Date) => {
      if (state.rule.nextRunAt.getTime() !== expected.getTime()) return false;
      state.rule = { ...state.rule, runCount, nextRunAt };
      return true;
    }),
    pause: jest.fn(async (_id: string, reason: string) => {
      state.rule = { ...state.rule, active: false, lastError: reason };
    }),
    findById: jest.fn(async () => state.rule),
  };
  return { state, repo: repo as unknown as RecurringRepository, mocks: repo };
};

describe('RecurringService.runDue', () => {
  const build = (rule: RecurringRule, createImpl?: () => Promise<unknown>) => {
    const { state, repo, mocks } = fakeRepo(rule);
    const expenses = { create: jest.fn(createImpl ?? (async () => ({}))), validate: jest.fn() };
    const notifications = { notify: jest.fn() };
    const workspaces = { findMemberRole: jest.fn().mockResolvedValue('MEMBER') };
    const service = new RecurringService(
      repo,
      expenses as never,
      notifications as never,
      workspaces as never,
    );
    return { service, state, mocks, expenses, notifications, workspaces };
  };

  it('creates one expense per missed occurrence, dated on the occurrence', async () => {
    const { service, expenses, state } = build(makeRule());
    expect(await service.runDue(NOW)).toBe(4); // day -3, -2, -1 and today
    const dates = expenses.create.mock.calls
      .map((c) => (c as unknown[])[2])
      .map((d) => (d as { date: string }).date.slice(0, 10));
    expect(dates).toEqual(['2026-06-07', '2026-06-08', '2026-06-09', '2026-06-10']);
    expect(state.rule.nextRunAt.toISOString().slice(0, 10)).toBe('2026-06-11');
    expect(state.rule.runCount).toBe(4);
  });

  it('is idempotent: a second run creates nothing', async () => {
    const { service, expenses } = build(makeRule());
    await service.runDue(NOW);
    expenses.create.mockClear();
    expect(await service.runDue(NOW)).toBe(0);
    expect(expenses.create).not.toHaveBeenCalled();
  });

  it('treats a duplicate-occurrence error as already done and moves on', async () => {
    const { service, state } = build(
      makeRule({
        nextRunAt: new Date(NOW.getTime() - 1000),
        startAt: new Date(NOW.getTime() - 1000),
      }),
      async () => {
        throw Object.assign(new Error('dup'), { cause: { code: '23505' } });
      },
    );
    await service.runDue(NOW);
    expect(state.rule.active).toBe(true);
    expect(state.rule.runCount).toBe(1);
  });

  it('pauses the rule and tells its creator when an expense cannot be created', async () => {
    const { service, state, notifications } = build(makeRule(), async () => {
      throw new Error('Everyone in an expense must be a member');
    });
    await service.runDue(NOW);
    expect(state.rule.active).toBe(false);
    expect(state.rule.lastError).toContain('must be a member');
    expect(notifications.notify).toHaveBeenCalledWith(
      ['u1'],
      expect.objectContaining({ kind: 'recurring.failed' }),
    );
  });

  it('pauses when the creator has left the workspace', async () => {
    const { service, state, workspaces, expenses } = build(makeRule());
    workspaces.findMemberRole.mockResolvedValue(null);
    await service.runDue(NOW);
    expect(expenses.create).not.toHaveBeenCalled();
    expect(state.rule.active).toBe(false);
  });

  it('skips ahead instead of flooding when far behind', async () => {
    const start = new Date(NOW.getTime() - 100 * DAY);
    const { service, expenses, state } = build(makeRule({ startAt: start, nextRunAt: start }));
    expect(await service.runDue(NOW)).toBe(12); // capped catch-up
    expect(expenses.create).toHaveBeenCalledTimes(12);
    expect(state.rule.nextRunAt.getTime()).toBeGreaterThan(NOW.getTime());
    expect(state.rule.nextRunAt.getTime()).toBe(
      occurrenceAt(start, 'DAILY', state.rule.runCount).getTime(),
    );
  });

  it('does not run a rule another instance advanced first', async () => {
    const { service, mocks, expenses } = build(makeRule());
    mocks.advance.mockResolvedValue(false); // lost the compare-and-set
    expect(await service.runDue(NOW)).toBe(1);
    expect(expenses.create).toHaveBeenCalledTimes(1);
  });
});
