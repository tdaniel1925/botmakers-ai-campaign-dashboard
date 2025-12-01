-- Migration: Add Email Templates, Email Logs, and API Keys tables
-- Run this in your Supabase SQL Editor

-- ============================================
-- Email Templates Table
-- ============================================
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL, -- welcome, password_reset, campaign_report, re_invite
  subject TEXT NOT NULL,
  heading TEXT NOT NULL,
  body_content TEXT NOT NULL,
  button_text TEXT,
  button_url TEXT,
  footer_text TEXT,
  primary_color TEXT DEFAULT '#10B981',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for quick slug lookups
CREATE INDEX IF NOT EXISTS idx_email_templates_slug ON email_templates(slug);

-- ============================================
-- Email Logs Table
-- ============================================
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  template_slug TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, delivered, failed, bounced
  resend_message_id TEXT,
  error_message TEXT,
  metadata JSONB, -- Store additional data like campaign IDs, report period, etc.
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for email logs
CREATE INDEX IF NOT EXISTS idx_email_logs_client_id ON email_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_template_slug ON email_logs(template_slug);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);

-- ============================================
-- API Keys Table (with encryption support)
-- ============================================
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT UNIQUE NOT NULL, -- openai, vapi, resend, twilio, cal_com, google_calendar, outlook_calendar, stripe, square, paypal
  key_data TEXT NOT NULL, -- Encrypted string containing the keys (AES-256-GCM encrypted JSON)
  is_active BOOLEAN DEFAULT true,
  last_validated TIMESTAMP WITH TIME ZONE,
  validation_status TEXT, -- valid, invalid, pending
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for service lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_service ON api_keys(service);

-- ============================================
-- Add new columns to clients table (if not exists)
-- ============================================

-- Username column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'username') THEN
    ALTER TABLE clients ADD COLUMN username TEXT UNIQUE;
  END IF;
END $$;

-- Temp password column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'temp_password') THEN
    ALTER TABLE clients ADD COLUMN temp_password TEXT;
  END IF;
END $$;

-- Password changed at column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'password_changed_at') THEN
    ALTER TABLE clients ADD COLUMN password_changed_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Invite status column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'invite_status') THEN
    ALTER TABLE clients ADD COLUMN invite_status TEXT DEFAULT 'draft';
  END IF;
END $$;

-- Report frequency column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'report_frequency') THEN
    ALTER TABLE clients ADD COLUMN report_frequency TEXT DEFAULT 'weekly';
  END IF;
END $$;

-- Report day of week column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'report_day_of_week') THEN
    ALTER TABLE clients ADD COLUMN report_day_of_week INTEGER DEFAULT 1;
  END IF;
END $$;

-- Report hour column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'report_hour') THEN
    ALTER TABLE clients ADD COLUMN report_hour INTEGER DEFAULT 9;
  END IF;
END $$;

-- Last report sent at column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'last_report_sent_at') THEN
    ALTER TABLE clients ADD COLUMN last_report_sent_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- ============================================
-- Row Level Security Policies
-- ============================================

-- Enable RLS on new tables
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Email Templates: Only admins can read/write
CREATE POLICY "Admins can manage email templates"
  ON email_templates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users WHERE id = auth.uid()
    )
  );

-- Email Logs: Admins can see all, clients can see their own
CREATE POLICY "Admins can view all email logs"
  ON email_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Clients can view their own email logs"
  ON email_logs
  FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients WHERE email = auth.jwt()->>'email'
    )
  );

-- API Keys: Only admins can read/write
CREATE POLICY "Admins can manage api keys"
  ON api_keys
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users WHERE id = auth.uid()
    )
  );

-- ============================================
-- Updated at trigger function (if not exists)
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to new tables
DROP TRIGGER IF EXISTS update_email_templates_updated_at ON email_templates;
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_api_keys_updated_at ON api_keys;
CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Service role bypass for server-side operations
-- ============================================

-- Allow service role to bypass RLS for email_templates
CREATE POLICY "Service role can manage email templates"
  ON email_templates
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow service role to bypass RLS for email_logs
CREATE POLICY "Service role can manage email logs"
  ON email_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow service role to bypass RLS for api_keys
CREATE POLICY "Service role can manage api keys"
  ON api_keys
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
