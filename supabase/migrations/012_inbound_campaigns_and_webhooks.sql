-- ============================================
-- Inbound Campaigns & Unified Webhook Migration
-- Creates inbound_campaigns table and adds webhook_token to outbound_campaigns
-- Version: 1.0.0
-- Date: December 2025
-- ============================================

-- ============================================
-- 1. Create Inbound Campaigns Table
-- Similar to outbound_campaigns but for receiving calls
-- ============================================
CREATE TABLE IF NOT EXISTS inbound_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  -- Unique webhook token for receiving data
  webhook_token TEXT UNIQUE NOT NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'draft', -- draft, active, paused, stopped

  -- Vapi Integration
  vapi_assistant_id TEXT,

  -- Phone Number (FK to campaign_phone_numbers)
  phone_number_id UUID,

  -- AI Agent Configuration
  agent_config JSONB DEFAULT '{}', -- voice, personality, system prompt, first message, etc.

  -- Payload Mapping (for AI to parse incoming webhooks)
  payload_mapping JSONB, -- Stores learned field mappings

  -- Call Settings
  max_call_duration INTEGER DEFAULT 300, -- 5 minutes default
  silence_timeout INTEGER DEFAULT 30,

  -- Stats
  total_calls INTEGER DEFAULT 0,
  calls_completed INTEGER DEFAULT 0,
  positive_outcomes INTEGER DEFAULT 0,
  negative_outcomes INTEGER DEFAULT 0,
  total_minutes DECIMAL(12, 2) DEFAULT 0,

  -- Active
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  launched_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for inbound_campaigns
CREATE INDEX IF NOT EXISTS idx_inbound_campaigns_client ON inbound_campaigns(client_id);
CREATE INDEX IF NOT EXISTS idx_inbound_campaigns_status ON inbound_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_inbound_campaigns_webhook ON inbound_campaigns(webhook_token);
CREATE INDEX IF NOT EXISTS idx_inbound_campaigns_vapi ON inbound_campaigns(vapi_assistant_id);

-- Comments
COMMENT ON TABLE inbound_campaigns IS 'Inbound calling campaigns - receives calls and webhooks';
COMMENT ON COLUMN inbound_campaigns.webhook_token IS 'Unique token for webhook URL: /api/webhooks/[token]';
COMMENT ON COLUMN inbound_campaigns.agent_config IS 'Vapi assistant configuration: voice, personality, systemPrompt, firstMessage, etc.';
COMMENT ON COLUMN inbound_campaigns.payload_mapping IS 'AI-learned field mappings for parsing incoming webhook payloads';

-- ============================================
-- 2. Add webhook_token to outbound_campaigns
-- Each outbound campaign gets its own unique webhook
-- ============================================
ALTER TABLE outbound_campaigns
ADD COLUMN IF NOT EXISTS webhook_token TEXT UNIQUE;

-- Generate webhook tokens for existing outbound campaigns
UPDATE outbound_campaigns
SET webhook_token = 'ob_' || replace(gen_random_uuid()::text, '-', '')
WHERE webhook_token IS NULL;

-- Make webhook_token NOT NULL after populating existing rows
ALTER TABLE outbound_campaigns
ALTER COLUMN webhook_token SET NOT NULL;

-- Add index for webhook lookups
CREATE INDEX IF NOT EXISTS idx_outbound_campaigns_webhook ON outbound_campaigns(webhook_token);

-- Comment
COMMENT ON COLUMN outbound_campaigns.webhook_token IS 'Unique token for webhook URL: /api/webhooks/[token]';

-- ============================================
-- 3. Inbound Campaign Calls Table
-- Call records for inbound campaigns
-- ============================================
CREATE TABLE IF NOT EXISTS inbound_campaign_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES inbound_campaigns(id) ON DELETE CASCADE NOT NULL,

  -- Call identifiers
  vapi_call_id TEXT,
  external_call_id TEXT, -- From webhook payload

  -- Caller Info
  caller_phone TEXT,

  -- Call Status
  status TEXT NOT NULL DEFAULT 'processing', -- processing, completed, failed

  -- Call Metrics
  duration_seconds INTEGER DEFAULT 0,

  -- Call Data
  transcript TEXT,
  audio_url TEXT,
  raw_payload JSONB,
  call_timestamp TIMESTAMP WITH TIME ZONE,

  -- AI Analysis
  ai_summary TEXT,
  ai_sentiment TEXT, -- positive, negative, neutral
  ai_key_points JSONB, -- Array of key points
  ai_caller_intent TEXT,
  ai_resolution TEXT, -- yes, no, partial, unclear
  ai_processed_at TIMESTAMP WITH TIME ZONE,

  -- Outcome Tag
  outcome_tag_id UUID,

  -- Error Handling
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for inbound_campaign_calls
CREATE INDEX IF NOT EXISTS idx_inbound_calls_campaign ON inbound_campaign_calls(campaign_id);
CREATE INDEX IF NOT EXISTS idx_inbound_calls_vapi ON inbound_campaign_calls(vapi_call_id);
CREATE INDEX IF NOT EXISTS idx_inbound_calls_external ON inbound_campaign_calls(external_call_id);
CREATE INDEX IF NOT EXISTS idx_inbound_calls_status ON inbound_campaign_calls(status);
CREATE INDEX IF NOT EXISTS idx_inbound_calls_created ON inbound_campaign_calls(created_at DESC);

-- Comments
COMMENT ON TABLE inbound_campaign_calls IS 'Call records for inbound campaigns';

-- ============================================
-- 4. Inbound Campaign Outcome Tags
-- Tags for categorizing call outcomes
-- ============================================
CREATE TABLE IF NOT EXISTS inbound_campaign_outcome_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES inbound_campaigns(id) ON DELETE CASCADE NOT NULL,
  tag_name TEXT NOT NULL,
  tag_color TEXT DEFAULT '#6B7280',
  is_positive BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add FK to inbound_campaign_calls for outcome_tag_id
ALTER TABLE inbound_campaign_calls
ADD CONSTRAINT fk_inbound_calls_outcome_tag
FOREIGN KEY (outcome_tag_id) REFERENCES inbound_campaign_outcome_tags(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inbound_outcome_tags_campaign ON inbound_campaign_outcome_tags(campaign_id);

-- Comments
COMMENT ON TABLE inbound_campaign_outcome_tags IS 'Outcome tags for categorizing inbound call results';

-- ============================================
-- 5. Inbound Campaign SMS Rules
-- SMS automation rules for inbound campaigns
-- ============================================
CREATE TABLE IF NOT EXISTS inbound_campaign_sms_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES inbound_campaigns(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  trigger_condition TEXT NOT NULL, -- Natural language condition
  message_template TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  trigger_count INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inbound_sms_rules_campaign ON inbound_campaign_sms_rules(campaign_id);

-- Comments
COMMENT ON TABLE inbound_campaign_sms_rules IS 'SMS automation rules for inbound campaigns';

-- ============================================
-- 6. Inbound Campaign Webhook Logs
-- Log all webhook requests for debugging
-- ============================================
CREATE TABLE IF NOT EXISTS inbound_campaign_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES inbound_campaigns(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  status TEXT NOT NULL, -- success, failed
  error_message TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inbound_webhook_logs_campaign ON inbound_campaign_webhook_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_inbound_webhook_logs_created ON inbound_campaign_webhook_logs(created_at DESC);

-- Comments
COMMENT ON TABLE inbound_campaign_webhook_logs IS 'Webhook request logs for inbound campaigns';

-- ============================================
-- 7. Update campaign_phone_numbers for inbound
-- Allow phone numbers to be linked to inbound campaigns
-- ============================================
ALTER TABLE campaign_phone_numbers
ADD COLUMN IF NOT EXISTS inbound_campaign_id UUID REFERENCES inbound_campaigns(id) ON DELETE SET NULL;

-- Index for inbound campaign lookups
CREATE INDEX IF NOT EXISTS idx_campaign_phone_numbers_inbound ON campaign_phone_numbers(inbound_campaign_id);

-- Comment
COMMENT ON COLUMN campaign_phone_numbers.inbound_campaign_id IS 'FK to inbound campaign (phone can be used for inbound)';

-- ============================================
-- 8. Enable Row Level Security
-- ============================================
ALTER TABLE inbound_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_campaign_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_campaign_outcome_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_campaign_sms_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_campaign_webhook_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 9. RLS Policies
-- ============================================

-- Inbound Campaigns: Admins full access, clients view their own
CREATE POLICY "Admins can manage all inbound campaigns" ON inbound_campaigns
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM admin_users)
  );

CREATE POLICY "Clients can view their own inbound campaigns" ON inbound_campaigns
  FOR SELECT USING (
    client_id IN (SELECT id FROM clients WHERE id = auth.uid() OR email = auth.email())
  );

-- Inbound Campaign Calls: Follow campaign access
CREATE POLICY "Access inbound calls via campaign" ON inbound_campaign_calls
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM inbound_campaigns
      WHERE client_id IN (SELECT id FROM clients WHERE id = auth.uid() OR email = auth.email())
      OR auth.uid() IN (SELECT id FROM admin_users)
    )
  );

-- Inbound Outcome Tags: Follow campaign access
CREATE POLICY "Access inbound outcome tags via campaign" ON inbound_campaign_outcome_tags
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM inbound_campaigns
      WHERE client_id IN (SELECT id FROM clients WHERE id = auth.uid() OR email = auth.email())
      OR auth.uid() IN (SELECT id FROM admin_users)
    )
  );

-- Inbound SMS Rules: Follow campaign access
CREATE POLICY "Access inbound SMS rules via campaign" ON inbound_campaign_sms_rules
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM inbound_campaigns
      WHERE client_id IN (SELECT id FROM clients WHERE id = auth.uid() OR email = auth.email())
      OR auth.uid() IN (SELECT id FROM admin_users)
    )
  );

-- Inbound Webhook Logs: Follow campaign access
CREATE POLICY "Access inbound webhook logs via campaign" ON inbound_campaign_webhook_logs
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM inbound_campaigns
      WHERE client_id IN (SELECT id FROM clients WHERE id = auth.uid() OR email = auth.email())
      OR auth.uid() IN (SELECT id FROM admin_users)
    )
  );

-- ============================================
-- 10. Update Triggers
-- ============================================
CREATE TRIGGER trigger_inbound_campaigns_updated
  BEFORE UPDATE ON inbound_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_inbound_calls_updated
  BEFORE UPDATE ON inbound_campaign_calls
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_inbound_sms_rules_updated
  BEFORE UPDATE ON inbound_campaign_sms_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 11. Stats Update Function for Inbound Campaigns
-- ============================================
CREATE OR REPLACE FUNCTION update_inbound_campaign_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inbound_campaigns
  SET
    total_calls = (
      SELECT COUNT(*) FROM inbound_campaign_calls WHERE campaign_id = NEW.campaign_id
    ),
    calls_completed = (
      SELECT COUNT(*) FROM inbound_campaign_calls
      WHERE campaign_id = NEW.campaign_id AND status = 'completed'
    ),
    total_minutes = (
      SELECT COALESCE(SUM(duration_seconds), 0) / 60.0 FROM inbound_campaign_calls WHERE campaign_id = NEW.campaign_id
    ),
    updated_at = NOW()
  WHERE id = NEW.campaign_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update stats after call insert/update
CREATE TRIGGER trigger_update_inbound_campaign_stats
  AFTER INSERT OR UPDATE ON inbound_campaign_calls
  FOR EACH ROW
  EXECUTE FUNCTION update_inbound_campaign_stats();

-- ============================================
-- Done!
-- ============================================
SELECT 'Inbound campaigns and webhooks migration completed successfully!' as status;
