import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  decimal,
  text,
  pgEnum,
  boolean,
  integer,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
  date as pgDate,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// --- ENUMS ---

export const roleEnum = pgEnum('role', ['ADMIN', 'MEMBER']);
export const workspaceTypeEnum = pgEnum('workspace_type', ['GROUP', 'DIRECT']);
export const splitTypeEnum = pgEnum('split_type', [
  'EQUAL',
  'EXACT',
  'PERCENTAGE',
  'SHARES',
  'ITEMIZED',
]);
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
  isRegistered: boolean('is_registered').default(true).notNull(),
  /** Where friends can pay this person. Optional; shown to people who share a workspace. */
  upiVpa: varchar('upi_vpa', { length: 320 }),
  paypalMe: varchar('paypal_me', { length: 64 }),
  venmoHandle: varchar('venmo_handle', { length: 64 }),
  /** Notification kinds this person has switched off (in-app, push and email alike). */
  mutedNotificationKinds: text('muted_notification_kinds')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    defaultCurrency: varchar('default_currency', { length: 3 }).notNull().default('USD'),
    /** GROUP = shared group; DIRECT = the private ledger between exactly two friends. */
    type: workspaceTypeEnum('type').notNull().default('GROUP'),
    /** For DIRECT ledgers: the two user ids, sorted, so a pair can only have one. */
    directKey: varchar('direct_key', { length: 73 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('workspaces_direct_key_uq').on(t.directKey)],
);

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: roleEnum('role').default('MEMBER').notNull(),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('workspace_members_workspace_user_uq').on(t.workspaceId, t.userId),
    index('workspace_members_user_idx').on(t.userId),
  ],
);

export const recurringRules = pgTable(
  'recurring_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** The expense to repeat (description, amount, split...), minus its date. */
    template: jsonb('template').notNull(),
    interval: recurringIntervalEnum('interval').notNull(),
    startAt: timestamp('start_at').notNull(),
    /** Occurrences created so far; the next one is startAt advanced by this many intervals. */
    runCount: integer('run_count').notNull().default(0),
    nextRunAt: timestamp('next_run_at').notNull(),
    active: boolean('active').notNull().default(true),
    lastError: varchar('last_error', { length: 300 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('recurring_rules_due_idx').on(t.active, t.nextRunAt),
    index('recurring_rules_workspace_idx').on(t.workspaceId),
  ],
);

export const expenses = pgTable(
  'expenses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id),
    description: varchar('description', { length: 255 }).notNull(),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    date: timestamp('date').notNull(),
    splitType: splitTypeEnum('split_type').default('EQUAL').notNull(),
    type: expenseTypeEnum('type').default('EXPENSE').notNull(),
    tags: text('tags').array(),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    category: varchar('category', { length: 40 }).notNull().default('Other'),
    version: integer('version').notNull().default(1),
    splitInput: jsonb('split_input'),
    /** Soft delete: lets "Undo" restore the expense. Excluded from balances and lists. */
    deletedAt: timestamp('deleted_at'),
    /** Set on expenses generated by a recurring rule; unique per occurrence so none repeats. */
    recurringRuleId: uuid('recurring_rule_id').references(() => recurringRules.id, {
      onDelete: 'set null',
    }),
    occurrenceAt: timestamp('occurrence_at'),
    recurringInterval: recurringIntervalEnum('recurring_interval').default('NONE').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('expenses_workspace_date_idx').on(t.workspaceId, t.date.desc(), t.id.desc()),
    index('expenses_tags_gin_idx').using('gin', t.tags),
    uniqueIndex('expenses_rule_occurrence_uq').on(t.recurringRuleId, t.occurrenceAt),
    index('expenses_description_trgm_idx').using('gin', sql`${t.description} gin_trgm_ops`),
  ],
);

export const expenseSplits = pgTable(
  'expense_splits',
  {
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
  },
  (t) => [
    uniqueIndex('expense_splits_expense_user_uq').on(t.expenseId, t.userId),
    index('expense_splits_workspace_user_idx').on(t.workspaceId, t.userId),
  ],
);

export const settlements = pgTable(
  'settlements',
  {
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
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    date: timestamp('date').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('settlements_workspace_idx').on(t.workspaceId)],
);

/** Single-use refresh tokens; only a SHA-256 hash is stored. `familyId` groups one sign-in's chain. */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    familyId: uuid('family_id').notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    revokedAt: timestamp('revoked_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('refresh_tokens_hash_uq').on(t.tokenHash),
    index('refresh_tokens_family_idx').on(t.familyId),
  ],
);

export const expenseComments = pgTable(
  'expense_comments',
  {
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
    body: varchar('body', { length: 2000 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('expense_comments_expense_idx').on(t.expenseId, t.createdAt)],
);

/** Shareable join links. Only a SHA-256 hash of the token is stored. */
export const invites = pgTable(
  'invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    revokedAt: timestamp('revoked_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('invites_token_hash_uq').on(t.tokenHash),
    index('invites_workspace_idx').on(t.workspaceId),
  ],
);

/** Remembers the response to a request with an `Idempotency-Key`, so retries never repeat the write. */
export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 100 }).notNull(),
    path: varchar('path', { length: 300 }).notNull(),
    /** Null while the first request is still running. */
    response: jsonb('response'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);

/** Latest exchange rate per currency pair, refreshed from a rate provider at most twice a day. */
export const fxRates = pgTable(
  'fx_rates',
  {
    base: varchar('base', { length: 3 }).notNull(),
    quote: varchar('quote', { length: 3 }).notNull(),
    rate: decimal('rate', { precision: 18, scale: 8 }).notNull(),
    rateDate: pgDate('rate_date').notNull(),
    fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.base, t.quote] })],
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    /** Who caused it, when someone did (e.g. who nudged). */
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    kind: varchar('kind', { length: 40 }).notNull(),
    payload: jsonb('payload')
      .notNull()
      .default(sql`'{}'::jsonb`),
    readAt: timestamp('read_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.createdAt)],
);

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('push_subscriptions_endpoint_uq').on(t.endpoint)],
);

/** An uploaded receipt photo and what the scanner read from it. */
export const receipts = pgTable(
  'receipts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    uploadedById: uuid('uploaded_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    storageKey: varchar('storage_key', { length: 200 }).notNull(),
    mimeType: varchar('mime_type', { length: 50 }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    /** PROCESSING -> DONE | FAILED */
    status: varchar('status', { length: 12 }).notNull().default('PROCESSING'),
    result: jsonb('result'),
    error: varchar('error', { length: 300 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('receipts_workspace_idx').on(t.workspaceId, t.createdAt)],
);

/** A monthly spending limit for the whole workspace, or for one category. */
export const budgets = pgTable(
  'budgets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    /** A category name, or 'ALL' for everything. */
    category: varchar('category', { length: 40 }).notNull().default('ALL'),
    currency: varchar('currency', { length: 3 }).notNull(),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Highest alert threshold (80 or 100) already sent for `lastAlertMonth`, so nobody is nagged twice. */
    lastAlertPercent: integer('last_alert_percent').notNull().default(0),
    lastAlertMonth: pgDate('last_alert_month'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('budgets_scope_uq').on(t.workspaceId, t.category, t.currency)],
);

// --- RELATIONS ---

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  members: many(workspaceMembers),
  expenses: many(expenses),
}));

export const usersRelations = relations(users, ({ many }) => ({
  workspaces: many(workspaceMembers),
  expensesCreated: many(expenses),
  expenseSplits: many(expenseSplits),
}));

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [expenses.workspaceId],
    references: [workspaces.id],
  }),
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

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMembers.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [workspaceMembers.userId],
    references: [users.id],
  }),
}));

export const settlementsRelations = relations(settlements, ({ one }) => ({
  payer: one(users, {
    fields: [settlements.payerId],
    references: [users.id],
  }),
  payee: one(users, {
    fields: [settlements.payeeId],
    references: [users.id],
  }),
  workspace: one(workspaces, {
    fields: [settlements.workspaceId],
    references: [workspaces.id],
  }),
}));

export const expenseCommentsRelations = relations(expenseComments, ({ one }) => ({
  user: one(users, { fields: [expenseComments.userId], references: [users.id] }),
}));
