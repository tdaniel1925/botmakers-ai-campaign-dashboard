-- ============================================
-- CRM System Migration
-- Complete Contact Relationship Management for Admin
-- Version: 1.0.0
-- Date: December 2025
-- ============================================

-- ============================================
-- 1. CRM Contacts Table (Master Contact Database)
-- ============================================
CREATE TABLE IF NOT EXISTS crm_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,

  -- Basic Info
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT, -- E.164 format
  phone_secondary TEXT,

  -- Company Info
  company TEXT,
  job_title TEXT,
  website TEXT,

  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'US',

  -- Timezone (auto-detected from phone or manual)
  timezone TEXT,

  -- Lead/Contact Status
  status TEXT NOT NULL DEFAULT 'lead', -- lead, prospect, customer, inactive, do_not_contact
  lead_source TEXT, -- website, referral, campaign, import, manual, etc.
  lead_score INTEGER DEFAULT 0, -- 0-100 scoring

  -- Pipeline Stage
  pipeline_stage TEXT DEFAULT 'new', -- new, contacted, qualified, proposal, negotiation, won, lost
  pipeline_stage_changed_at TIMESTAMP WITH TIME ZONE,

  -- Assignment
  assigned_to UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP WITH TIME ZONE,

  -- Engagement Stats
  last_contacted_at TIMESTAMP WITH TIME ZONE,
  last_email_at TIMESTAMP WITH TIME ZONE,
  last_sms_at TIMESTAMP WITH TIME ZONE,
  last_call_at TIMESTAMP WITH TIME ZONE,
  total_emails_sent INTEGER DEFAULT 0,
  total_sms_sent INTEGER DEFAULT 0,
  total_calls INTEGER DEFAULT 0,

  -- Custom Fields (flexible JSON storage)
  custom_fields JSONB DEFAULT '{}',

  -- Tags (for segmentation)
  tags TEXT[] DEFAULT '{}',

  -- Notes
  notes TEXT,

  -- Opt-out Preferences
  do_not_contact BOOLEAN DEFAULT false,
  do_not_email BOOLEAN DEFAULT false,
  do_not_sms BOOLEAN DEFAULT false,
  do_not_call BOOLEAN DEFAULT false,

  -- Deduplication
  UNIQUE(client_id, email),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for crm_contacts
CREATE INDEX IF NOT EXISTS idx_crm_contacts_client ON crm_contacts(client_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_email ON crm_contacts(email);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_phone ON crm_contacts(phone);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_status ON crm_contacts(client_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_pipeline ON crm_contacts(client_id, pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_assigned ON crm_contacts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_tags ON crm_contacts USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_search ON crm_contacts USING GIN(
  to_tsvector('english', COALESCE(first_name, '') || ' ' || COALESCE(last_name, '') || ' ' || COALESCE(email, '') || ' ' || COALESCE(company, ''))
);

-- Comments
COMMENT ON TABLE crm_contacts IS 'Master CRM contact database with lead scoring and pipeline management';
COMMENT ON COLUMN crm_contacts.lead_score IS 'Score from 0-100 based on engagement and qualification';
COMMENT ON COLUMN crm_contacts.custom_fields IS 'Flexible JSON storage for custom contact attributes';

-- ============================================
-- 2. CRM Activities Table (Contact History)
-- ============================================
CREATE TABLE IF NOT EXISTS crm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,

  -- Activity Type
  activity_type TEXT NOT NULL, -- email_sent, email_received, sms_sent, sms_received, call_made, call_received, note, meeting, task, stage_change, tag_added, tag_removed

  -- Activity Details
  subject TEXT, -- Email subject or activity title
  body TEXT, -- Email/SMS body or note content

  -- Related Records
  related_type TEXT, -- campaign, outbound_campaign, email, sms, call
  related_id UUID,

  -- For emails
  email_from TEXT,
  email_to TEXT,
  email_cc TEXT,
  email_message_id TEXT, -- For threading
  email_status TEXT, -- sent, delivered, opened, clicked, bounced, failed

  -- For SMS
  sms_from TEXT,
  sms_to TEXT,
  sms_status TEXT, -- sent, delivered, failed
  sms_segments INTEGER,

  -- For calls
  call_direction TEXT, -- inbound, outbound
  call_duration INTEGER, -- seconds
  call_outcome TEXT, -- answered, no_answer, voicemail, busy
  call_recording_url TEXT,

  -- Performer
  performed_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  performed_by_name TEXT, -- Cached for display

  -- Automation flag
  is_automated BOOLEAN DEFAULT false,

  -- Additional metadata
  metadata JSONB DEFAULT '{}',
  completed_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for crm_activities
CREATE INDEX IF NOT EXISTS idx_crm_activities_contact ON crm_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_client ON crm_activities(client_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_type ON crm_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_crm_activities_performed ON crm_activities(performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_activities_related ON crm_activities(related_type, related_id);

-- Comments
COMMENT ON TABLE crm_activities IS 'Complete activity history for CRM contacts';

-- ============================================
-- 3. CRM Tags Table
-- ============================================
CREATE TABLE IF NOT EXISTS crm_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,

  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1', -- Hex color
  description TEXT,

  -- Usage count (denormalized for performance)
  contact_count INTEGER DEFAULT 0,

  UNIQUE(client_id, name),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_crm_tags_client ON crm_tags(client_id);

-- Comments
COMMENT ON TABLE crm_tags IS 'Tags for CRM contact segmentation';

-- ============================================
-- 4. CRM Lists/Segments Table
-- ============================================
CREATE TABLE IF NOT EXISTS crm_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,

  name TEXT NOT NULL,
  description TEXT,

  -- List Type
  list_type TEXT NOT NULL DEFAULT 'static', -- static (manual), dynamic (filter-based)

  -- For dynamic lists - filter criteria
  filter_criteria JSONB, -- {status: ['lead'], tags: ['hot'], pipeline_stage: ['qualified']}

  -- Stats
  contact_count INTEGER DEFAULT 0,
  last_synced_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Static list membership
CREATE TABLE IF NOT EXISTS crm_list_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID REFERENCES crm_lists(id) ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE CASCADE NOT NULL,

  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  added_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,

  UNIQUE(list_id, contact_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crm_lists_client ON crm_lists(client_id);
CREATE INDEX IF NOT EXISTS idx_crm_list_members_list ON crm_list_members(list_id);
CREATE INDEX IF NOT EXISTS idx_crm_list_members_contact ON crm_list_members(contact_id);

-- ============================================
-- 5. CRM Email Templates Table
-- ============================================
CREATE TABLE IF NOT EXISTS crm_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT, -- Plain text version

  -- Template variables supported
  -- {{first_name}}, {{last_name}}, {{email}}, {{company}}, {{custom.field_name}}

  -- Category
  category TEXT DEFAULT 'general', -- general, follow_up, introduction, proposal, etc.

  -- Usage stats
  use_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,

  -- Is this a system template (available to all clients)?
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_crm_email_templates_client ON crm_email_templates(client_id);

-- ============================================
-- 6. CRM SMS Templates Table
-- ============================================
CREATE TABLE IF NOT EXISTS crm_sms_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  message TEXT NOT NULL, -- Max ~160 chars for single segment
  character_count INTEGER,

  -- Template variables supported
  -- {{first_name}}, {{last_name}}, {{company}}, {{custom.field_name}}

  -- Category
  category TEXT DEFAULT 'general',

  -- Usage stats
  use_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,

  -- Is this a system template?
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_crm_sms_templates_client ON crm_sms_templates(client_id);

-- ============================================
-- 7. CRM Email Queue Table
-- ============================================
CREATE TABLE IF NOT EXISTS crm_email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE CASCADE NOT NULL,

  -- Email content
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT NOT NULL,
  to_name TEXT,
  reply_to TEXT,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT,

  -- Template used (if any)
  template_id UUID REFERENCES crm_email_templates(id) ON DELETE SET NULL,

  -- Scheduling
  scheduled_at TIMESTAMP WITH TIME ZONE,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending', -- pending, scheduled, sending, sent, delivered, opened, clicked, bounced, failed

  -- Resend integration
  resend_id TEXT,
  resend_status TEXT,

  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Tracking
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  bounced_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  sent_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crm_email_queue_client ON crm_email_queue(client_id);
CREATE INDEX IF NOT EXISTS idx_crm_email_queue_contact ON crm_email_queue(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_email_queue_status ON crm_email_queue(status);
CREATE INDEX IF NOT EXISTS idx_crm_email_queue_scheduled ON crm_email_queue(scheduled_at) WHERE status IN ('pending', 'scheduled');
CREATE INDEX IF NOT EXISTS idx_crm_email_queue_resend ON crm_email_queue(resend_id);

-- ============================================
-- 8. CRM SMS Queue Table
-- ============================================
CREATE TABLE IF NOT EXISTS crm_sms_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE CASCADE NOT NULL,

  -- SMS content
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  message TEXT NOT NULL,

  -- Template used (if any)
  template_id UUID REFERENCES crm_sms_templates(id) ON DELETE SET NULL,

  -- Scheduling
  scheduled_at TIMESTAMP WITH TIME ZONE,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending', -- pending, scheduled, sending, sent, delivered, failed

  -- Twilio integration
  twilio_sid TEXT,
  twilio_status TEXT,

  -- Segments and cost
  segments INTEGER DEFAULT 1,
  cost DECIMAL(10, 4),

  -- Error handling
  error_code TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Metadata
  sent_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crm_sms_queue_client ON crm_sms_queue(client_id);
CREATE INDEX IF NOT EXISTS idx_crm_sms_queue_contact ON crm_sms_queue(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_sms_queue_status ON crm_sms_queue(status);
CREATE INDEX IF NOT EXISTS idx_crm_sms_queue_scheduled ON crm_sms_queue(scheduled_at) WHERE status IN ('pending', 'scheduled');
CREATE INDEX IF NOT EXISTS idx_crm_sms_queue_twilio ON crm_sms_queue(twilio_sid);

-- ============================================
-- 9. CRM Import Jobs Table
-- ============================================
CREATE TABLE IF NOT EXISTS crm_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,

  -- File info
  file_name TEXT NOT NULL,
  file_size INTEGER,

  -- Mapping configuration
  column_mapping JSONB NOT NULL, -- {csv_column: db_field}

  -- Import settings
  update_existing BOOLEAN DEFAULT false, -- Update if email/phone exists
  default_status TEXT DEFAULT 'lead',
  default_tags TEXT[],
  default_lead_source TEXT DEFAULT 'import',

  -- Progress
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  total_rows INTEGER DEFAULT 0,
  processed_rows INTEGER DEFAULT 0,
  created_count INTEGER DEFAULT 0,
  updated_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,

  -- Errors
  errors JSONB DEFAULT '[]', -- [{row: 5, field: 'email', error: 'Invalid format'}]

  -- Metadata
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_crm_import_jobs_client ON crm_import_jobs(client_id);

-- ============================================
-- 10. Link CRM Contacts to Campaign Contacts
-- ============================================
-- Add CRM contact reference to campaign_contacts
ALTER TABLE campaign_contacts
ADD COLUMN IF NOT EXISTS crm_contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_campaign_contacts_crm ON campaign_contacts(crm_contact_id);

-- ============================================
-- 11. RLS Policies for CRM Tables
-- ============================================

-- CRM Contacts RLS
ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_crm_contacts"
  ON crm_contacts FOR ALL TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- CRM Activities RLS
ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_crm_activities"
  ON crm_activities FOR ALL TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- CRM Tags RLS
ALTER TABLE crm_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_crm_tags"
  ON crm_tags FOR ALL TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- CRM Lists RLS
ALTER TABLE crm_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_crm_lists"
  ON crm_lists FOR ALL TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- CRM List Members RLS
ALTER TABLE crm_list_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_crm_list_members"
  ON crm_list_members FOR ALL TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- CRM Email Templates RLS
ALTER TABLE crm_email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_crm_email_templates"
  ON crm_email_templates FOR ALL TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- CRM SMS Templates RLS
ALTER TABLE crm_sms_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_crm_sms_templates"
  ON crm_sms_templates FOR ALL TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- CRM Email Queue RLS
ALTER TABLE crm_email_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_crm_email_queue"
  ON crm_email_queue FOR ALL TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- CRM SMS Queue RLS
ALTER TABLE crm_sms_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_crm_sms_queue"
  ON crm_sms_queue FOR ALL TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- CRM Import Jobs RLS
ALTER TABLE crm_import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_crm_import_jobs"
  ON crm_import_jobs FOR ALL TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- ============================================
-- 12. Helper Functions
-- ============================================

-- Function to update contact stats after activity
CREATE OR REPLACE FUNCTION update_crm_contact_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.activity_type = 'email_sent' THEN
    UPDATE crm_contacts SET
      total_emails_sent = total_emails_sent + 1,
      last_email_at = NEW.performed_at,
      last_contacted_at = NEW.performed_at,
      updated_at = NOW()
    WHERE id = NEW.contact_id;
  ELSIF NEW.activity_type = 'sms_sent' THEN
    UPDATE crm_contacts SET
      total_sms_sent = total_sms_sent + 1,
      last_sms_at = NEW.performed_at,
      last_contacted_at = NEW.performed_at,
      updated_at = NOW()
    WHERE id = NEW.contact_id;
  ELSIF NEW.activity_type IN ('call_made', 'call_received') THEN
    UPDATE crm_contacts SET
      total_calls = total_calls + 1,
      last_call_at = NEW.performed_at,
      last_contacted_at = NEW.performed_at,
      updated_at = NOW()
    WHERE id = NEW.contact_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for contact stats
DROP TRIGGER IF EXISTS trg_update_crm_contact_stats ON crm_activities;
CREATE TRIGGER trg_update_crm_contact_stats
  AFTER INSERT ON crm_activities
  FOR EACH ROW
  EXECUTE FUNCTION update_crm_contact_stats();

-- Function to update tag counts
CREATE OR REPLACE FUNCTION update_crm_tag_counts()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate counts for affected tags
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE crm_tags SET
      contact_count = (
        SELECT COUNT(*) FROM crm_contacts
        WHERE client_id = crm_tags.client_id
        AND crm_tags.name = ANY(tags)
      ),
      updated_at = NOW()
    WHERE client_id = NEW.client_id;
  END IF;

  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    UPDATE crm_tags SET
      contact_count = (
        SELECT COUNT(*) FROM crm_contacts
        WHERE client_id = crm_tags.client_id
        AND crm_tags.name = ANY(tags)
      ),
      updated_at = NOW()
    WHERE client_id = OLD.client_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger for tag counts
DROP TRIGGER IF EXISTS trg_update_crm_tag_counts ON crm_contacts;
CREATE TRIGGER trg_update_crm_tag_counts
  AFTER INSERT OR UPDATE OF tags OR DELETE ON crm_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_crm_tag_counts();

-- ============================================
-- 13. Insert Default System Templates
-- ============================================

-- Default Email Templates
INSERT INTO crm_email_templates (id, client_id, name, subject, html_body, text_body, category, is_system)
VALUES
  (gen_random_uuid(), NULL, 'Welcome Email', 'Welcome to {{company}}!',
   '<h1>Welcome, {{first_name}}!</h1><p>We''re excited to have you on board.</p><p>Best regards,<br>The Team</p>',
   'Welcome, {{first_name}}!\n\nWe''re excited to have you on board.\n\nBest regards,\nThe Team',
   'introduction', true),
  (gen_random_uuid(), NULL, 'Follow Up', 'Following up on our conversation',
   '<p>Hi {{first_name}},</p><p>I wanted to follow up on our recent conversation. Do you have any questions I can help answer?</p><p>Best,</p>',
   'Hi {{first_name}},\n\nI wanted to follow up on our recent conversation. Do you have any questions I can help answer?\n\nBest,',
   'follow_up', true),
  (gen_random_uuid(), NULL, 'Thank You', 'Thank you, {{first_name}}!',
   '<p>Hi {{first_name}},</p><p>Thank you for your time today. I appreciate the opportunity to speak with you.</p><p>Looking forward to connecting again soon.</p>',
   'Hi {{first_name}},\n\nThank you for your time today. I appreciate the opportunity to speak with you.\n\nLooking forward to connecting again soon.',
   'follow_up', true)
ON CONFLICT DO NOTHING;

-- Default SMS Templates
INSERT INTO crm_sms_templates (id, client_id, name, message, category, is_system)
VALUES
  (gen_random_uuid(), NULL, 'Quick Follow Up', 'Hi {{first_name}}, just following up on our conversation. Let me know if you have any questions!', 'follow_up', true),
  (gen_random_uuid(), NULL, 'Appointment Reminder', 'Hi {{first_name}}, this is a reminder about your upcoming appointment. Reply CONFIRM to confirm.', 'reminder', true),
  (gen_random_uuid(), NULL, 'Thank You', 'Thank you {{first_name}}! We appreciate your business.', 'general', true)
ON CONFLICT DO NOTHING;

-- ============================================
-- Summary
-- ============================================
-- CRM System Tables:
-- - crm_contacts: Master contact database with full profile
-- - crm_activities: Complete activity history
-- - crm_tags: Contact segmentation tags
-- - crm_lists: Static and dynamic contact lists
-- - crm_list_members: List membership
-- - crm_email_templates: Reusable email templates
-- - crm_sms_templates: Reusable SMS templates
-- - crm_email_queue: Email sending queue with Resend
-- - crm_sms_queue: SMS sending queue with Twilio
-- - crm_import_jobs: CSV import tracking
