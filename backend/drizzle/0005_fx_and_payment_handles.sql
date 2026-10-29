CREATE TABLE "fx_rates" (
	"base" varchar(3) NOT NULL,
	"quote" varchar(3) NOT NULL,
	"rate" numeric(18, 8) NOT NULL,
	"rate_date" date NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fx_rates_base_quote_pk" PRIMARY KEY("base","quote")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "upi_vpa" varchar(320);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "paypal_me" varchar(64);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "venmo_handle" varchar(64);