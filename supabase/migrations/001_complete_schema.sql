-- Complete Database Schema Migration
-- Run this in Supabase SQL Editor to create all missing tables

-- ============================================
-- 1. Add dark mode logo column to platform_settings
-- ============================================
ALTER TABLE platform_settings
ADD COLUMN IF NOT EXISTS logo_url_dark TEXT;

-- ============================================
-- 1b. Add billing tier columns to clients
-- ============================================
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS billing_tier TEXT DEFAULT 'standard'; -- free, standard, premium

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS billing_notes TEXT; -- Admin notes about billing arrangement

-- ============================================
-- 2. Billing Rates Table
-- ============================================
CREATE TABLE IF NOT EXISTS billing_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_type TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  unit_price DECIMAL(10, 4) NOT NULL,
  unit_name TEXT NOT NULL,
  minimum_charge DECIMAL(10, 2) DEFAULT '0',
  free_allowance INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. Client Billing Accounts Table
-- ============================================
CREATE TABLE IF NOT EXISTS client_billing_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL UNIQUE,
  current_balance DECIMAL(10, 2) DEFAULT '0',
  status TEXT NOT NULL DEFAULT 'active', -- active, suspended, past_due
  auto_charge_threshold DECIMAL(10, 2) DEFAULT '50',
  auto_charge_enabled BOOLEAN DEFAULT true,
  last_charge_at TIMESTAMP WITH TIME ZONE,
  last_charge_amount DECIMAL(10, 2),
  failed_payment_count INTEGER DEFAULT 0,
  last_failed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 4. Client Payment Methods Table
-- ============================================
CREATE TABLE IF NOT EXISTS client_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  payment_provider TEXT NOT NULL DEFAULT 'stripe', -- stripe, paypal, square
  stripe_customer_id TEXT,
  stripe_payment_method_id TEXT,
  paypal_payer_id TEXT,
  paypal_vault_id TEXT,
  square_customer_id TEXT,
  square_card_id TEXT,
  card_brand TEXT,
  card_last4 TEXT,
  card_exp_month INTEGER,
  card_exp_year INTEGER,
  is_default BOOLEAN DEFAULT true,
  is_valid BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 5. Usage Records Table
-- ============================================
CREATE TABLE IF NOT EXISTS usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  rate_type TEXT NOT NULL,
  quantity DECIMAL(12, 4) NOT NULL,
  unit_price DECIMAL(10, 4) NOT NULL,
  total_amount DECIMAL(10, 4) NOT NULL,
  reference_type TEXT, -- call, api_request, workflow
  reference_id UUID,
  description TEXT,
  billing_period TEXT NOT NULL, -- YYYY-MM format
  invoice_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient billing queries
CREATE INDEX IF NOT EXISTS idx_usage_records_client_period ON usage_records(client_id, billing_period);
CREATE INDEX IF NOT EXISTS idx_usage_records_reference ON usage_records(reference_type, reference_id);

-- ============================================
-- 6. Billing History / Invoices Table
-- ============================================
CREATE TABLE IF NOT EXISTS billing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  payment_provider TEXT DEFAULT 'stripe',
  stripe_invoice_id TEXT,
  stripe_payment_intent_id TEXT,
  paypal_transaction_id TEXT,
  paypal_capture_id TEXT,
  square_payment_id TEXT,
  square_order_id TEXT,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL, -- paid, open, void, uncollectible, refunded
  description TEXT,
  invoice_pdf_url TEXT,
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_history_client ON billing_history(client_id);
CREATE INDEX IF NOT EXISTS idx_billing_history_status ON billing_history(status);

-- ============================================
-- 7. Audit Logs Table
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_type TEXT NOT NULL, -- admin, client
  user_email TEXT,
  action TEXT NOT NULL, -- created, updated, deleted, login, logout, password_reset, etc.
  resource_type TEXT NOT NULL, -- client, campaign, call, settings, etc.
  resource_id UUID,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- ============================================
-- 8. Notifications Table
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_type TEXT NOT NULL, -- admin, client
  type TEXT NOT NULL, -- info, warning, error, success, call_received, report_ready
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT, -- Optional link to related resource
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, user_type, is_read) WHERE is_read = false;

-- ============================================
-- 9. Login Attempts Table (for rate limiting)
-- ============================================
CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address, created_at DESC);

-- Auto-cleanup old login attempts (keep 30 days)
-- This can be run periodically via a cron job
-- DELETE FROM login_attempts WHERE created_at < NOW() - INTERVAL '30 days';

-- ============================================
-- 10. User Sessions Table (for session management)
-- ============================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_type TEXT NOT NULL, -- admin, client
  session_token TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  user_agent TEXT,
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active, expires_at);

-- ============================================
-- Enable Row Level Security on all tables
-- ============================================
ALTER TABLE billing_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_billing_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies
-- ============================================

-- Billing Rates: Anyone authenticated can read, service role for write
CREATE POLICY "Anyone can read billing_rates" ON billing_rates FOR SELECT USING (true);

-- Client Billing Accounts: Clients can view their own, admins can view all
CREATE POLICY "Clients can view own billing account" ON client_billing_accounts
  FOR SELECT USING (true);

-- Client Payment Methods: Clients can view their own
CREATE POLICY "Clients can view own payment methods" ON client_payment_methods
  FOR SELECT USING (true);

-- Usage Records: Clients can view their own
CREATE POLICY "Clients can view own usage" ON usage_records
  FOR SELECT USING (true);

-- Billing History: Clients can view their own
CREATE POLICY "Clients can view own billing history" ON billing_history
  FOR SELECT USING (true);

-- Audit Logs: Service role only (accessed via API)
CREATE POLICY "Service role access for audit_logs" ON audit_logs
  FOR ALL USING (true);

-- Notifications: Users can view their own
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (true);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (true);

-- Login Attempts: Service role only
CREATE POLICY "Service role access for login_attempts" ON login_attempts
  FOR ALL USING (true);

-- User Sessions: Service role only
CREATE POLICY "Service role access for user_sessions" ON user_sessions
  FOR ALL USING (true);

-- ============================================
-- Seed Default Billing Rates
-- ============================================
INSERT INTO billing_rates (rate_type, display_name, description, unit_price, unit_name, minimum_charge, free_allowance, is_active)
VALUES
  ('call_minutes', 'Call Minutes', 'Per minute charge for AI call processing and analysis', 0.05, 'minute', 0, 0, true),
  ('api_calls', 'API Calls', 'Per call charge for API requests', 0.001, 'call', 0, 1000, true),
  ('workflows', 'Workflow Executions', 'Per execution charge for automated workflows', 0.02, 'execution', 0, 100, true)
ON CONFLICT (rate_type) DO NOTHING;

-- ============================================
-- Function to auto-create billing account for new clients
-- ============================================
CREATE OR REPLACE FUNCTION create_client_billing_account()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO client_billing_accounts (client_id)
  VALUES (NEW.id)
  ON CONFLICT (client_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create billing account
DROP TRIGGER IF EXISTS trigger_create_billing_account ON clients;
CREATE TRIGGER trigger_create_billing_account
  AFTER INSERT ON clients
  FOR EACH ROW
  EXECUTE FUNCTION create_client_billing_account();

-- Create billing accounts for existing clients
INSERT INTO client_billing_accounts (client_id)
SELECT id FROM clients
WHERE id NOT IN (SELECT client_id FROM client_billing_accounts)
ON CONFLICT (client_id) DO NOTHING;

-- ============================================
-- Done!
-- ============================================
SELECT 'Migration completed successfully!' as status;
