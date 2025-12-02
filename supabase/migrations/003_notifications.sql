-- Migration: Add Notifications table
-- Run this in your Supabase SQL Editor

-- ============================================
-- Notifications Table
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_type TEXT NOT NULL, -- 'admin' or 'client'
  type TEXT NOT NULL, -- 'info', 'warning', 'error', 'success'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_type ON notifications(user_type);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================
-- Row Level Security Policies
-- ============================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Admins can see all their notifications
CREATE POLICY "Admins can view their notifications"
  ON notifications
  FOR SELECT
  USING (
    user_type = 'admin' AND user_id = auth.uid()
  );

-- Clients can see their notifications
CREATE POLICY "Clients can view their notifications"
  ON notifications
  FOR SELECT
  USING (
    user_type = 'client' AND user_id IN (
      SELECT id FROM clients WHERE email = auth.jwt()->>'email'
    )
  );

-- Users can mark their notifications as read
CREATE POLICY "Users can update their notifications"
  ON notifications
  FOR UPDATE
  USING (
    (user_type = 'admin' AND user_id = auth.uid())
    OR
    (user_type = 'client' AND user_id IN (
      SELECT id FROM clients WHERE email = auth.jwt()->>'email'
    ))
  );

-- Service role can manage all notifications
CREATE POLICY "Service role can manage notifications"
  ON notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
