-- Audit logs table for tracking user actions
-- This table is used for compliance, debugging, and security monitoring

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email TEXT,
    user_type TEXT CHECK (user_type IN ('admin', 'client')),
    resource_type TEXT,
    resource_id TEXT,
    details JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view all audit logs" ON audit_logs
    FOR SELECT
    USING (
        auth.uid() IN (SELECT id FROM admin_users)
    );

-- Service role can insert audit logs
CREATE POLICY "Service role can insert audit logs" ON audit_logs
    FOR INSERT
    WITH CHECK (true);

-- Add comment for documentation
COMMENT ON TABLE audit_logs IS 'Audit trail for tracking user actions across the system';
COMMENT ON COLUMN audit_logs.action IS 'The type of action performed (login, client_create, etc.)';
COMMENT ON COLUMN audit_logs.user_type IS 'Whether the user is an admin or client';
COMMENT ON COLUMN audit_logs.resource_type IS 'The type of resource affected (client, campaign, call, etc.)';
COMMENT ON COLUMN audit_logs.resource_id IS 'The ID of the affected resource';
COMMENT ON COLUMN audit_logs.details IS 'Additional JSON details about the action';
