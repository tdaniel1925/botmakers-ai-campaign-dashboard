ALTER TABLE "sales_users" ADD COLUMN "must_change_password" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_users" ADD COLUMN "has_seen_welcome" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "has_sales_access" boolean DEFAULT false NOT NULL;