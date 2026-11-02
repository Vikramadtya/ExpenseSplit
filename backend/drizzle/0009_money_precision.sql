ALTER TABLE "budgets" ALTER COLUMN "amount" SET DATA TYPE numeric(16, 4);--> statement-breakpoint
ALTER TABLE "expense_splits" ALTER COLUMN "amount_owed" SET DATA TYPE numeric(16, 4);--> statement-breakpoint
ALTER TABLE "expense_splits" ALTER COLUMN "amount_owed" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "expense_splits" ALTER COLUMN "amount_paid" SET DATA TYPE numeric(16, 4);--> statement-breakpoint
ALTER TABLE "expense_splits" ALTER COLUMN "amount_paid" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "amount" SET DATA TYPE numeric(16, 4);--> statement-breakpoint
ALTER TABLE "settlements" ALTER COLUMN "amount" SET DATA TYPE numeric(16, 4);