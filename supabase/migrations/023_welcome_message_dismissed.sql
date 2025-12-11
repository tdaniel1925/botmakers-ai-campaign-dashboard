-- Migration: Welcome Message Tracking
-- Adds column to track if client has dismissed the welcome message

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS welcome_dismissed_at TIMESTAMP WITH TIME ZONE;

-- Comment for documentation
COMMENT ON COLUMN clients.welcome_dismissed_at IS 'Timestamp when client dismissed the welcome message. NULL means not dismissed yet.';
