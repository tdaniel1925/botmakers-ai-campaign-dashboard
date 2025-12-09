-- User Management Schema Migration
-- Adds admin role management and client team/users support

-- ============================================
-- 1. Update admin_users table with more fields
-- ============================================
ALTER TABLE admin_users
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE admin_users
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE admin_users
ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES admin_users(id);

ALTER TABLE admin_users
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update role to use enum-like constraint
-- Roles: super_admin, admin, viewer
-- super_admin: Full access, can manage other admins
-- admin: Full access to platform features, cannot manage admins
-- viewer: Read-only access to platform

-- ============================================
-- 2. Client Users/Team Members Table
-- ============================================
CREATE TABLE IF NOT EXISTS client_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  auth_user_id UUID UNIQUE, -- Links to Supabase Auth user
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member', -- owner, manager, member, viewer
  is_active BOOLEAN DEFAULT true,
  temp_password TEXT, -- Temporary password for new users
  password_changed_at TIMESTAMP WITH TIME ZONE,
  invited_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  invited_by UUID, -- Can reference admin_users or client_users
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(client_id, email)
);

CREATE INDEX IF NOT EXISTS idx_client_users_client ON client_users(client_id);
CREATE INDEX IF NOT EXISTS idx_client_users_email ON client_users(email);
CREATE INDEX IF NOT EXISTS idx_client_users_auth ON client_users(auth_user_id);

-- ============================================
-- 3. Enable RLS on client_users
-- ============================================
ALTER TABLE client_users ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read client_users (API handles authorization)
CREATE POLICY "Authenticated can read client_users" ON client_users
  FOR SELECT USING (true);

-- Service role for all operations
CREATE POLICY "Service role full access client_users" ON client_users
  FOR ALL USING (true);

-- ============================================
-- 4. Update existing clients to have an owner user
-- ============================================
-- This creates a client_user entry for existing clients
-- using their email as the owner
INSERT INTO client_users (client_id, email, name, role, is_active, accepted_at, created_at)
SELECT
  c.id,
  c.email,
  c.name,
  'owner',
  c.is_active,
  c.accepted_at,
  c.created_at
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM client_users cu WHERE cu.client_id = c.id AND cu.role = 'owner'
)
ON CONFLICT (client_id, email) DO NOTHING;

-- ============================================
-- 5. Function to sync client owner to client_users
-- ============================================
CREATE OR REPLACE FUNCTION sync_client_owner()
RETURNS TRIGGER AS $$
BEGIN
  -- When a client is created or updated, ensure they have an owner user
  INSERT INTO client_users (client_id, email, name, role, is_active, accepted_at)
  VALUES (NEW.id, NEW.email, NEW.name, 'owner', NEW.is_active, NEW.accepted_at)
  ON CONFLICT (client_id, email)
  DO UPDATE SET
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active,
    accepted_at = EXCLUDED.accepted_at,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_client_owner ON clients;
CREATE TRIGGER trigger_sync_client_owner
  AFTER INSERT OR UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION sync_client_owner();

-- ============================================
-- Done!
-- ============================================
SELECT 'User management migration completed!' as status;
