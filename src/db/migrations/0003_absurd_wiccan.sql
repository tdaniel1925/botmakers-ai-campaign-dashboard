CREATE TYPE "public"."outbound_call_result" AS ENUM('answered', 'no_answer', 'busy', 'failed', 'voicemail', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."outbound_campaign_status" AS ENUM('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."outbound_contact_status" AS ENUM('pending', 'queued', 'calling', 'completed', 'no_answer', 'failed', 'busy', 'voicemail', 'dnc', 'skipped');--> statement-breakpoint
CREATE TABLE "outbound_call_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"vapi_call_id" text,
	"attempt_number" integer NOT NULL,
	"call_result" "outbound_call_result",
	"duration_seconds" integer,
	"transcript" text,
	"transcript_formatted" jsonb,
	"recording_url" text,
	"ai_summary" text,
	"ai_extracted_data" jsonb,
	"raw_payload" jsonb,
	"sms_sent" boolean DEFAULT false NOT NULL,
	"sms_trigger_id" uuid,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbound_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"webhook_uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"status" "outbound_campaign_status" DEFAULT 'draft' NOT NULL,
	"vapi_assistant_id" text,
	"vapi_assistant_name" text,
	"vapi_phone_number_id" text,
	"vapi_phone_number" text,
	"twilio_phone_number" text,
	"twilio_override" boolean DEFAULT false NOT NULL,
	"twilio_account_sid" text,
	"twilio_auth_token" text,
	"max_concurrent_calls" integer DEFAULT 10 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"retry_delay_hours" integer DEFAULT 4 NOT NULL,
	"ai_extraction_hints" jsonb DEFAULT '{}'::jsonb,
	"total_contacts" integer DEFAULT 0 NOT NULL,
	"contacts_called" integer DEFAULT 0 NOT NULL,
	"contacts_answered" integer DEFAULT 0 NOT NULL,
	"contacts_failed" integer DEFAULT 0 NOT NULL,
	"current_step" integer DEFAULT 1 NOT NULL,
	"is_wizard_complete" boolean DEFAULT false NOT NULL,
	"scheduled_start_at" timestamp with time zone,
	"actual_start_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbound_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"phone_number" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text,
	"email" text,
	"company" text,
	"timezone" text,
	"area_code" text,
	"status" "outbound_contact_status" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"next_attempt_at" timestamp with time zone,
	"call_result" "outbound_call_result",
	"call_duration_seconds" integer,
	"custom_fields" jsonb DEFAULT '{}'::jsonb,
	"sms_triggers_fired" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbound_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "outbound_call_logs" ADD CONSTRAINT "outbound_call_logs_campaign_id_outbound_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."outbound_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_call_logs" ADD CONSTRAINT "outbound_call_logs_contact_id_outbound_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."outbound_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_call_logs" ADD CONSTRAINT "outbound_call_logs_sms_trigger_id_sms_triggers_id_fk" FOREIGN KEY ("sms_trigger_id") REFERENCES "public"."sms_triggers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_campaigns" ADD CONSTRAINT "outbound_campaigns_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_contacts" ADD CONSTRAINT "outbound_contacts_campaign_id_outbound_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."outbound_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_schedules" ADD CONSTRAINT "outbound_schedules_campaign_id_outbound_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."outbound_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outbound_call_logs_campaign_idx" ON "outbound_call_logs" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "outbound_call_logs_contact_idx" ON "outbound_call_logs" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "outbound_call_logs_vapi_call_idx" ON "outbound_call_logs" USING btree ("vapi_call_id");--> statement-breakpoint
CREATE INDEX "outbound_call_logs_created_at_idx" ON "outbound_call_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "outbound_campaigns_org_idx" ON "outbound_campaigns" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "outbound_campaigns_status_idx" ON "outbound_campaigns" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "outbound_campaigns_webhook_idx" ON "outbound_campaigns" USING btree ("webhook_uuid");--> statement-breakpoint
CREATE INDEX "outbound_contacts_campaign_idx" ON "outbound_contacts" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "outbound_contacts_status_idx" ON "outbound_contacts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "outbound_contacts_phone_idx" ON "outbound_contacts" USING btree ("phone_number");--> statement-breakpoint
CREATE UNIQUE INDEX "outbound_contacts_campaign_phone_idx" ON "outbound_contacts" USING btree ("campaign_id","phone_number");--> statement-breakpoint
CREATE INDEX "outbound_contacts_next_attempt_idx" ON "outbound_contacts" USING btree ("next_attempt_at");--> statement-breakpoint
CREATE INDEX "outbound_schedules_campaign_idx" ON "outbound_schedules" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "outbound_schedules_day_idx" ON "outbound_schedules" USING btree ("day_of_week");