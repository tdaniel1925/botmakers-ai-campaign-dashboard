-- Support Tickets Migration
-- Adds support ticket system for client-admin communication

-- ============================================
-- 1. Support Tickets Table
-- ============================================
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  created_by_user_id UUID, -- client_users id who created ticket
  assigned_to_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general', -- general, billing, technical, campaign, account
  priority TEXT NOT NULL DEFAULT 'normal', -- low, normal, high, urgent
  status TEXT NOT NULL DEFAULT 'open', -- open, in_progress, waiting_on_client, resolved, closed
  resolution_notes TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_client ON support_tickets(client_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON support_tickets(assigned_to_admin_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created ON support_tickets(created_at DESC);

-- ============================================
-- 2. Support Ticket Messages Table
-- ============================================
CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE NOT NULL,
  sender_type TEXT NOT NULL, -- client, admin
  sender_id UUID, -- client_users.id or admin_users.id
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  attachments JSONB DEFAULT '[]', -- Array of {name, url, type, size}
  is_internal BOOLEAN DEFAULT false, -- Internal notes only visible to admins
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON support_ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_created ON support_ticket_messages(ticket_id, created_at);

-- ============================================
-- 3. Enable RLS
-- ============================================
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_messages ENABLE ROW LEVEL SECURITY;

-- Tickets policies
CREATE POLICY "Authenticated can read support_tickets" ON support_tickets
  FOR SELECT USING (true);

CREATE POLICY "Service role full access support_tickets" ON support_tickets
  FOR ALL USING (true);

-- Messages policies
CREATE POLICY "Authenticated can read ticket_messages" ON support_ticket_messages
  FOR SELECT USING (true);

CREATE POLICY "Service role full access ticket_messages" ON support_ticket_messages
  FOR ALL USING (true);

-- ============================================
-- 4. Update trigger for updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_support_ticket_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_support_ticket ON support_tickets;
CREATE TRIGGER trigger_update_support_ticket
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_support_ticket_timestamp();

-- ============================================
-- Done!
-- ============================================
SELECT 'Support tickets migration completed!' as status;
