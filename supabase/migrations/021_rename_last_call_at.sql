-- ============================================
-- Migration: Rename last_call_at to last_called_at
-- Fix column name mismatch in campaign_contacts table
-- ============================================

-- Rename the column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaign_contacts' AND column_name = 'last_call_at'
  ) THEN
    ALTER TABLE campaign_contacts RENAME COLUMN last_call_at TO last_called_at;
  END IF;
END $$;

-- If the column doesn't exist at all, add it
ALTER TABLE campaign_contacts
ADD COLUMN IF NOT EXISTS last_called_at TIMESTAMP WITH TIME ZONE;

SELECT 'Migration 021: Column rename completed' as status;
