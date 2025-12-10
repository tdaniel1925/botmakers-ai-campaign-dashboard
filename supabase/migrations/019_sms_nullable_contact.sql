-- Migration: Make contact_id nullable in campaign_sms for test calls
-- Test calls don't have a contact_id, so we need to allow NULL values

-- Remove NOT NULL constraint from contact_id
ALTER TABLE campaign_sms
ALTER COLUMN contact_id DROP NOT NULL;

-- Also update the foreign key to SET NULL on delete instead of CASCADE
-- First drop the existing constraint
ALTER TABLE campaign_sms
DROP CONSTRAINT IF EXISTS campaign_sms_contact_id_fkey;

-- Re-add with SET NULL behavior
ALTER TABLE campaign_sms
ADD CONSTRAINT campaign_sms_contact_id_fkey
FOREIGN KEY (contact_id)
REFERENCES campaign_contacts(id)
ON DELETE SET NULL;

-- Add comment
COMMENT ON COLUMN campaign_sms.contact_id IS 'Optional reference to campaign contact. NULL for test calls.';

SELECT 'campaign_sms.contact_id is now nullable for test calls' as status;
