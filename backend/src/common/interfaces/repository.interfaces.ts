// ─── Workspace Repository ───────────────────────────────────────────────────
export interface IWorkspacesRepository {
  findAll(userId: string): Promise<any[]>;
  findById(id: string): Promise<any>;
  findByName(name: string): Promise<any>;
  findByUserId(userId: string): Promise<any[]>;
  create(data: { name: string }): Promise<any>;
  addMember(workspaceId: string, userId: string, role?: string): Promise<any>;
  getMembers(workspaceId: string): Promise<any[]>;
}
export const IWorkspacesRepositoryToken = Symbol('IWorkspacesRepository');

// ─── Expenses Repository ─────────────────────────────────────────────────────
export interface IExpensesRepository {
  findByWorkspace(workspaceId: string): Promise<any[]>;
  findById(id: string): Promise<any>;
  create(data: any): Promise<any>;
  update(id: string, data: any): Promise<any>;
  delete(id: string): Promise<void>;
  getSplits(expenseId: string): Promise<any[]>;
}
export const IExpensesRepositoryToken = Symbol('IExpensesRepository');

// ─── Balances Repository ─────────────────────────────────────────────────────
export interface IBalancesRepository {
  getNetBalances(workspaceId: string): Promise<Array<{ userId: string; net: number }>>;
  getExpenseDebts(
    workspaceId: string,
  ): Promise<Array<{ debtor: string; creditor: string; amount: number }>>;
}
export const IBalancesRepositoryToken = Symbol('IBalancesRepository');

// ─── Settlements Repository ──────────────────────────────────────────────────
export interface ISettlementsRepository {
  create(
    workspaceId: string,
    data: { payerId: string; payeeId: string; amount: number; date: string },
  ): Promise<any>;
  findByWorkspace(workspaceId: string): Promise<any[]>;
}
export const ISettlementsRepositoryToken = Symbol('ISettlementsRepository');

// ─── Users Repository ────────────────────────────────────────────────────────
export interface IUsersRepository {
  findById(id: string): Promise<any>;
  findByEmail(email: string): Promise<any>;
  create(data: { email: string; name: string; avatarUrl?: string }): Promise<any>;
  findAll(): Promise<any[]>;
}
export const IUsersRepositoryToken = Symbol('IUsersRepository');
