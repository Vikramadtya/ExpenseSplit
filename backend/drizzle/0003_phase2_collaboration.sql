CREATE TYPE "public"."workspace_type" AS ENUM('GROUP', 'DIRECT');--> statement-breakpoint
CREATE TABLE "expense_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"expense_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"body" varchar(2000) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "type" "workspace_type" DEFAULT 'GROUP' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "direct_key" varchar(73);--> statement-breakpoint
ALTER TABLE "expense_comments" ADD CONSTRAINT "expense_comments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_comments" ADD CONSTRAINT "expense_comments_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_comments" ADD CONSTRAINT "expense_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expense_comments_expense_idx" ON "expense_comments" USING btree ("expense_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "invites_token_hash_uq" ON "invites" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "invites_workspace_idx" ON "invites" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_direct_key_uq" ON "workspaces" USING btree ("direct_key");