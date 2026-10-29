CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
ALTER TYPE "public"."split_type" ADD VALUE 'SHARES';--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "currency" varchar(3) DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "split_input" jsonb;--> statement-breakpoint
ALTER TABLE "settlements" ADD COLUMN "currency" varchar(3) DEFAULT 'USD' NOT NULL;--> statement-breakpoint
UPDATE "expenses" e SET "currency" = w."default_currency" FROM "workspaces" w WHERE w."id" = e."workspace_id";--> statement-breakpoint
UPDATE "settlements" s SET "currency" = w."default_currency" FROM "workspaces" w WHERE w."id" = s."workspace_id";--> statement-breakpoint
DELETE FROM "expense_splits" a USING "expense_splits" b WHERE a."expense_id" = b."expense_id" AND a."user_id" = b."user_id" AND a."id" > b."id";--> statement-breakpoint
DELETE FROM "workspace_members" a USING "workspace_members" b WHERE a."workspace_id" = b."workspace_id" AND a."user_id" = b."user_id" AND a."id" > b."id";--> statement-breakpoint
CREATE UNIQUE INDEX "expense_splits_expense_user_uq" ON "expense_splits" USING btree ("expense_id","user_id");--> statement-breakpoint
CREATE INDEX "expense_splits_workspace_user_idx" ON "expense_splits" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "expenses_workspace_date_idx" ON "expenses" USING btree ("workspace_id","date" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "expenses_tags_gin_idx" ON "expenses" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "expenses_description_trgm_idx" ON "expenses" USING gin ("description" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "settlements_workspace_idx" ON "settlements" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_members_workspace_user_uq" ON "workspace_members" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "workspace_members_user_idx" ON "workspace_members" USING btree ("user_id");