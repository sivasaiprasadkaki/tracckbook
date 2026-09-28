-- ==============================================================================
-- TRACKBOOK: COMPREHENSIVE PRODUCTION ROW LEVEL SECURITY (RLS) POLICIES
-- File: supabase/migrations/20260928_comprehensive_rls_policies.sql
-- ==============================================================================

-- 1. CASHBOOKS TABLE RLS
ALTER TABLE public.cashbooks ENABLE ROW LEVEL SECURITY;

-- SELECT
DROP POLICY IF EXISTS "Users can view cashbooks they own or are members of" ON public.cashbooks;
CREATE POLICY "Users can view cashbooks they own or are members of" ON public.cashbooks
  FOR SELECT USING (
    auth.role() = 'service_role' OR
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.cashbook_members cm 
      WHERE cm.cashbook_id = cashbooks.id 
        AND (cm.user_id = auth.uid() OR cm.email = auth.jwt()->>'email') 
        AND cm.status = 'Active'
    )
  );

-- INSERT: Authenticated users can insert cashbooks they own
DROP POLICY IF EXISTS "Users can insert their own cashbooks" ON public.cashbooks;
CREATE POLICY "Users can insert their own cashbooks" ON public.cashbooks
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role' OR
    (auth.role() = 'authenticated' AND (user_id = auth.uid() OR user_id IS NULL))
  );

-- UPDATE: Owners and Admins can update cashbook details
DROP POLICY IF EXISTS "Owners and admins can update cashbooks" ON public.cashbooks;
CREATE POLICY "Owners and admins can update cashbooks" ON public.cashbooks
  FOR UPDATE USING (
    auth.role() = 'service_role' OR
    user_id = auth.uid() OR
    public.get_user_cashbook_role(id, auth.uid()) IN ('Primary Admin', 'Admin')
  ) WITH CHECK (
    auth.role() = 'service_role' OR
    user_id = auth.uid() OR
    public.get_user_cashbook_role(id, auth.uid()) IN ('Primary Admin', 'Admin')
  );

-- DELETE: Only Owners and Primary Admins can delete cashbooks
DROP POLICY IF EXISTS "Owners can delete cashbooks" ON public.cashbooks;
CREATE POLICY "Owners can delete cashbooks" ON public.cashbooks
  FOR DELETE USING (
    auth.role() = 'service_role' OR
    user_id = auth.uid() OR
    public.get_user_cashbook_role(id, auth.uid()) = 'Primary Admin'
  );


-- 2. ENTRIES TABLE RLS
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;

-- Helper check: Can user access cashbook
CREATE OR REPLACE FUNCTION public.can_access_cashbook(p_cashbook_id TEXT, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cashbooks cb
    WHERE cb.id = p_cashbook_id AND cb.user_id = p_user_id
    UNION
    SELECT 1 FROM public.cashbook_members cm
    WHERE cm.cashbook_id = p_cashbook_id 
      AND cm.user_id = p_user_id 
      AND cm.status = 'Active'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper check: Can user mutate (add/edit) entries in cashbook
CREATE OR REPLACE FUNCTION public.can_mutate_cashbook_entries(p_cashbook_id TEXT, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cashbooks cb
    WHERE cb.id = p_cashbook_id AND cb.user_id = p_user_id
    UNION
    SELECT 1 FROM public.cashbook_members cm
    WHERE cm.cashbook_id = p_cashbook_id 
      AND cm.user_id = p_user_id 
      AND cm.status = 'Active'
      AND cm.role IN ('Primary Admin', 'Admin', 'Book Admin', 'Data Operator')
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- SELECT
DROP POLICY IF EXISTS "Users can view entries for cashbooks they belong to" ON public.entries;
CREATE POLICY "Users can view entries for cashbooks they belong to" ON public.entries
  FOR SELECT USING (
    auth.role() = 'service_role' OR
    user_id = auth.uid() OR
    public.can_access_cashbook(cashbook_id, auth.uid())
  );

-- INSERT
DROP POLICY IF EXISTS "Users can insert entries into allowed cashbooks" ON public.entries;
CREATE POLICY "Users can insert entries into allowed cashbooks" ON public.entries
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role' OR
    (auth.role() = 'authenticated' AND public.can_mutate_cashbook_entries(cashbook_id, auth.uid()))
  );

-- UPDATE
DROP POLICY IF EXISTS "Users can update entries in allowed cashbooks" ON public.entries;
CREATE POLICY "Users can update entries in allowed cashbooks" ON public.entries
  FOR UPDATE USING (
    auth.role() = 'service_role' OR
    (auth.role() = 'authenticated' AND (user_id = auth.uid() OR public.can_mutate_cashbook_entries(cashbook_id, auth.uid())))
  ) WITH CHECK (
    auth.role() = 'service_role' OR
    (auth.role() = 'authenticated' AND public.can_mutate_cashbook_entries(cashbook_id, auth.uid()))
  );

-- DELETE
DROP POLICY IF EXISTS "Users can delete entries from allowed cashbooks" ON public.entries;
CREATE POLICY "Users can delete entries from allowed cashbooks" ON public.entries
  FOR DELETE USING (
    auth.role() = 'service_role' OR
    (auth.role() = 'authenticated' AND (user_id = auth.uid() OR public.can_mutate_cashbook_entries(cashbook_id, auth.uid())))
  );


-- 3. ATTACHMENTS TABLE RLS
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view attachments" ON public.attachments;
CREATE POLICY "Users can view attachments" ON public.attachments
  FOR SELECT USING (
    auth.role() = 'service_role' OR
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.entries e
      WHERE e.id = attachments.entry_id AND public.can_access_cashbook(e.cashbook_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert attachments" ON public.attachments;
CREATE POLICY "Users can insert attachments" ON public.attachments
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role' OR
    (auth.role() = 'authenticated' AND (
      user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.entries e
        WHERE e.id = attachments.entry_id AND public.can_mutate_cashbook_entries(e.cashbook_id, auth.uid())
      )
    ))
  );

DROP POLICY IF EXISTS "Users can delete attachments" ON public.attachments;
CREATE POLICY "Users can delete attachments" ON public.attachments
  FOR DELETE USING (
    auth.role() = 'service_role' OR
    (auth.role() = 'authenticated' AND (
      user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.entries e
        WHERE e.id = attachments.entry_id AND public.can_mutate_cashbook_entries(e.cashbook_id, auth.uid())
      )
    ))
  );


-- 4. AI ATTACHMENTS TABLE RLS
ALTER TABLE public.ai_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view ai_attachments" ON public.ai_attachments;
CREATE POLICY "Users can view ai_attachments" ON public.ai_attachments
  FOR SELECT USING (
    auth.role() = 'service_role' OR
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.entries e
      WHERE e.id = ai_attachments.entry_id AND public.can_access_cashbook(e.cashbook_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert ai_attachments" ON public.ai_attachments;
CREATE POLICY "Users can insert ai_attachments" ON public.ai_attachments
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role' OR
    (auth.role() = 'authenticated' AND (
      user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.entries e
        WHERE e.id = ai_attachments.entry_id AND public.can_mutate_cashbook_entries(e.cashbook_id, auth.uid())
      )
    ))
  );

DROP POLICY IF EXISTS "Users can delete ai_attachments" ON public.ai_attachments;
CREATE POLICY "Users can delete ai_attachments" ON public.ai_attachments
  FOR DELETE USING (
    auth.role() = 'service_role' OR
    (auth.role() = 'authenticated' AND (
      user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.entries e
        WHERE e.id = ai_attachments.entry_id AND public.can_mutate_cashbook_entries(e.cashbook_id, auth.uid())
      )
    ))
  );
