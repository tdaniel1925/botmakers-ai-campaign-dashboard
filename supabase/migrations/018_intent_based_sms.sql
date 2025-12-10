-- Migration: Intent-Based SMS Rules for All Campaigns
-- This adds AI-powered intent-based SMS triggering for both inbound and outbound campaigns

-- ============================================
-- Outbound Campaign SMS Rules (Intent-Based)
-- ============================================
CREATE TABLE IF NOT EXISTS outbound_campaign_sms_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES outbound_campaigns(id) ON DELETE CASCADE NOT NULL,

  -- Rule Configuration
  name TEXT NOT NULL,
  trigger_condition TEXT NOT NULL, -- Natural language condition e.g. "Customer expressed interest in scheduling"
  message_template TEXT NOT NULL,

  -- Status
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0, -- Higher priority evaluated first

  -- Stats
  trigger_count INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_outbound_sms_rules_campaign ON outbound_campaign_sms_rules(campaign_id);
CREATE INDEX IF NOT EXISTS idx_outbound_sms_rules_active ON outbound_campaign_sms_rules(campaign_id, is_active);

-- ============================================
-- Update campaign_sms table for intent tracking
-- ============================================
ALTER TABLE campaign_sms
ADD COLUMN IF NOT EXISTS rule_id UUID REFERENCES outbound_campaign_sms_rules(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS ai_evaluation_reason TEXT,
ADD COLUMN IF NOT EXISTS ai_confidence DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS recipient_name TEXT;

-- Add index for rule_id lookups
CREATE INDEX IF NOT EXISTS idx_campaign_sms_rule ON campaign_sms(rule_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sms_call ON campaign_sms(call_id);

-- ============================================
-- Update inbound campaign SMS rules (already exists as inbound_campaign_sms_rules)
-- Just add missing columns if needed
-- ============================================
-- Add ai_confidence column to track evaluation confidence
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sms_logs' AND column_name = 'ai_confidence'
  ) THEN
    ALTER TABLE sms_logs ADD COLUMN ai_confidence DECIMAL(3,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sms_logs' AND column_name = 'ai_evaluation_reason'
  ) THEN
    ALTER TABLE sms_logs ADD COLUMN ai_evaluation_reason TEXT;
  END IF;
END $$;

-- ============================================
-- RLS Policies for outbound_campaign_sms_rules
-- ============================================
ALTER TABLE outbound_campaign_sms_rules ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins can manage outbound SMS rules"
  ON outbound_campaign_sms_rules
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users WHERE id = auth.uid()
    )
  );

-- Client team members can view their campaign's SMS rules
CREATE POLICY "Client team can view their SMS rules"
  ON outbound_campaign_sms_rules
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM outbound_campaigns oc
      WHERE oc.id = outbound_campaign_sms_rules.campaign_id
      AND oc.client_id IN (SELECT id FROM clients WHERE id = auth.uid() OR email = auth.email())
    )
  );

-- ============================================
-- Function to update trigger stats
-- ============================================
CREATE OR REPLACE FUNCTION update_sms_rule_trigger_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update outbound rule stats if rule_id is set
  IF NEW.rule_id IS NOT NULL THEN
    UPDATE outbound_campaign_sms_rules
    SET
      trigger_count = trigger_count + 1,
      last_triggered_at = NOW()
    WHERE id = NEW.rule_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update stats when SMS is sent
DROP TRIGGER IF EXISTS update_outbound_sms_rule_stats ON campaign_sms;
CREATE TRIGGER update_outbound_sms_rule_stats
  AFTER INSERT ON campaign_sms
  FOR EACH ROW
  WHEN (NEW.status = 'sent')
  EXECUTE FUNCTION update_sms_rule_trigger_stats();

-- ============================================
-- Helper view for SMS with rule details
-- ============================================
CREATE OR REPLACE VIEW campaign_sms_with_rules AS
SELECT
  s.*,
  r.name as rule_name,
  r.trigger_condition as rule_condition
FROM campaign_sms s
LEFT JOIN outbound_campaign_sms_rules r ON s.rule_id = r.id;

-- Grant access to the view
GRANT SELECT ON campaign_sms_with_rules TO authenticated;

-- ============================================
-- Default SMS rules examples (commented out - can be used as templates)
-- ============================================
-- INSERT INTO outbound_campaign_sms_rules (campaign_id, name, trigger_condition, message_template, priority) VALUES
-- ('your-campaign-id', 'Send Info', 'Customer expressed interest or asked for more information about the product/service', 'Hi {{first_name}}! Thanks for your interest. Here''s more info: {{link}}', 10),
-- ('your-campaign-id', 'Confirm Appointment', 'Customer scheduled, confirmed, or agreed to an appointment or meeting', 'Hi {{first_name}}! Your appointment is confirmed. We''ll see you soon!', 20),
-- ('your-campaign-id', 'Follow Up', 'Customer was interested but wanted to think about it or needed time to decide', 'Hi {{first_name}}! Just following up on our conversation. Let us know if you have any questions!', 5);

COMMENT ON TABLE outbound_campaign_sms_rules IS 'Intent-based SMS rules for outbound campaigns. AI evaluates call transcripts against these natural language conditions.';
COMMENT ON COLUMN outbound_campaign_sms_rules.trigger_condition IS 'Natural language description of when this SMS should be triggered. AI evaluates the transcript against this condition.';
COMMENT ON COLUMN outbound_campaign_sms_rules.priority IS 'Higher priority rules are evaluated first. Only one rule can trigger per call.';
