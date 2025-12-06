-- ============================================
-- Outbound Campaigns Migration
-- AI-Powered Outbound Calling Campaign Feature
-- Version: 1.0.0
-- Date: December 2025
-- ============================================
-- This migration creates all tables needed for the outbound calling campaign feature.
-- Run this in Supabase SQL Editor or via CLI.
-- ============================================

-- ============================================
-- 1. Extend existing campaigns table with campaign_type
-- ============================================
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS campaign_type TEXT DEFAULT 'inbound'; -- 'inbound' (webhook-based) or 'outbound'

-- Add comment for documentation
COMMENT ON COLUMN campaigns.campaign_type IS 'Type of campaign: inbound (receives webhooks) or outbound (makes calls)';

-- ============================================
-- 2. Outbound Campaigns Table
-- Main configuration table for outbound calling campaigns
-- ============================================
CREATE TABLE IF NOT EXISTS outbound_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  -- Status: draft, active, paused, stopped, completed
  status TEXT NOT NULL DEFAULT 'draft',

  -- Vapi Integration
  vapi_assistant_id TEXT, -- Created on campaign launch

  -- Phone Number (FK to campaign_phone_numbers)
  phone_number_id UUID,

  -- Billing Configuration
  rate_per_minute DECIMAL(10, 4) NOT NULL DEFAULT 0.05, -- $/minute
  billing_threshold DECIMAL(10, 2) NOT NULL DEFAULT 50.00, -- Charge when balance reaches this
  running_cost DECIMAL(10, 2) DEFAULT 0, -- Current unbilled cost

  -- Call Limits
  max_concurrent_calls INTEGER DEFAULT 50,

  -- Retry Settings
  retry_enabled BOOLEAN DEFAULT true,
  retry_attempts INTEGER DEFAULT 2,
  retry_delay_minutes INTEGER DEFAULT 60, -- Minutes between retries

  -- Test Mode
  is_test_mode BOOLEAN DEFAULT false,
  test_call_limit INTEGER DEFAULT 10,
  test_calls_made INTEGER DEFAULT 0,

  -- Compliance Certification
  certification_accepted BOOLEAN DEFAULT false,
  certification_initials TEXT,
  certification_timestamp TIMESTAMP WITH TIME ZONE,
  certification_ip_address TEXT,

  -- AI Agent Configuration (from questionnaire)
  agent_config JSONB DEFAULT '{}', -- Voice, personality, system prompt, first message, etc.

  -- Structured Data Schema (fields to extract from calls)
  structured_data_schema JSONB DEFAULT '[]', -- Array of {name, type, description}

  -- Stats
  total_contacts INTEGER DEFAULT 0,
  contacts_called INTEGER DEFAULT 0,
  contacts_completed INTEGER DEFAULT 0,
  total_minutes DECIMAL(12, 2) DEFAULT 0,
  total_cost DECIMAL(12, 2) DEFAULT 0,
  positive_outcomes INTEGER DEFAULT 0,
  negative_outcomes INTEGER DEFAULT 0,

  -- Timestamps
  launched_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for outbound_campaigns
CREATE INDEX IF NOT EXISTS idx_outbound_campaigns_client ON outbound_campaigns(client_id);
CREATE INDEX IF NOT EXISTS idx_outbound_campaigns_status ON outbound_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_outbound_campaigns_vapi ON outbound_campaigns(vapi_assistant_id);

-- Comments
COMMENT ON TABLE outbound_campaigns IS 'AI-powered outbound calling campaigns with Vapi integration';
COMMENT ON COLUMN outbound_campaigns.agent_config IS 'Vapi assistant configuration: voice, personality, systemPrompt, firstMessage, endCallConditions, etc.';
COMMENT ON COLUMN outbound_campaigns.structured_data_schema IS 'Schema for data extraction: [{name: "interested", type: "boolean", description: "..."}]';

-- ============================================
-- 3. Campaign Schedules Table
-- Granular scheduling control per campaign
-- ============================================
CREATE TABLE IF NOT EXISTS campaign_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES outbound_campaigns(id) ON DELETE CASCADE NOT NULL,

  -- Days of week (0=Sunday, 1=Monday, ... 6=Saturday)
  days_of_week INTEGER[] DEFAULT ARRAY[1,2,3,4,5], -- Mon-Fri by default

  -- Daily calling window (in campaign timezone)
  start_time TIME NOT NULL DEFAULT '09:00:00',
  end_time TIME NOT NULL DEFAULT '17:00:00',

  -- Timezone (IANA format)
  timezone TEXT NOT NULL DEFAULT 'America/New_York',

  -- Optional date restrictions
  specific_dates DATE[], -- Only run on these dates (if set)
  excluded_dates DATE[], -- Never run on these dates

  -- Is this schedule currently active
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for campaign lookup
CREATE INDEX IF NOT EXISTS idx_campaign_schedules_campaign ON campaign_schedules(campaign_id);

-- Comments
COMMENT ON TABLE campaign_schedules IS 'Scheduling configuration for outbound campaigns';
COMMENT ON COLUMN campaign_schedules.days_of_week IS 'Array of weekday numbers: 0=Sunday through 6=Saturday';
COMMENT ON COLUMN campaign_schedules.timezone IS 'IANA timezone identifier (e.g., America/Chicago, Europe/London)';

-- ============================================
-- 4. Campaign Contacts Table
-- Contacts to be called with auto-detected timezone
-- ============================================
CREATE TABLE IF NOT EXISTS campaign_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES outbound_campaigns(id) ON DELETE CASCADE NOT NULL,

  -- Contact Info
  phone_number TEXT NOT NULL, -- E.164 format (+1234567890)
  first_name TEXT,
  last_name TEXT,
  email TEXT,

  -- Timezone Detection
  area_code TEXT, -- Extracted from phone number
  timezone TEXT, -- Auto-detected from area code (IANA format)

  -- Call Status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, failed, do_not_call
  call_attempts INTEGER DEFAULT 0,
  last_call_at TIMESTAMP WITH TIME ZONE,
  next_call_at TIMESTAMP WITH TIME ZONE, -- Scheduled time for next attempt

  -- Outcome
  outcome TEXT, -- positive, negative, no_answer, voicemail

  -- Custom Data (from CSV upload)
  custom_data JSONB DEFAULT '{}',

  -- Deduplication
  UNIQUE(campaign_id, phone_number),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for campaign_contacts
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_campaign ON campaign_contacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_status ON campaign_contacts(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_next_call ON campaign_contacts(next_call_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_phone ON campaign_contacts(phone_number);

-- Comments
COMMENT ON TABLE campaign_contacts IS 'Contacts assigned to outbound campaigns with auto-detected timezone';
COMMENT ON COLUMN campaign_contacts.phone_number IS 'Phone number in E.164 format (+1234567890)';
COMMENT ON COLUMN campaign_contacts.timezone IS 'Auto-detected IANA timezone from area code';
COMMENT ON COLUMN campaign_contacts.custom_data IS 'Additional fields from CSV import';

-- ============================================
-- 5. Campaign Calls Table
-- Individual outbound call records
-- ============================================
CREATE TABLE IF NOT EXISTS campaign_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES outbound_campaigns(id) ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES campaign_contacts(id) ON DELETE CASCADE NOT NULL,

  -- Vapi Integration
  vapi_call_id TEXT, -- Vapi's call identifier

  -- Call Status
  status TEXT NOT NULL DEFAULT 'initiated', -- initiated, ringing, in_progress, answered, no_answer, busy, failed, voicemail

  -- Outcome (determined by AI or structured data)
  outcome TEXT, -- positive, negative, null (if not answered)

  -- Call Metrics
  duration_seconds INTEGER DEFAULT 0,
  cost DECIMAL(10, 4) DEFAULT 0, -- Calculated: (duration/60) * rate_per_minute

  -- Vapi Data
  transcript TEXT,
  summary TEXT, -- AI-generated summary from Vapi
  structured_data JSONB, -- Extracted data based on campaign schema
  recording_url TEXT,

  -- Error Handling
  error_code TEXT,
  error_message TEXT,

  -- Retry Tracking
  attempt_number INTEGER DEFAULT 1,

  -- Timestamps
  initiated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  answered_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for campaign_calls
CREATE INDEX IF NOT EXISTS idx_campaign_calls_campaign ON campaign_calls(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_calls_contact ON campaign_calls(contact_id);
CREATE INDEX IF NOT EXISTS idx_campaign_calls_vapi ON campaign_calls(vapi_call_id);
CREATE INDEX IF NOT EXISTS idx_campaign_calls_status ON campaign_calls(status);
CREATE INDEX IF NOT EXISTS idx_campaign_calls_outcome ON campaign_calls(campaign_id, outcome);
CREATE INDEX IF NOT EXISTS idx_campaign_calls_created ON campaign_calls(created_at DESC);

-- Comments
COMMENT ON TABLE campaign_calls IS 'Individual outbound call records with Vapi integration';
COMMENT ON COLUMN campaign_calls.structured_data IS 'Data extracted from call based on campaign structured_data_schema';

-- ============================================
-- 6. Campaign SMS Table
-- SMS messages sent as follow-up to calls
-- ============================================
CREATE TABLE IF NOT EXISTS campaign_sms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES outbound_campaigns(id) ON DELETE CASCADE NOT NULL,
  call_id UUID REFERENCES campaign_calls(id) ON DELETE SET NULL, -- May be sent without a call
  contact_id UUID REFERENCES campaign_contacts(id) ON DELETE CASCADE NOT NULL,
  template_id UUID, -- FK to campaign_sms_templates

  -- Trigger Info
  trigger_outcome TEXT, -- What triggered this SMS (positive, negative, link_requested, etc.)

  -- Message Content
  message_body TEXT NOT NULL,

  -- Twilio Tracking
  twilio_sid TEXT,
  twilio_status TEXT, -- queued, sent, delivered, undelivered, failed
  twilio_error_code TEXT,
  twilio_error_message TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'queued', -- queued, sent, delivered, failed

  -- Cost
  segment_count INTEGER DEFAULT 1,
  cost DECIMAL(10, 4),

  -- Timestamps
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaign_sms_campaign ON campaign_sms(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sms_call ON campaign_sms(call_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sms_contact ON campaign_sms(contact_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sms_status ON campaign_sms(status);
CREATE INDEX IF NOT EXISTS idx_campaign_sms_twilio ON campaign_sms(twilio_sid);

-- Comments
COMMENT ON TABLE campaign_sms IS 'SMS messages sent as follow-up to outbound calls';

-- ============================================
-- 7. Campaign SMS Templates Table
-- Templates for SMS follow-up messages
-- ============================================
CREATE TABLE IF NOT EXISTS campaign_sms_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES outbound_campaigns(id) ON DELETE CASCADE NOT NULL,

  -- Template Config
  name TEXT NOT NULL, -- Display name (e.g., "Positive Call Follow-up")
  trigger_type TEXT NOT NULL, -- positive_call, negative_call, no_answer, link_requested, custom

  -- Template Body (supports {{variables}})
  template_body TEXT NOT NULL, -- e.g., "Hi {{first_name}}, thanks for your interest! Here's your link: {{link}}"

  -- Optional link to include
  link_url TEXT, -- URL to include in message (replaces {{link}})

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Usage Stats
  send_count INTEGER DEFAULT 0,
  last_sent_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaign_sms_templates_campaign ON campaign_sms_templates(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sms_templates_trigger ON campaign_sms_templates(campaign_id, trigger_type);

-- Comments
COMMENT ON TABLE campaign_sms_templates IS 'SMS templates for campaign follow-up messages';
COMMENT ON COLUMN campaign_sms_templates.template_body IS 'SMS body with variable placeholders: {{first_name}}, {{last_name}}, {{link}}, {{company}}';

-- ============================================
-- 8. Campaign Phone Numbers Table
-- Phone numbers assigned to campaigns
-- ============================================
CREATE TABLE IF NOT EXISTS campaign_phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES outbound_campaigns(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE, -- Can be shared across campaigns

  -- Phone Number
  phone_number TEXT NOT NULL, -- E.164 format
  friendly_name TEXT, -- Display name

  -- Provider
  provider TEXT NOT NULL DEFAULT 'twilio', -- twilio, vapi

  -- Provider IDs
  twilio_sid TEXT, -- Twilio phone number SID
  vapi_phone_id TEXT, -- Vapi phone number ID

  -- Provisioning
  is_provisioned BOOLEAN DEFAULT false, -- true if auto-provisioned by system

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Capabilities
  capabilities JSONB DEFAULT '{"voice": true, "sms": true}',

  -- Usage Stats
  calls_made INTEGER DEFAULT 0,
  sms_sent INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaign_phone_numbers_campaign ON campaign_phone_numbers(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_phone_numbers_client ON campaign_phone_numbers(client_id);
CREATE INDEX IF NOT EXISTS idx_campaign_phone_numbers_phone ON campaign_phone_numbers(phone_number);
CREATE INDEX IF NOT EXISTS idx_campaign_phone_numbers_twilio ON campaign_phone_numbers(twilio_sid);

-- Add FK to outbound_campaigns for phone_number_id
ALTER TABLE outbound_campaigns
ADD CONSTRAINT fk_outbound_campaigns_phone_number
FOREIGN KEY (phone_number_id) REFERENCES campaign_phone_numbers(id) ON DELETE SET NULL;

-- Comments
COMMENT ON TABLE campaign_phone_numbers IS 'Phone numbers provisioned or assigned to outbound campaigns';

-- ============================================
-- 9. Campaign Billing Table
-- Billing transactions for campaigns
-- ============================================
CREATE TABLE IF NOT EXISTS campaign_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES outbound_campaigns(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,

  -- Charge Details
  amount DECIMAL(10, 2) NOT NULL,
  minutes_used DECIMAL(12, 2) NOT NULL,
  rate_per_minute DECIMAL(10, 4) NOT NULL, -- Rate at time of charge

  -- Payment Provider
  payment_provider TEXT DEFAULT 'stripe',
  stripe_charge_id TEXT,
  stripe_payment_intent_id TEXT,
  paypal_transaction_id TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, succeeded, failed, refunded

  -- Error Handling
  error_code TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Period
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaign_billing_campaign ON campaign_billing(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_billing_client ON campaign_billing(client_id);
CREATE INDEX IF NOT EXISTS idx_campaign_billing_status ON campaign_billing(status);
CREATE INDEX IF NOT EXISTS idx_campaign_billing_stripe ON campaign_billing(stripe_charge_id);

-- Comments
COMMENT ON TABLE campaign_billing IS 'Billing transactions for outbound campaign usage';

-- ============================================
-- 10. Client API Keys Table
-- Client-provided API keys (override system defaults)
-- ============================================
CREATE TABLE IF NOT EXISTS client_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,

  -- Provider
  provider TEXT NOT NULL, -- twilio, vapi

  -- Encrypted Credentials (use Supabase Vault in production)
  api_key TEXT, -- Encrypted
  api_secret TEXT, -- Encrypted (for Twilio auth_token)
  account_sid TEXT, -- Twilio Account SID

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_validated TIMESTAMP WITH TIME ZONE,
  validation_status TEXT DEFAULT 'pending', -- pending, valid, invalid

  -- Usage
  last_used_at TIMESTAMP WITH TIME ZONE,

  -- Unique per client+provider
  UNIQUE(client_id, provider),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_api_keys_client ON client_api_keys(client_id);
CREATE INDEX IF NOT EXISTS idx_client_api_keys_provider ON client_api_keys(provider);

-- Comments
COMMENT ON TABLE client_api_keys IS 'Client-provided API keys that override system defaults (no billing when using own keys)';
COMMENT ON COLUMN client_api_keys.api_key IS 'Encrypted API key - use Supabase Vault for production';

-- ============================================
-- 11. Area Code Timezone Mapping Table
-- US area codes to IANA timezone mapping
-- ============================================
CREATE TABLE IF NOT EXISTS area_code_timezones (
  area_code TEXT PRIMARY KEY, -- 3-digit US area code
  timezone TEXT NOT NULL, -- IANA timezone (e.g., America/New_York)
  state TEXT, -- US state abbreviation
  region TEXT, -- General region name
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comments
COMMENT ON TABLE area_code_timezones IS 'Mapping of US area codes to IANA timezones for automatic contact timezone detection';

-- ============================================
-- 12. Enable Row Level Security
-- ============================================
ALTER TABLE outbound_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_sms ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE area_code_timezones ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 13. RLS Policies
-- ============================================

-- Outbound Campaigns: Admins full access, clients view their own
CREATE POLICY "Admins can manage all outbound campaigns" ON outbound_campaigns
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM admin_users)
  );

CREATE POLICY "Clients can view their own outbound campaigns" ON outbound_campaigns
  FOR SELECT USING (
    client_id IN (SELECT id FROM clients WHERE id = auth.uid() OR email = auth.email())
  );

-- Campaign Schedules: Follow campaign access
CREATE POLICY "Access campaign schedules via campaign" ON campaign_schedules
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM outbound_campaigns
      WHERE client_id IN (SELECT id FROM clients WHERE id = auth.uid() OR email = auth.email())
      OR auth.uid() IN (SELECT id FROM admin_users)
    )
  );

-- Campaign Contacts: Follow campaign access
CREATE POLICY "Access contacts via campaign" ON campaign_contacts
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM outbound_campaigns
      WHERE client_id IN (SELECT id FROM clients WHERE id = auth.uid() OR email = auth.email())
      OR auth.uid() IN (SELECT id FROM admin_users)
    )
  );

-- Campaign Calls: Follow campaign access
CREATE POLICY "Access calls via campaign" ON campaign_calls
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM outbound_campaigns
      WHERE client_id IN (SELECT id FROM clients WHERE id = auth.uid() OR email = auth.email())
      OR auth.uid() IN (SELECT id FROM admin_users)
    )
  );

-- Campaign SMS: Follow campaign access
CREATE POLICY "Access SMS via campaign" ON campaign_sms
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM outbound_campaigns
      WHERE client_id IN (SELECT id FROM clients WHERE id = auth.uid() OR email = auth.email())
      OR auth.uid() IN (SELECT id FROM admin_users)
    )
  );

-- Campaign SMS Templates: Follow campaign access
CREATE POLICY "Access SMS templates via campaign" ON campaign_sms_templates
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM outbound_campaigns
      WHERE client_id IN (SELECT id FROM clients WHERE id = auth.uid() OR email = auth.email())
      OR auth.uid() IN (SELECT id FROM admin_users)
    )
  );

-- Campaign Phone Numbers: Admins full access, clients view their own
CREATE POLICY "Admins can manage all phone numbers" ON campaign_phone_numbers
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM admin_users)
  );

CREATE POLICY "Clients can view their own phone numbers" ON campaign_phone_numbers
  FOR SELECT USING (
    client_id IN (SELECT id FROM clients WHERE id = auth.uid() OR email = auth.email())
  );

-- Campaign Billing: Admins full access, clients view their own
CREATE POLICY "Admins can manage all billing" ON campaign_billing
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM admin_users)
  );

CREATE POLICY "Clients can view their own billing" ON campaign_billing
  FOR SELECT USING (
    client_id IN (SELECT id FROM clients WHERE id = auth.uid() OR email = auth.email())
  );

-- Client API Keys: Clients manage their own
CREATE POLICY "Clients can manage their own API keys" ON client_api_keys
  FOR ALL USING (
    client_id IN (SELECT id FROM clients WHERE id = auth.uid() OR email = auth.email())
    OR auth.uid() IN (SELECT id FROM admin_users)
  );

-- Area Code Timezones: Public read
CREATE POLICY "Anyone can read area code timezones" ON area_code_timezones
  FOR SELECT USING (true);

-- ============================================
-- 14. Helper Functions
-- ============================================

-- Function to update campaign stats
CREATE OR REPLACE FUNCTION update_outbound_campaign_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE outbound_campaigns
  SET
    contacts_called = (
      SELECT COUNT(DISTINCT contact_id) FROM campaign_calls WHERE campaign_id = NEW.campaign_id
    ),
    contacts_completed = (
      SELECT COUNT(*) FROM campaign_contacts
      WHERE campaign_id = NEW.campaign_id AND status = 'completed'
    ),
    total_minutes = (
      SELECT COALESCE(SUM(duration_seconds), 0) / 60.0 FROM campaign_calls WHERE campaign_id = NEW.campaign_id
    ),
    total_cost = (
      SELECT COALESCE(SUM(cost), 0) FROM campaign_calls WHERE campaign_id = NEW.campaign_id
    ),
    positive_outcomes = (
      SELECT COUNT(*) FROM campaign_calls WHERE campaign_id = NEW.campaign_id AND outcome = 'positive'
    ),
    negative_outcomes = (
      SELECT COUNT(*) FROM campaign_calls WHERE campaign_id = NEW.campaign_id AND outcome = 'negative'
    ),
    updated_at = NOW()
  WHERE id = NEW.campaign_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update stats after call completion
CREATE TRIGGER trigger_update_campaign_stats
  AFTER INSERT OR UPDATE ON campaign_calls
  FOR EACH ROW
  EXECUTE FUNCTION update_outbound_campaign_stats();

-- Function to detect timezone from phone number
CREATE OR REPLACE FUNCTION detect_contact_timezone(phone TEXT)
RETURNS TEXT AS $$
DECLARE
  area_code TEXT;
  detected_tz TEXT;
BEGIN
  -- Extract area code from E.164 format (+1XXXXXXXXXX)
  IF phone LIKE '+1%' AND LENGTH(phone) >= 12 THEN
    area_code := SUBSTRING(phone FROM 3 FOR 3);
  ELSIF LENGTH(phone) = 10 THEN
    area_code := SUBSTRING(phone FROM 1 FOR 3);
  ELSE
    RETURN 'America/New_York'; -- Default
  END IF;

  -- Look up timezone
  SELECT timezone INTO detected_tz FROM area_code_timezones WHERE area_code_timezones.area_code = detect_contact_timezone.area_code;

  RETURN COALESCE(detected_tz, 'America/New_York');
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-detect timezone on contact insert
CREATE OR REPLACE FUNCTION auto_detect_contact_timezone()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.timezone IS NULL THEN
    NEW.timezone := detect_contact_timezone(NEW.phone_number);
    -- Also extract area code
    IF NEW.phone_number LIKE '+1%' AND LENGTH(NEW.phone_number) >= 12 THEN
      NEW.area_code := SUBSTRING(NEW.phone_number FROM 3 FOR 3);
    ELSIF LENGTH(NEW.phone_number) = 10 THEN
      NEW.area_code := SUBSTRING(NEW.phone_number FROM 1 FOR 3);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_detect_timezone
  BEFORE INSERT ON campaign_contacts
  FOR EACH ROW
  EXECUTE FUNCTION auto_detect_contact_timezone();

-- ============================================
-- 15. Updated_at Triggers
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_outbound_campaigns_updated
  BEFORE UPDATE ON outbound_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_campaign_schedules_updated
  BEFORE UPDATE ON campaign_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_campaign_contacts_updated
  BEFORE UPDATE ON campaign_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_campaign_sms_templates_updated
  BEFORE UPDATE ON campaign_sms_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_campaign_phone_numbers_updated
  BEFORE UPDATE ON campaign_phone_numbers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_client_api_keys_updated
  BEFORE UPDATE ON client_api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Done!
-- ============================================
SELECT 'Outbound Campaigns migration completed successfully!' as status;
