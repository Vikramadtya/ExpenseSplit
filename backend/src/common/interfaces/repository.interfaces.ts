import type { Money } from '../money/money';
import type { SplitInput, SplitType } from '../../expenses/strategies/split.strategy';

export type Role = 'ADMIN' | 'MEMBER';

// ─── Workspace Repository ───────────────────────────────────────────────────
export interface IWorkspacesRepository {
  findAll(userId: string): Promise<any[]>;
  findById(id: string): Promise<any>;
  findByName(name: string): Promise<any>;
  findByUserId(userId: string): Promise<any[]>;
  create(data: { name: string; defaultCurrency: string }): Promise<any>;
  addMember(workspaceId: string, userId: string, role?: string): Promise<any>;
  getMembers(workspaceId: string): Promise<any[]>;
  findMemberRole(workspaceId: string, userId: string): Promise<Role | null>;
  setMemberRole(workspaceId: string, userId: string, role: Role): Promise<void>;
  countAdmins(workspaceId: string): Promise<number>;
  findDirect(directKey: string): Promise<any>;
  /** Creates the two-person ledger, or returns the existing one if the pair already has it. */
  createDirect(data: {
    directKey: string;
    name: string;
    defaultCurrency: string;
    userIds: [string, string];
  }): Promise<any>;
  allAreMembers(workspaceId: string, userIds: string[]): Promise<boolean>;
  getActivity(workspaceId: string): Promise<any[]>;
  update(id: string, data: { name?: string; defaultCurrency?: string }): Promise<any>;
  delete(id: string): Promise<void>;
  removeMember(workspaceId: string, userId: string): Promise<void>;
}
export const IWorkspacesRepositoryToken = Symbol('IWorkspacesRepository');

// ─── Expenses Repository ─────────────────────────────────────────────────────
export interface NewExpense {
  workspaceId: string;
  createdById: string;
  description: string;
  amount: string;
  currency: string;
  category: string;
  date: Date;
  splitType: SplitType;
  type: 'EXPENSE' | 'TRANSFER';
  tags: string[];
  recurringInterval: 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  splitInput: SplitInput;
  /** Set when a recurring rule generated this expense. */
  recurringRuleId?: string;
  occurrenceAt?: Date;
}

export type ExpensePatch = Partial<
  Omit<NewExpense, 'workspaceId' | 'createdById' | 'recurringRuleId' | 'occurrenceAt'>
>;

export interface NewSplit {
  userId: string;
  amountOwed: string;
  amountPaid: string;
}

export interface ExpenseFilter {
  q?: string;
  tags?: string[];
  currency?: string;
  category?: string;
  from?: Date;
  to?: Date;
  after?: { date: Date; id: string };
  limit: number;
}

export interface IExpensesRepository {
  findPage(workspaceId: string, filter: ExpenseFilter): Promise<any[]>;
  findById(id: string, includeDeleted?: boolean): Promise<any>;
  /** Inserts the expense and all its splits atomically. */
  createWithSplits(expense: NewExpense, splits: NewSplit[]): Promise<any>;
  /**
   * Updates the expense (and replaces its splits when given) atomically, bumping `version`.
   * Resolves to a falsy value when `expectedVersion` no longer matches.
   */
  updateWithSplits(
    id: string,
    patch: ExpensePatch,
    splits: NewSplit[] | null,
    expectedVersion?: number,
  ): Promise<any>;
  /** Soft delete: hidden from lists and balances, but can be restored. */
  softDelete(id: string): Promise<void>;
  restore(id: string): Promise<void>;
}
export const IExpensesRepositoryToken = Symbol('IExpensesRepository');

// ─── Balances Repository ─────────────────────────────────────────────────────
export interface NetBalance {
  userId: string;
  currency: string;
  net: Money;
}

export interface MemberNetBalance extends NetBalance {
  workspaceId: string;
}

export interface SplitRecord {
  expenseId: string;
  userId: string;
  owed: Money;
  paid: Money;
}

export interface SettlementRecord {
  payerId: string;
  payeeId: string;
  amount: Money;
}

export interface IBalancesRepository {
  /** Positive net = the member is owed money; negative = the member owes money. */
  getNetBalances(workspaceId: string): Promise<NetBalance[]>;
  /** Net balances of every member of every workspace that `userId` belongs to. */
  getNetBalancesForMember(userId: string): Promise<MemberNetBalance[]>;
  getSplitRecords(workspaceId: string, currency: string): Promise<SplitRecord[]>;
  getSettlementRecords(workspaceId: string, currency: string): Promise<SettlementRecord[]>;
}
export const IBalancesRepositoryToken = Symbol('IBalancesRepository');

// ─── Settlements Repository ──────────────────────────────────────────────────
export interface ISettlementsRepository {
  create(
    workspaceId: string,
    data: { payerId: string; payeeId: string; amount: string; currency: string; date: Date },
  ): Promise<any>;
  findByWorkspace(workspaceId: string): Promise<any[]>;
}
export const ISettlementsRepositoryToken = Symbol('ISettlementsRepository');

// ─── Users Repository ────────────────────────────────────────────────────────
export interface IUsersRepository {
  findById(id: string): Promise<any>;
  findByIds(ids: string[]): Promise<any[]>;
  findByEmail(email: string): Promise<any>;
  create(data: {
    email: string;
    name: string;
    avatarUrl?: string;
    isRegistered?: boolean;
  }): Promise<any>;
  update(
    id: string,
    data: Partial<{
      name: string;
      avatarUrl: string;
      isRegistered: boolean;
      upiVpa: string | null;
      paypalMe: string | null;
      venmoHandle: string | null;
      mutedNotificationKinds: string[];
    }>,
  ): Promise<any>;
  /** True when both users belong to at least one common workspace (or are the same user). */
  sharesWorkspace(userA: string, userB: string): Promise<boolean>;
}
export const IUsersRepositoryToken = Symbol('IUsersRepository');
