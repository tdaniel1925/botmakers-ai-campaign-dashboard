-- ============================================
-- Add Vapi Key Source to Inbound & Outbound Campaigns
-- Allows choosing between system keys (bill to client) or client's own keys
-- Version: 1.0.0
-- Date: December 2025
-- ============================================

-- ============================================
-- 1. Add vapi_key_source to inbound_campaigns
-- ============================================

ALTER TABLE inbound_campaigns
ADD COLUMN IF NOT EXISTS vapi_key_source TEXT DEFAULT 'system' CHECK (vapi_key_source IN ('system', 'client'));

COMMENT ON COLUMN inbound_campaigns.vapi_key_source IS 'Source of Vapi API keys: system (platform account, bill to client) or client (client provides own keys)';

-- ============================================
-- 2. Add Vapi credentials to outbound_campaigns
-- ============================================

-- Add vapi_key_source column
ALTER TABLE outbound_campaigns
ADD COLUMN IF NOT EXISTS vapi_key_source TEXT DEFAULT 'system' CHECK (vapi_key_source IN ('system', 'client'));

-- Add vapi_api_key (encrypted, only used when vapi_key_source = 'client')
ALTER TABLE outbound_campaigns
ADD COLUMN IF NOT EXISTS vapi_api_key TEXT;

-- Add vapi_assistant_id
ALTER TABLE outbound_campaigns
ADD COLUMN IF NOT EXISTS vapi_assistant_id TEXT;

-- Add vapi_phone_number_id
ALTER TABLE outbound_campaigns
ADD COLUMN IF NOT EXISTS vapi_phone_number_id TEXT;

-- Comments
COMMENT ON COLUMN outbound_campaigns.vapi_key_source IS 'Source of Vapi API keys: system (platform account, bill to client) or client (client provides own keys)';
COMMENT ON COLUMN outbound_campaigns.vapi_api_key IS 'Encrypted Vapi private API key (only when using client keys)';
COMMENT ON COLUMN outbound_campaigns.vapi_assistant_id IS 'Vapi assistant ID to handle calls for this campaign';
COMMENT ON COLUMN outbound_campaigns.vapi_phone_number_id IS 'Vapi phone number ID to use for this campaign';

-- ============================================
-- Done!
-- ============================================
SELECT 'Vapi key source migration completed successfully!' as status;
