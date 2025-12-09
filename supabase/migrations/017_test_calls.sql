-- ============================================
-- Test Calls Migration
-- Adds support for test calls in campaign_calls table
-- Version: 1.0.0
-- Date: December 2025
-- ============================================

-- Add is_test column to campaign_calls
ALTER TABLE campaign_calls
ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT false;

-- Add phone_number column for test calls (since test calls don't have a contact)
ALTER TABLE campaign_calls
ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Add first_name column for test calls
ALTER TABLE campaign_calls
ADD COLUMN IF NOT EXISTS first_name TEXT;

-- Make contact_id nullable for test calls
ALTER TABLE campaign_calls
ALTER COLUMN contact_id DROP NOT NULL;

-- Add vapi_ended_reason column for storing end reason
ALTER TABLE campaign_calls
ADD COLUMN IF NOT EXISTS vapi_ended_reason TEXT;

-- Add updated_at column if not exists
ALTER TABLE campaign_calls
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add index for test calls
CREATE INDEX IF NOT EXISTS idx_campaign_calls_is_test ON campaign_calls(campaign_id, is_test);

-- Comments
COMMENT ON COLUMN campaign_calls.is_test IS 'Whether this is a test call (not from campaign contact list)';
COMMENT ON COLUMN campaign_calls.phone_number IS 'Phone number called (used for test calls without a contact)';
COMMENT ON COLUMN campaign_calls.first_name IS 'First name used for test calls';
COMMENT ON COLUMN campaign_calls.vapi_ended_reason IS 'Reason the call ended (from Vapi)';

-- ============================================
-- Done!
-- ============================================
SELECT 'Test calls migration completed successfully!' as status;
