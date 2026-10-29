CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"category" varchar(40) DEFAULT 'ALL' NOT NULL,
	"currency" varchar(3) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"created_by_id" uuid NOT NULL,
	"last_alert_percent" integer DEFAULT 0 NOT NULL,
	"last_alert_month" date,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "budgets_scope_uq" ON "budgets" USING btree ("workspace_id","category","currency");