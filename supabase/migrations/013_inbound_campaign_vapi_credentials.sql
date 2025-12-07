-- ============================================
-- Add Vapi Credentials to Inbound Campaigns
-- Stores per-campaign Vapi API keys for making calls
-- Version: 1.0.0
-- Date: December 2025
-- ============================================

-- ============================================
-- 1. Add Vapi Credentials Columns
-- Each campaign can have its own Vapi credentials
-- ============================================

-- Add Vapi API Key (encrypted)
ALTER TABLE inbound_campaigns
ADD COLUMN IF NOT EXISTS vapi_api_key TEXT;

-- Add Vapi Phone Number ID
ALTER TABLE inbound_campaigns
ADD COLUMN IF NOT EXISTS vapi_phone_number_id TEXT;

-- Comments
COMMENT ON COLUMN inbound_campaigns.vapi_api_key IS 'Encrypted Vapi private API key for this campaign';
COMMENT ON COLUMN inbound_campaigns.vapi_assistant_id IS 'Vapi assistant ID to handle calls for this campaign';
COMMENT ON COLUMN inbound_campaigns.vapi_phone_number_id IS 'Vapi phone number ID to use for this campaign';

-- ============================================
-- 2. Remove agent_config column (no longer needed)
-- We're using Vapi assistant directly, not creating agents
-- ============================================
-- Note: Keeping agent_config for now as it may be useful for future features
-- ALTER TABLE inbound_campaigns DROP COLUMN IF EXISTS agent_config;

-- ============================================
-- Done!
-- ============================================
SELECT 'Vapi credentials migration completed successfully!' as status;
