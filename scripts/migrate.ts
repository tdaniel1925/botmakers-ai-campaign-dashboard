import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL!);

async function migrate() {
  console.log('Starting migration...');

  try {
    // Create enum types
    console.log('Creating enum types...');

    await sql`
      DO $$ BEGIN
        CREATE TYPE "public"."call_status" AS ENUM('completed', 'no_answer', 'failed', 'busy', 'canceled');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;

    await sql`
      DO $$ BEGIN
        CREATE TYPE "public"."campaign_type" AS ENUM('inbound', 'outbound');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;

    await sql`
      DO $$ BEGIN
        CREATE TYPE "public"."email_template_type" AS ENUM('credentials', 'welcome', 'marketing', 'password_reset', 'scheduled_report');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;

    await sql`
      DO $$ BEGIN
        CREATE TYPE "public"."report_frequency" AS ENUM('daily', 'weekly', 'monthly');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;

    await sql`
      DO $$ BEGIN
        CREATE TYPE "public"."report_scope" AS ENUM('all_campaigns', 'per_campaign');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;

    await sql`
      DO $$ BEGIN
        CREATE TYPE "public"."sms_status" AS ENUM('pending', 'sent', 'delivered', 'failed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;

    await sql`
      DO $$ BEGIN
        CREATE TYPE "public"."source_type" AS ENUM('phone', 'sms', 'web_form', 'chatbot');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;

    await sql`
      DO $$ BEGIN
        CREATE TYPE "public"."user_role" AS ENUM('admin', 'client_user');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;

    // Create tables
    console.log('Creating tables...');

    // Organizations (no foreign keys)
    await sql`
      CREATE TABLE IF NOT EXISTS "organizations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "contact_email" text,
        "phone" text,
        "address" text,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `;

    // Users (references organizations)
    await sql`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid PRIMARY KEY NOT NULL,
        "email" text NOT NULL,
        "full_name" text,
        "role" "user_role" DEFAULT 'client_user' NOT NULL,
        "organization_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "must_change_password" boolean DEFAULT false NOT NULL,
        "report_frequency" "report_frequency",
        "report_scope" "report_scope",
        "timezone" text DEFAULT 'America/Chicago',
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `;

    // Campaigns (references organizations)
    await sql`
      CREATE TABLE IF NOT EXISTS "campaigns" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
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
      )
    `;

    // Contacts (references campaigns)
    await sql`
      CREATE TABLE IF NOT EXISTS "contacts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "campaign_id" uuid NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
        "phone_number" text NOT NULL,
        "sms_triggers_fired" jsonb DEFAULT '[]'::jsonb,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `;

    // Interactions (references campaigns and contacts)
    await sql`
      CREATE TABLE IF NOT EXISTS "interactions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "interaction_number" serial NOT NULL,
        "campaign_id" uuid NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
        "contact_id" uuid REFERENCES "contacts"("id") ON DELETE SET NULL,
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
      )
    `;

    // SMS Triggers (references campaigns)
    await sql`
      CREATE TABLE IF NOT EXISTS "sms_triggers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "campaign_id" uuid NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
        "name" text NOT NULL,
        "intent_description" text NOT NULL,
        "sms_message" text NOT NULL,
        "priority" integer DEFAULT 100 NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `;

    // SMS Logs (references interactions, sms_triggers, contacts)
    await sql`
      CREATE TABLE IF NOT EXISTS "sms_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "interaction_id" uuid REFERENCES "interactions"("id") ON DELETE SET NULL,
        "trigger_id" uuid REFERENCES "sms_triggers"("id") ON DELETE SET NULL,
        "contact_id" uuid REFERENCES "contacts"("id") ON DELETE SET NULL,
        "to_number" text NOT NULL,
        "from_number" text NOT NULL,
        "message" text NOT NULL,
        "status" "sms_status" DEFAULT 'pending' NOT NULL,
        "twilio_sid" text,
        "error_message" text,
        "sent_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `;

    // Email Templates (no foreign keys)
    await sql`
      CREATE TABLE IF NOT EXISTS "email_templates" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "type" "email_template_type" NOT NULL,
        "subject" text NOT NULL,
        "html_content" text NOT NULL,
        "is_default" boolean DEFAULT false NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `;

    // Audit Logs (references users)
    await sql`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "action" text NOT NULL,
        "entity_type" text NOT NULL,
        "entity_id" uuid,
        "details" jsonb,
        "ip_address" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `;

    // Webhook Error Logs (references campaigns)
    await sql`
      CREATE TABLE IF NOT EXISTS "webhook_error_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "campaign_id" uuid REFERENCES "campaigns"("id") ON DELETE SET NULL,
        "raw_body" text,
        "error_type" text NOT NULL,
        "error_message" text NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `;

    // Create indexes
    console.log('Creating indexes...');

    await sql`CREATE INDEX IF NOT EXISTS "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id")`;
    await sql`CREATE INDEX IF NOT EXISTS "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id")`;
    await sql`CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at")`;
    await sql`CREATE INDEX IF NOT EXISTS "campaigns_org_idx" ON "campaigns" USING btree ("organization_id")`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "campaigns_webhook_idx" ON "campaigns" USING btree ("webhook_uuid")`;
    await sql`CREATE INDEX IF NOT EXISTS "campaigns_active_idx" ON "campaigns" USING btree ("is_active")`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "contacts_campaign_phone_idx" ON "contacts" USING btree ("campaign_id","phone_number")`;
    await sql`CREATE INDEX IF NOT EXISTS "email_templates_type_idx" ON "email_templates" USING btree ("type")`;
    await sql`CREATE INDEX IF NOT EXISTS "interactions_campaign_idx" ON "interactions" USING btree ("campaign_id")`;
    await sql`CREATE INDEX IF NOT EXISTS "interactions_contact_idx" ON "interactions" USING btree ("contact_id")`;
    await sql`CREATE INDEX IF NOT EXISTS "interactions_created_at_idx" ON "interactions" USING btree ("created_at")`;
    await sql`CREATE INDEX IF NOT EXISTS "interactions_source_type_idx" ON "interactions" USING btree ("source_type")`;
    await sql`CREATE INDEX IF NOT EXISTS "interactions_payload_hash_idx" ON "interactions" USING btree ("payload_hash")`;
    await sql`CREATE INDEX IF NOT EXISTS "organizations_name_idx" ON "organizations" USING btree ("name")`;
    await sql`CREATE INDEX IF NOT EXISTS "organizations_active_idx" ON "organizations" USING btree ("is_active")`;
    await sql`CREATE INDEX IF NOT EXISTS "sms_logs_interaction_idx" ON "sms_logs" USING btree ("interaction_id")`;
    await sql`CREATE INDEX IF NOT EXISTS "sms_logs_trigger_idx" ON "sms_logs" USING btree ("trigger_id")`;
    await sql`CREATE INDEX IF NOT EXISTS "sms_logs_status_idx" ON "sms_logs" USING btree ("status")`;
    await sql`CREATE INDEX IF NOT EXISTS "sms_triggers_campaign_idx" ON "sms_triggers" USING btree ("campaign_id")`;
    await sql`CREATE INDEX IF NOT EXISTS "sms_triggers_priority_idx" ON "sms_triggers" USING btree ("priority")`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "users" USING btree ("email")`;
    await sql`CREATE INDEX IF NOT EXISTS "users_org_idx" ON "users" USING btree ("organization_id")`;
    await sql`CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users" USING btree ("role")`;
    await sql`CREATE INDEX IF NOT EXISTS "webhook_error_logs_campaign_idx" ON "webhook_error_logs" USING btree ("campaign_id")`;
    await sql`CREATE INDEX IF NOT EXISTS "webhook_error_logs_created_at_idx" ON "webhook_error_logs" USING btree ("created_at")`;

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

migrate().catch(console.error);
