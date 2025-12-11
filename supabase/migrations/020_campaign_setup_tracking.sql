-- Migration: Campaign Setup Tracking & Background Upload Queue
-- Adds setup step tracking for campaigns and background upload processing

-- ============================================
-- Add setup tracking columns to outbound_campaigns
-- ============================================
ALTER TABLE outbound_campaigns
ADD COLUMN IF NOT EXISTS setup_step integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS setup_data jsonb DEFAULT '{}';

-- Comment for documentation
COMMENT ON COLUMN outbound_campaigns.setup_step IS 'Current wizard step (1-9) for resume functionality';
COMMENT ON COLUMN outbound_campaigns.setup_data IS 'JSON storage for wizard form data to restore on resume';

-- ============================================
-- Contact Upload Queue Table
-- For background processing of large CSV uploads
-- ============================================
CREATE TABLE IF NOT EXISTS contact_upload_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES outbound_campaigns(id) ON DELETE CASCADE NOT NULL,

  -- Upload tracking
  file_name text,
  total_contacts integer NOT NULL DEFAULT 0,
  processed_contacts integer NOT NULL DEFAULT 0,
  successful_contacts integer NOT NULL DEFAULT 0,
  failed_contacts integer NOT NULL DEFAULT 0,
  duplicate_contacts integer NOT NULL DEFAULT 0,

  -- Status: pending, processing, completed, failed, cancelled
  status text NOT NULL DEFAULT 'pending',
  error_message text,

  -- Contact data (stored in chunks for processing)
  pending_data jsonb NOT NULL DEFAULT '[]',

  -- Processing metadata
  chunk_size integer DEFAULT 500,
  current_chunk integer DEFAULT 0,

  -- Timestamps
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Index for finding pending uploads
CREATE INDEX IF NOT EXISTS idx_contact_upload_queue_status
ON contact_upload_queue(status) WHERE status IN ('pending', 'processing');

-- Index for finding uploads by campaign
CREATE INDEX IF NOT EXISTS idx_contact_upload_queue_campaign
ON contact_upload_queue(campaign_id);

-- RLS Policies for contact_upload_queue
ALTER TABLE contact_upload_queue ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage upload queue" ON contact_upload_queue
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- Clients can view their own campaign uploads
CREATE POLICY "Clients can view own campaign uploads" ON contact_upload_queue
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM outbound_campaigns oc
      JOIN clients c ON oc.client_id = c.id
      WHERE oc.id = contact_upload_queue.campaign_id
      AND c.email = auth.jwt() ->> 'email'
    )
  );

-- ============================================
-- Function to process upload queue
-- Called by a cron job or triggered manually
-- ============================================
CREATE OR REPLACE FUNCTION process_contact_upload_chunk(queue_id uuid)
RETURNS jsonb AS $$
DECLARE
  queue_record contact_upload_queue%ROWTYPE;
  chunk_data jsonb;
  contact_record jsonb;
  insert_result record;
  processed_count integer := 0;
  success_count integer := 0;
  fail_count integer := 0;
  dupe_count integer := 0;
  chunk_start integer;
  chunk_end integer;
BEGIN
  -- Lock the queue record
  SELECT * INTO queue_record
  FROM contact_upload_queue
  WHERE id = queue_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Queue record not found');
  END IF;

  IF queue_record.status NOT IN ('pending', 'processing') THEN
    RETURN jsonb_build_object('error', 'Queue is not in processable state', 'status', queue_record.status);
  END IF;

  -- Update status to processing
  UPDATE contact_upload_queue
  SET status = 'processing',
      started_at = COALESCE(started_at, now()),
      updated_at = now()
  WHERE id = queue_id;

  -- Calculate chunk boundaries
  chunk_start := queue_record.current_chunk * queue_record.chunk_size;
  chunk_end := chunk_start + queue_record.chunk_size;

  -- Get the chunk of contacts to process
  SELECT jsonb_agg(elem)
  INTO chunk_data
  FROM (
    SELECT elem
    FROM jsonb_array_elements(queue_record.pending_data) WITH ORDINALITY AS t(elem, ord)
    WHERE ord > chunk_start AND ord <= chunk_end
  ) sub;

  -- If no more data, mark as completed
  IF chunk_data IS NULL OR jsonb_array_length(chunk_data) = 0 THEN
    UPDATE contact_upload_queue
    SET status = 'completed',
        completed_at = now(),
        updated_at = now()
    WHERE id = queue_id;

    -- Update campaign total_contacts
    UPDATE outbound_campaigns
    SET total_contacts = (
      SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = queue_record.campaign_id
    ),
    updated_at = now()
    WHERE id = queue_record.campaign_id;

    RETURN jsonb_build_object(
      'status', 'completed',
      'total_processed', queue_record.processed_contacts,
      'successful', queue_record.successful_contacts,
      'failed', queue_record.failed_contacts,
      'duplicates', queue_record.duplicate_contacts
    );
  END IF;

  -- Process each contact in the chunk
  FOR contact_record IN SELECT * FROM jsonb_array_elements(chunk_data)
  LOOP
    BEGIN
      INSERT INTO campaign_contacts (
        campaign_id,
        phone_number,
        first_name,
        last_name,
        email,
        timezone,
        custom_data
      ) VALUES (
        queue_record.campaign_id,
        contact_record->>'phone_number',
        contact_record->>'first_name',
        contact_record->>'last_name',
        contact_record->>'email',
        contact_record->>'timezone',
        contact_record - 'phone_number' - 'first_name' - 'last_name' - 'email' - 'timezone'
      )
      ON CONFLICT (campaign_id, phone_number) DO NOTHING;

      IF FOUND THEN
        success_count := success_count + 1;
      ELSE
        dupe_count := dupe_count + 1;
      END IF;

      processed_count := processed_count + 1;
    EXCEPTION WHEN OTHERS THEN
      fail_count := fail_count + 1;
      processed_count := processed_count + 1;
    END;
  END LOOP;

  -- Update queue record with progress
  UPDATE contact_upload_queue
  SET processed_contacts = processed_contacts + processed_count,
      successful_contacts = successful_contacts + success_count,
      failed_contacts = failed_contacts + fail_count,
      duplicate_contacts = duplicate_contacts + dupe_count,
      current_chunk = current_chunk + 1,
      updated_at = now()
  WHERE id = queue_id;

  RETURN jsonb_build_object(
    'status', 'processing',
    'chunk_processed', processed_count,
    'chunk_successful', success_count,
    'chunk_failed', fail_count,
    'chunk_duplicates', dupe_count,
    'has_more', true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Trigger to update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_contact_upload_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contact_upload_queue_updated_at ON contact_upload_queue;
CREATE TRIGGER contact_upload_queue_updated_at
  BEFORE UPDATE ON contact_upload_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_upload_queue_updated_at();
