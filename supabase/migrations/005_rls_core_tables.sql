-- ============================================
-- Migration: Add RLS to Core Tables
-- This enables clients to see their own data
-- ============================================

-- ============================================
-- Enable RLS on core tables
-- ============================================
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_outcome_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CLIENTS TABLE POLICIES
-- ============================================

-- Clients can view their own profile (matched by email from JWT or user id)
-- Note: Also allows admins to view all clients
CREATE POLICY "Clients can view own profile"
  ON clients
  FOR SELECT
  USING (
    email = auth.jwt()->>'email'
    OR
    id::text = auth.jwt()->>'sub'
    OR
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

-- Clients can update their own profile
CREATE POLICY "Clients can update own profile"
  ON clients
  FOR UPDATE
  USING (email = auth.jwt()->>'email')
  WITH CHECK (email = auth.jwt()->>'email');

-- Service role can do everything
CREATE POLICY "Service role full access to clients"
  ON clients
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- CAMPAIGNS TABLE POLICIES
-- ============================================

-- Clients can view their own campaigns
CREATE POLICY "Clients can view own campaigns"
  ON campaigns
  FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients WHERE email = auth.jwt()->>'email'
    )
    OR
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

-- Service role can do everything
CREATE POLICY "Service role full access to campaigns"
  ON campaigns
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- CALLS TABLE POLICIES
-- ============================================

-- Clients can view calls from their campaigns
CREATE POLICY "Clients can view own calls"
  ON calls
  FOR SELECT
  USING (
    campaign_id IN (
      SELECT c.id FROM campaigns c
      INNER JOIN clients cl ON c.client_id = cl.id
      WHERE cl.email = auth.jwt()->>'email'
    )
    OR
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

-- Service role can do everything
CREATE POLICY "Service role full access to calls"
  ON calls
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- WEBHOOK_LOGS TABLE POLICIES
-- ============================================

-- Clients can view webhook logs from their campaigns
CREATE POLICY "Clients can view own webhook logs"
  ON webhook_logs
  FOR SELECT
  USING (
    campaign_id IN (
      SELECT c.id FROM campaigns c
      INNER JOIN clients cl ON c.client_id = cl.id
      WHERE cl.email = auth.jwt()->>'email'
    )
    OR
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

-- Service role can do everything
CREATE POLICY "Service role full access to webhook_logs"
  ON webhook_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- CAMPAIGN_OUTCOME_TAGS TABLE POLICIES
-- ============================================

-- Clients can view outcome tags from their campaigns
CREATE POLICY "Clients can view own campaign tags"
  ON campaign_outcome_tags
  FOR SELECT
  USING (
    campaign_id IN (
      SELECT c.id FROM campaigns c
      INNER JOIN clients cl ON c.client_id = cl.id
      WHERE cl.email = auth.jwt()->>'email'
    )
    OR
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

-- Service role can do everything
CREATE POLICY "Service role full access to campaign_outcome_tags"
  ON campaign_outcome_tags
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- ADMIN_USERS TABLE POLICIES
-- ============================================

-- Users can check if they are an admin (by checking their own row)
-- Admins can also view all admin users
CREATE POLICY "Users can check own admin status"
  ON admin_users
  FOR SELECT
  USING (
    id = auth.uid()
    OR
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

-- Service role can do everything
CREATE POLICY "Service role full access to admin_users"
  ON admin_users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- PLATFORM_SETTINGS TABLE POLICIES
-- ============================================

-- Anyone authenticated can read platform settings (for logo, etc.)
CREATE POLICY "Anyone can read platform settings"
  ON platform_settings
  FOR SELECT
  USING (true);

-- Service role can do everything
CREATE POLICY "Service role full access to platform_settings"
  ON platform_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Done!
-- ============================================
