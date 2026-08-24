import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  decimal,
  text,
  primaryKey,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// --- ENUMS ---

export const roleEnum = pgEnum('role', ['ADMIN', 'MEMBER']);
export const splitTypeEnum = pgEnum('split_type', ['EQUAL', 'EXACT', 'PERCENTAGE']);
export const expenseTypeEnum = pgEnum('expense_type', ['EXPENSE', 'TRANSFER']);
export const recurringIntervalEnum = pgEnum('recurring_interval', [
  'NONE',
  'DAILY',
  'WEEKLY',
  'MONTHLY',
]);

// --- TABLES ---

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const workspaceMembers = pgTable('workspace_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: roleEnum('role').default('MEMBER').notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
});

export const groups = pgTable('groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  createdById: uuid('created_by_id')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const groupMembers = pgTable(
  'group_members',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.groupId, t.userId] }),
  }),
);

export const expenses = pgTable('expenses', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  groupId: uuid('group_id')
    .notNull()
    .references(() => groups.id, { onDelete: 'cascade' }),
  createdById: uuid('created_by_id')
    .notNull()
    .references(() => users.id),
  description: varchar('description', { length: 255 }).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  date: timestamp('date').notNull(),
  splitType: splitTypeEnum('split_type').default('EQUAL').notNull(),
  type: expenseTypeEnum('type').default('EXPENSE').notNull(),
  tags: text('tags').array(),
  recurringInterval: recurringIntervalEnum('recurring_interval').default('NONE').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const expenseSplits = pgTable('expense_splits', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  expenseId: uuid('expense_id')
    .notNull()
    .references(() => expenses.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  amountOwed: decimal('amount_owed', { precision: 12, scale: 2 }).notNull().default('0'),
  amountPaid: decimal('amount_paid', { precision: 12, scale: 2 }).notNull().default('0'),
});

export const settlements = pgTable('settlements', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  payerId: uuid('payer_id')
    .notNull()
    .references(() => users.id),
  payeeId: uuid('payee_id')
    .notNull()
    .references(() => users.id),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  date: timestamp('date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- RELATIONS ---

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  members: many(workspaceMembers),
  groups: many(groups),
  expenses: many(expenses),
}));

export const usersRelations = relations(users, ({ many }) => ({
  workspaces: many(workspaceMembers),
  groups: many(groupMembers),
  expensesCreated: many(expenses),
  expenseSplits: many(expenseSplits),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [groups.workspaceId],
    references: [workspaces.id],
  }),
  createdBy: one(users, {
    fields: [groups.createdById],
    references: [users.id],
  }),
  members: many(groupMembers),
  expenses: many(expenses),
}));

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [expenses.workspaceId],
    references: [workspaces.id],
  }),
  group: one(groups, { fields: [expenses.groupId], references: [groups.id] }),
  createdBy: one(users, {
    fields: [expenses.createdById],
    references: [users.id],
  }),
  splits: many(expenseSplits),
}));

export const expenseSplitsRelations = relations(expenseSplits, ({ one }) => ({
  expense: one(expenses, {
    fields: [expenseSplits.expenseId],
    references: [expenses.id],
  }),
  user: one(users, { fields: [expenseSplits.userId], references: [users.id] }),
}));
