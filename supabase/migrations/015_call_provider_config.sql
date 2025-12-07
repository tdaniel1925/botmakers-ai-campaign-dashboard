-- ============================================
-- Add Call Provider Configuration to Outbound Campaigns
-- Supports AutoCalls.ai, Synthflow, and Vapi for outbound calls
-- Version: 1.0.0
-- Date: December 2025
-- ============================================

-- ============================================
-- 1. Add call_provider column to outbound_campaigns
-- ============================================

-- Provider type: autocalls, synthflow, or vapi
ALTER TABLE outbound_campaigns
ADD COLUMN IF NOT EXISTS call_provider TEXT DEFAULT 'vapi' CHECK (call_provider IN ('autocalls', 'synthflow', 'vapi'));

COMMENT ON COLUMN outbound_campaigns.call_provider IS 'The call provider to use for outbound calls: autocalls, synthflow, or vapi';

-- ============================================
-- 2. Add provider-specific config columns
-- ============================================

-- AutoCalls.ai specific: assistant_id is an integer
ALTER TABLE outbound_campaigns
ADD COLUMN IF NOT EXISTS autocalls_assistant_id INTEGER;

COMMENT ON COLUMN outbound_campaigns.autocalls_assistant_id IS 'AutoCalls.ai assistant ID (integer)';

-- Synthflow specific: model_id is the agent ID
ALTER TABLE outbound_campaigns
ADD COLUMN IF NOT EXISTS synthflow_model_id TEXT;

COMMENT ON COLUMN outbound_campaigns.synthflow_model_id IS 'Synthflow agent/model ID';

-- Provider API key (encrypted) - separate from vapi_api_key for flexibility
ALTER TABLE outbound_campaigns
ADD COLUMN IF NOT EXISTS provider_api_key TEXT;

COMMENT ON COLUMN outbound_campaigns.provider_api_key IS 'Encrypted API key for the selected call provider (when using client keys)';

-- ============================================
-- 3. Add variable mapping config
-- ============================================

-- JSON object mapping contact fields to provider variable names
ALTER TABLE outbound_campaigns
ADD COLUMN IF NOT EXISTS variable_mapping JSONB DEFAULT '{}';

COMMENT ON COLUMN outbound_campaigns.variable_mapping IS 'JSON mapping of contact fields to provider-specific variable names';

-- ============================================
-- Done!
-- ============================================
SELECT 'Call provider configuration migration completed successfully!' as status;
