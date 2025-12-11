-- ============================================
-- Migration: Optimize campaign_contacts query performance
-- Add covering index for pagination queries
-- ============================================

-- Drop existing index if it exists (we're replacing it with a better one)
DROP INDEX IF EXISTS idx_campaign_contacts_campaign_created;

-- Create a covering index for the main contacts list query
-- This index covers: campaign_id filter, created_at order, and includes commonly selected columns
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_pagination
ON campaign_contacts (campaign_id, created_at DESC)
INCLUDE (id, phone_number, first_name, last_name, email, status, outcome, call_attempts, last_called_at, timezone);

-- Add index for status filtering within a campaign
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_campaign_status_created
ON campaign_contacts (campaign_id, status, created_at DESC);

-- Add index for outcome filtering within a campaign
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_campaign_outcome_created
ON campaign_contacts (campaign_id, outcome, created_at DESC);

SELECT 'Migration 022: Contacts query optimization indexes created' as status;
