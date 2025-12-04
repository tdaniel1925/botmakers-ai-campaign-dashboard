-- Webhook Infrastructure Migration
-- Adds indexes and constraints for high-volume webhook processing

-- ============================================
-- 1. Add unique constraint on external_call_id per campaign
-- Prevents duplicate webhook processing at database level
-- ============================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_calls_external_call_id_campaign
  ON calls(campaign_id, external_call_id)
  WHERE external_call_id IS NOT NULL;

-- ============================================
-- 2. Performance indexes for calls table
-- ============================================

-- Index for fetching calls by campaign with status filter (common query)
CREATE INDEX IF NOT EXISTS idx_calls_campaign_status
  ON calls(campaign_id, status);

-- Index for fetching recent calls (common dashboard query)
CREATE INDEX IF NOT EXISTS idx_calls_created_at_desc
  ON calls(created_at DESC);

-- Index for AI processing queue (find processing/pending calls)
CREATE INDEX IF NOT EXISTS idx_calls_status_processing
  ON calls(status, created_at)
  WHERE status IN ('processing', 'pending', 'ai_failed');

-- Index for call timestamps (analytics and filtering)
CREATE INDEX IF NOT EXISTS idx_calls_timestamp
  ON calls(call_timestamp DESC NULLS LAST);

-- ============================================
-- 3. Performance indexes for webhook_logs table
-- ============================================

-- Index for fetching logs by campaign with pagination
CREATE INDEX IF NOT EXISTS idx_webhook_logs_campaign_created
  ON webhook_logs(campaign_id, created_at DESC);

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status
  ON webhook_logs(status);

-- ============================================
-- 4. Performance indexes for campaigns table
-- ============================================

-- Index for webhook token lookup (critical path)
CREATE INDEX IF NOT EXISTS idx_campaigns_webhook_token
  ON campaigns(webhook_token)
  WHERE webhook_token IS NOT NULL;

-- Index for active campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_active
  ON campaigns(is_active, client_id);

-- ============================================
-- 5. Add error tracking columns to calls if not exists
-- ============================================
ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS error_message TEXT;

ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMP WITH TIME ZONE;

-- ============================================
-- 6. Create webhook processing stats view
-- ============================================
CREATE OR REPLACE VIEW webhook_processing_stats AS
SELECT
  c.id as campaign_id,
  c.name as campaign_name,
  COUNT(DISTINCT calls.id) as total_calls,
  COUNT(DISTINCT calls.id) FILTER (WHERE calls.status = 'completed') as completed_calls,
  COUNT(DISTINCT calls.id) FILTER (WHERE calls.status = 'processing') as processing_calls,
  COUNT(DISTINCT calls.id) FILTER (WHERE calls.status = 'ai_failed') as failed_calls,
  COUNT(DISTINCT wl.id) as total_webhooks,
  COUNT(DISTINCT wl.id) FILTER (WHERE wl.status = 'success') as successful_webhooks,
  COUNT(DISTINCT wl.id) FILTER (WHERE wl.status = 'failed') as failed_webhooks,
  AVG(calls.call_duration) as avg_call_duration,
  MAX(calls.created_at) as last_call_at
FROM campaigns c
LEFT JOIN calls ON calls.campaign_id = c.id
LEFT JOIN webhook_logs wl ON wl.campaign_id = c.id
GROUP BY c.id, c.name;

-- ============================================
-- 7. Function to clean up old webhook logs (keep 30 days)
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_old_webhook_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM webhook_logs
  WHERE created_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. Function to retry failed AI processing
-- ============================================
CREATE OR REPLACE FUNCTION get_calls_for_retry(max_retries INTEGER DEFAULT 3)
RETURNS TABLE(
  call_id UUID,
  campaign_id UUID,
  transcript TEXT,
  retry_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id as call_id,
    c.campaign_id,
    c.transcript,
    c.retry_count
  FROM calls c
  WHERE c.status = 'ai_failed'
    AND c.retry_count < max_retries
    AND (c.last_retry_at IS NULL OR c.last_retry_at < NOW() - INTERVAL '5 minutes')
  ORDER BY c.created_at ASC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Done!
-- ============================================
SELECT 'Webhook infrastructure migration completed!' as status;
