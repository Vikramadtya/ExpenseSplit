CREATE TABLE "idempotency_keys" (
	"user_id" uuid NOT NULL,
	"key" varchar(100) NOT NULL,
	"path" varchar(300) NOT NULL,
	"response" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_keys_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;