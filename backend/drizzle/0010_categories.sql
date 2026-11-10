CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(40) NOT NULL,
	"icon" varchar(16) DEFAULT '📦' NOT NULL,
	"parent_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_workspace_name_uq" ON "categories" USING btree ("workspace_id",lower("name"));--> statement-breakpoint
-- Tags are now stored lower-case so "Trip" and "trip" are one tag.
UPDATE "expenses"
   SET "tags" = ARRAY(SELECT DISTINCT lower(t) FROM unnest("tags") AS t)
 WHERE "tags" IS NOT NULL AND cardinality("tags") > 0;
