-- Migration: Add SMS Rules and SMS Logs tables
-- Run this in your Supabase SQL Editor

-- ============================================
-- SMS Rules Table - Per-campaign trigger rules
-- ============================================
CREATE TABLE IF NOT EXISTS sms_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_condition TEXT NOT NULL, -- Natural language condition for AI to evaluate
  message_template TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  trigger_count INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for SMS Rules
CREATE INDEX IF NOT EXISTS idx_sms_rules_campaign_id ON sms_rules(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sms_rules_is_active ON sms_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_sms_rules_priority ON sms_rules(priority DESC);

-- ============================================
-- SMS Logs Table - Track all sent SMS messages
-- ============================================
CREATE TABLE IF NOT EXISTS sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  rule_id UUID REFERENCES sms_rules(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  recipient_phone TEXT NOT NULL,
  message_body TEXT NOT NULL,
  twilio_message_sid TEXT,
  twilio_status TEXT, -- 'queued', 'sent', 'delivered', 'undelivered', 'failed'
  twilio_error_code TEXT,
  twilio_error_message TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed'
  segment_count INTEGER DEFAULT 1,
  cost DECIMAL(10, 4),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for SMS Logs
CREATE INDEX IF NOT EXISTS idx_sms_logs_campaign_id ON sms_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_call_id ON sms_logs(call_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_rule_id ON sms_logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_client_id ON sms_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_status ON sms_logs(status);
CREATE INDEX IF NOT EXISTS idx_sms_logs_twilio_message_sid ON sms_logs(twilio_message_sid);
CREATE INDEX IF NOT EXISTS idx_sms_logs_created_at ON sms_logs(created_at DESC);

-- ============================================
-- Row Level Security Policies
-- ============================================

-- SMS Rules RLS
ALTER TABLE sms_rules ENABLE ROW LEVEL SECURITY;

-- Admins can manage SMS rules
CREATE POLICY "Admins can manage sms_rules"
  ON sms_rules
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users WHERE id = auth.uid()
    )
  );

-- Clients can view SMS rules for their campaigns
CREATE POLICY "Clients can view their sms_rules"
  ON sms_rules
  FOR SELECT
  TO authenticated
  USING (
    campaign_id IN (
      SELECT id FROM campaigns
      WHERE client_id IN (
        SELECT id FROM clients WHERE email = auth.jwt()->>'email'
      )
    )
  );

-- Service role can manage all SMS rules
CREATE POLICY "Service role can manage sms_rules"
  ON sms_rules
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- SMS Logs RLS
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all SMS logs
CREATE POLICY "Admins can view all sms_logs"
  ON sms_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users WHERE id = auth.uid()
    )
  );

-- Clients can view their SMS logs
CREATE POLICY "Clients can view their sms_logs"
  ON sms_logs
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM clients WHERE email = auth.jwt()->>'email'
    )
  );

-- Service role can manage all SMS logs
CREATE POLICY "Service role can manage sms_logs"
  ON sms_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Helper function to update trigger count
-- ============================================
CREATE OR REPLACE FUNCTION update_sms_rule_trigger_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.rule_id IS NOT NULL AND NEW.status = 'sent' THEN
    UPDATE sms_rules
    SET
      trigger_count = trigger_count + 1,
      last_triggered_at = NOW(),
      updated_at = NOW()
    WHERE id = NEW.rule_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update trigger count when SMS is sent
DROP TRIGGER IF EXISTS sms_sent_update_rule_count ON sms_logs;
CREATE TRIGGER sms_sent_update_rule_count
  AFTER INSERT ON sms_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_sms_rule_trigger_count();

-- ============================================
-- Update updated_at timestamp automatically
-- ============================================
CREATE OR REPLACE FUNCTION update_sms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sms_rules_updated_at ON sms_rules;
CREATE TRIGGER sms_rules_updated_at
  BEFORE UPDATE ON sms_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_sms_updated_at();

DROP TRIGGER IF EXISTS sms_logs_updated_at ON sms_logs;
CREATE TRIGGER sms_logs_updated_at
  BEFORE UPDATE ON sms_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_sms_updated_at();
