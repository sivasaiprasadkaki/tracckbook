-- Migration: Create whatsapp_messages tracking table
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  cashbook_id TEXT,
  recipient_phone TEXT NOT NULL,
  message_id TEXT UNIQUE,
  document_type TEXT NOT NULL,
  file_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Allow authenticated select whatsapp_messages" ON public.whatsapp_messages;
CREATE POLICY "Allow authenticated select whatsapp_messages" ON public.whatsapp_messages
  FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Allow service role insert and update whatsapp_messages" ON public.whatsapp_messages;
CREATE POLICY "Allow service role insert and update whatsapp_messages" ON public.whatsapp_messages
  FOR ALL USING (true);

-- Ensure storage bucket 'reports' exists for WhatsApp document uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', true)
ON CONFLICT (id) DO NOTHING;
