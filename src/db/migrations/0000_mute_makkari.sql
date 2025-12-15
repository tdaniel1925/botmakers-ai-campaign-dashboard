CREATE TYPE "public"."call_status" AS ENUM('completed', 'no_answer', 'failed', 'busy', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."campaign_type" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."email_template_type" AS ENUM('credentials', 'welcome', 'marketing', 'password_reset', 'scheduled_report');--> statement-breakpoint
CREATE TYPE "public"."report_frequency" AS ENUM('daily', 'weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."report_scope" AS ENUM('all_campaigns', 'per_campaign');--> statement-breakpoint
CREATE TYPE "public"."sms_status" AS ENUM('pending', 'sent', 'delivered', 'failed');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('phone', 'sms', 'web_form', 'chatbot');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'client_user');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"details" jsonb,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"webhook_uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"campaign_type" "campaign_type" DEFAULT 'inbound' NOT NULL,
	"twilio_phone_number" text,
	"twilio_override" boolean DEFAULT false NOT NULL,
	"twilio_account_sid" text,
	"twilio_auth_token" text,
	"ai_extraction_hints" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"phone_number" text NOT NULL,
	"sms_triggers_fired" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "email_template_type" NOT NULL,
	"subject" text NOT NULL,
	"html_content" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interaction_number" serial NOT NULL,
	"campaign_id" uuid NOT NULL,
	"contact_id" uuid,
	"source_type" "source_type" NOT NULL,
	"source_platform" text,
	"phone_number" text,
	"call_status" "call_status",
	"duration_seconds" integer,
	"transcript" text,
	"transcript_formatted" jsonb,
	"recording_url" text,
	"ai_summary" text,
	"ai_extracted_data" jsonb,
	"raw_payload" jsonb,
	"payload_hash" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"flagged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"contact_email" text,
	"phone" text,
	"address" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interaction_id" uuid,
	"trigger_id" uuid,
	"contact_id" uuid,
	"to_number" text NOT NULL,
	"from_number" text NOT NULL,
	"message" text NOT NULL,
	"status" "sms_status" DEFAULT 'pending' NOT NULL,
	"twilio_sid" text,
	"error_message" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_triggers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"name" text NOT NULL,
	"intent_description" text NOT NULL,
	"sms_message" text NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"role" "user_role" DEFAULT 'client_user' NOT NULL,
	"organization_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"report_frequency" "report_frequency",
	"report_scope" "report_scope",
	"timezone" text DEFAULT 'America/Chicago',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_error_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid,
	"raw_body" text,
	"error_type" text NOT NULL,
	"error_message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_logs" ADD CONSTRAINT "sms_logs_interaction_id_interactions_id_fk" FOREIGN KEY ("interaction_id") REFERENCES "public"."interactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_logs" ADD CONSTRAINT "sms_logs_trigger_id_sms_triggers_id_fk" FOREIGN KEY ("trigger_id") REFERENCES "public"."sms_triggers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_logs" ADD CONSTRAINT "sms_logs_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_triggers" ADD CONSTRAINT "sms_triggers_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_error_logs" ADD CONSTRAINT "webhook_error_logs_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "campaigns_org_idx" ON "campaigns" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "campaigns_webhook_idx" ON "campaigns" USING btree ("webhook_uuid");--> statement-breakpoint
CREATE INDEX "campaigns_active_idx" ON "campaigns" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_campaign_phone_idx" ON "contacts" USING btree ("campaign_id","phone_number");--> statement-breakpoint
CREATE INDEX "email_templates_type_idx" ON "email_templates" USING btree ("type");--> statement-breakpoint
CREATE INDEX "interactions_campaign_idx" ON "interactions" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "interactions_contact_idx" ON "interactions" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "interactions_created_at_idx" ON "interactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "interactions_source_type_idx" ON "interactions" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "interactions_payload_hash_idx" ON "interactions" USING btree ("payload_hash");--> statement-breakpoint
CREATE INDEX "organizations_name_idx" ON "organizations" USING btree ("name");--> statement-breakpoint
CREATE INDEX "organizations_active_idx" ON "organizations" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "sms_logs_interaction_idx" ON "sms_logs" USING btree ("interaction_id");--> statement-breakpoint
CREATE INDEX "sms_logs_trigger_idx" ON "sms_logs" USING btree ("trigger_id");--> statement-breakpoint
CREATE INDEX "sms_logs_status_idx" ON "sms_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sms_triggers_campaign_idx" ON "sms_triggers" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "sms_triggers_priority_idx" ON "sms_triggers" USING btree ("priority");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_org_idx" ON "users" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "webhook_error_logs_campaign_idx" ON "webhook_error_logs" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "webhook_error_logs_created_at_idx" ON "webhook_error_logs" USING btree ("created_at");