-- ============================================
-- Outbound Campaigns RLS Policies
-- Row Level Security for all outbound campaign tables
-- Version: 1.0.0
-- Date: December 2025
-- ============================================

-- ============================================
-- Helper function to check admin status
-- ============================================
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Helper function to check if user is the client
-- ============================================
CREATE OR REPLACE FUNCTION is_client_owner(client_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM clients
    WHERE id = client_id
    AND email = auth.jwt() ->> 'email'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 1. Outbound Campaigns RLS
-- ============================================
ALTER TABLE outbound_campaigns ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "admin_full_access_outbound_campaigns"
  ON outbound_campaigns
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- Clients can view their own campaigns
CREATE POLICY "client_view_own_campaigns"
  ON outbound_campaigns
  FOR SELECT
  TO authenticated
  USING (is_client_owner(client_id));

-- ============================================
-- 2. Campaign Schedules RLS
-- ============================================
ALTER TABLE campaign_schedules ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "admin_full_access_campaign_schedules"
  ON campaign_schedules
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- Clients can view schedules for their campaigns
CREATE POLICY "client_view_own_schedules"
  ON campaign_schedules
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM outbound_campaigns oc
      WHERE oc.id = campaign_schedules.campaign_id
      AND is_client_owner(oc.client_id)
    )
  );

-- ============================================
-- 3. Campaign Contacts RLS
-- ============================================
ALTER TABLE campaign_contacts ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "admin_full_access_campaign_contacts"
  ON campaign_contacts
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- Clients can view contacts for their campaigns
CREATE POLICY "client_view_own_contacts"
  ON campaign_contacts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM outbound_campaigns oc
      WHERE oc.id = campaign_contacts.campaign_id
      AND is_client_owner(oc.client_id)
    )
  );

-- ============================================
-- 4. Campaign Calls RLS
-- ============================================
ALTER TABLE campaign_calls ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "admin_full_access_campaign_calls"
  ON campaign_calls
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- Clients can view calls for their campaigns
CREATE POLICY "client_view_own_calls"
  ON campaign_calls
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM outbound_campaigns oc
      WHERE oc.id = campaign_calls.campaign_id
      AND is_client_owner(oc.client_id)
    )
  );

-- ============================================
-- 5. Campaign SMS RLS
-- ============================================
ALTER TABLE campaign_sms ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "admin_full_access_campaign_sms"
  ON campaign_sms
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- Clients can view SMS for their campaigns
CREATE POLICY "client_view_own_sms"
  ON campaign_sms
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM outbound_campaigns oc
      WHERE oc.id = campaign_sms.campaign_id
      AND is_client_owner(oc.client_id)
    )
  );

-- ============================================
-- 6. Campaign SMS Templates RLS
-- ============================================
ALTER TABLE campaign_sms_templates ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "admin_full_access_campaign_sms_templates"
  ON campaign_sms_templates
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- Clients can view SMS templates for their campaigns
CREATE POLICY "client_view_own_sms_templates"
  ON campaign_sms_templates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM outbound_campaigns oc
      WHERE oc.id = campaign_sms_templates.campaign_id
      AND is_client_owner(oc.client_id)
    )
  );

-- ============================================
-- 7. Campaign Phone Numbers RLS
-- ============================================
ALTER TABLE campaign_phone_numbers ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "admin_full_access_campaign_phone_numbers"
  ON campaign_phone_numbers
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- Clients can view phone numbers for their campaigns
CREATE POLICY "client_view_own_phone_numbers"
  ON campaign_phone_numbers
  FOR SELECT
  TO authenticated
  USING (
    is_client_owner(client_id)
    OR EXISTS (
      SELECT 1 FROM outbound_campaigns oc
      WHERE oc.id = campaign_phone_numbers.campaign_id
      AND is_client_owner(oc.client_id)
    )
  );

-- ============================================
-- 8. Campaign Billing RLS
-- ============================================
ALTER TABLE campaign_billing ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "admin_full_access_campaign_billing"
  ON campaign_billing
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- Clients can view billing for their campaigns
CREATE POLICY "client_view_own_billing"
  ON campaign_billing
  FOR SELECT
  TO authenticated
  USING (is_client_owner(client_id));

-- ============================================
-- 9. Service Role Bypass
-- These policies allow the service role to bypass RLS
-- for scheduler and webhook operations
-- ============================================

-- Allow service role full access (for QStash scheduler and webhooks)
-- Note: Service role automatically bypasses RLS in Supabase,
-- but we add explicit policies for clarity

-- Grant usage to service role (if not already)
-- This is handled by Supabase automatically

-- ============================================
-- 10. Area Code Timezone Data RLS
-- Public read access for timezone lookup
-- ============================================
ALTER TABLE area_code_timezones ENABLE ROW LEVEL SECURITY;

-- Anyone can read timezone data
CREATE POLICY "public_read_area_code_timezones"
  ON area_code_timezones
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can modify
CREATE POLICY "admin_modify_area_code_timezones"
  ON area_code_timezones
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- ============================================
-- Summary
-- ============================================
-- RLS is now enabled on all outbound campaign tables:
-- - outbound_campaigns: Admins full access, clients view own
-- - campaign_schedules: Admins full access, clients view own
-- - campaign_contacts: Admins full access, clients view own
-- - campaign_calls: Admins full access, clients view own
-- - campaign_sms: Admins full access, clients view own
-- - campaign_sms_templates: Admins full access, clients view own
-- - campaign_phone_numbers: Admins full access, clients view own
-- - campaign_billing: Admins full access, clients view own
-- - area_code_timezones: Public read, admin modify
