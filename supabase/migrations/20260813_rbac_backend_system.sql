-- ==============================================================================
-- TRACKBOOK CASHBOOKS: ROLE-BASED ACCESS CONTROL (RBAC) & INVITATION SYSTEM
-- Migration: 20260813_rbac_backend_system.sql
-- ==============================================================================

-- 1. ROLE PERMISSIONS DEFINITION TABLE
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,
  permission TEXT NOT NULL,
  is_allowed BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(role, permission)
);

-- Seed initial default permissions
INSERT INTO public.role_permissions (role, permission, is_allowed) VALUES
  ('Primary Admin', 'view_entries', true),
  ('Primary Admin', 'add_entries', true),
  ('Primary Admin', 'edit_entries', true),
  ('Primary Admin', 'delete_entries', true),
  ('Primary Admin', 'manage_members', true),
  ('Primary Admin', 'manage_roles', true),
  ('Primary Admin', 'delete_book', true),
  ('Admin', 'view_entries', true),
  ('Admin', 'add_entries', true),
  ('Admin', 'edit_entries', true),
  ('Admin', 'delete_entries', true),
  ('Admin', 'manage_members', true),
  ('Admin', 'manage_roles', true),
  ('Admin', 'delete_book', false),
  ('Book Admin', 'view_entries', true),
  ('Book Admin', 'add_entries', true),
  ('Book Admin', 'edit_entries', false),
  ('Book Admin', 'delete_entries', false),
  ('Book Admin', 'manage_members', true),
  ('Book Admin', 'manage_roles', false),
  ('Data Operator', 'view_entries', true),
  ('Data Operator', 'add_entries', true),
  ('Data Operator', 'edit_entries', false),
  ('Data Operator', 'delete_entries', false),
  ('Data Operator', 'manage_members', false),
  ('Viewer', 'view_entries', true),
  ('Viewer', 'add_entries', false),
  ('Viewer', 'edit_entries', false),
  ('Viewer', 'delete_entries', false),
  ('Viewer', 'manage_members', false)
ON CONFLICT (role, permission) DO UPDATE SET is_allowed = EXCLUDED.is_allowed;

-- 2. CASHBOOK MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.cashbook_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cashbook_id TEXT NOT NULL,
  user_id UUID,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Primary Admin', 'Admin', 'Book Admin', 'Data Operator', 'Viewer')),
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Pending', 'Inactive')),
  invitation_status TEXT DEFAULT 'Accepted' CHECK (invitation_status IN ('Draft', 'Sending', 'Sent', 'Expired', 'Accepted', 'Revoked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cashbook_id, email)
);

CREATE INDEX IF NOT EXISTS idx_cashbook_members_cashbook_id ON public.cashbook_members(cashbook_id);
CREATE INDEX IF NOT EXISTS idx_cashbook_members_user_id ON public.cashbook_members(user_id);
CREATE INDEX IF NOT EXISTS idx_cashbook_members_email ON public.cashbook_members(email);

-- 3. CASHBOOK INVITATIONS TABLE (Stored Token Hashed)
CREATE TABLE IF NOT EXISTS public.cashbook_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cashbook_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Admin', 'Book Admin', 'Data Operator', 'Viewer')),
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'Sent' CHECK (status IN ('Draft', 'Sending', 'Sent', 'Expired', 'Accepted', 'Revoked')),
  inviter_user_id UUID,
  inviter_email TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cashbook_invitations_token_hash ON public.cashbook_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_cashbook_invitations_cashbook_id ON public.cashbook_invitations(cashbook_id);

-- 4. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cashbook_id TEXT NOT NULL,
  actor_user_id UUID,
  actor_name TEXT,
  actor_email TEXT,
  target_user_id UUID,
  target_name TEXT,
  target_email TEXT,
  action TEXT NOT NULL CHECK (action IN ('MEMBER_INVITED', 'INVITATION_ACCEPTED', 'INVITATION_REVOKED', 'ROLE_CHANGED', 'MEMBER_REMOVED', 'PERMISSION_UPDATED')),
  old_role TEXT,
  new_role TEXT,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_cashbook_id ON public.audit_logs(cashbook_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.cashbook_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashbook_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper SQL Function: Get User Role in Cashbook
CREATE OR REPLACE FUNCTION public.get_user_cashbook_role(p_cashbook_id TEXT, p_user_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM public.cashbook_members 
  WHERE cashbook_id = p_cashbook_id AND user_id = p_user_id AND status = 'Active' 
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- RLS: Role Permissions (Readable by authenticated users)
DROP POLICY IF EXISTS "Allow authenticated read role_permissions" ON public.role_permissions;
CREATE POLICY "Allow authenticated read role_permissions" ON public.role_permissions
  FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- RLS: Cashbook Members
DROP POLICY IF EXISTS "Members can view cashbook member list" ON public.cashbook_members;
CREATE POLICY "Members can view cashbook member list" ON public.cashbook_members
  FOR SELECT USING (
    auth.role() = 'service_role' OR
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.cashbook_members cm 
      WHERE cm.cashbook_id = cashbook_members.cashbook_id AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can manage cashbook members" ON public.cashbook_members;
CREATE POLICY "Admins can manage cashbook members" ON public.cashbook_members
  FOR ALL USING (
    auth.role() = 'service_role' OR
    public.get_user_cashbook_role(cashbook_id, auth.uid()) IN ('Primary Admin', 'Admin', 'Book Admin')
  );

-- RLS: Cashbook Invitations
DROP POLICY IF EXISTS "Members can view invitations" ON public.cashbook_invitations;
CREATE POLICY "Members can view invitations" ON public.cashbook_invitations
  FOR SELECT USING (
    auth.role() = 'service_role' OR
    email = auth.jwt()->>'email' OR
    public.get_user_cashbook_role(cashbook_id, auth.uid()) IN ('Primary Admin', 'Admin', 'Book Admin')
  );

DROP POLICY IF EXISTS "Admins can manage invitations" ON public.cashbook_invitations;
CREATE POLICY "Admins can manage invitations" ON public.cashbook_invitations
  FOR ALL USING (
    auth.role() = 'service_role' OR
    public.get_user_cashbook_role(cashbook_id, auth.uid()) IN ('Primary Admin', 'Admin', 'Book Admin')
  );

-- RLS: Audit Logs
DROP POLICY IF EXISTS "Members can view audit logs" ON public.audit_logs;
CREATE POLICY "Members can view audit logs" ON public.audit_logs
  FOR SELECT USING (
    auth.role() = 'service_role' OR
    public.get_user_cashbook_role(cashbook_id, auth.uid()) IN ('Primary Admin', 'Admin', 'Book Admin')
  );

DROP POLICY IF EXISTS "Allow service role audit log inserts" ON public.audit_logs;
CREATE POLICY "Allow service role audit log inserts" ON public.audit_logs
  FOR INSERT WITH CHECK (true);

-- RLS: Cashbooks (Members can view cashbooks they own or are active members of)
ALTER TABLE public.cashbooks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view cashbooks they own or are members of" ON public.cashbooks;
CREATE POLICY "Users can view cashbooks they own or are members of" ON public.cashbooks
  FOR SELECT USING (
    auth.role() = 'service_role' OR
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.cashbook_members cm 
      WHERE cm.cashbook_id = cashbooks.id AND (cm.user_id = auth.uid() OR cm.email = auth.jwt()->>'email') AND cm.status = 'Active'
    )
  );

-- RLS: Entries (Members can view entries for cashbooks they belong to)
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view entries for cashbooks they belong to" ON public.entries;
CREATE POLICY "Users can view entries for cashbooks they belong to" ON public.entries
  FOR SELECT USING (
    auth.role() = 'service_role' OR
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.cashbook_members cm 
      WHERE cm.cashbook_id = entries.cashbook_id AND (cm.user_id = auth.uid() OR cm.email = auth.jwt()->>'email') AND cm.status = 'Active'
    )
  );
