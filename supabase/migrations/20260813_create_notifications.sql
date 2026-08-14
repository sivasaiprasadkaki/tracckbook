-- ==============================================================================
-- TRACKBOOK NOTIFICATIONS SYSTEM
-- Migration: 20260813_create_notifications.sql
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'cashbook_invitation',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  cashbook_id TEXT,
  invitation_id UUID REFERENCES public.cashbook_invitations(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(user_id, is_read);

-- Expand cashbook_invitations check constraint to support pending, accepted, rejected, expired, revoked
ALTER TABLE public.cashbook_invitations DROP CONSTRAINT IF EXISTS cashbook_invitations_status_check;
ALTER TABLE public.cashbook_invitations ADD CONSTRAINT cashbook_invitations_status_check
  CHECK (status IN ('Draft', 'Sending', 'Sent', 'pending', 'Expired', 'Accepted', 'accepted', 'Declined', 'rejected', 'Revoked'));

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (auth.role() = 'service_role' OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (auth.role() = 'service_role' OR user_id = auth.uid());

DROP POLICY IF EXISTS "Allow service role notifications inserts" ON public.notifications;
CREATE POLICY "Allow service role notifications inserts" ON public.notifications
  FOR INSERT WITH CHECK (true);
