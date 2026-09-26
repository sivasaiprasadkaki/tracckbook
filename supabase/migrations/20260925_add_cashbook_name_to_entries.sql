-- ==============================================================================
-- TRACKBOOK MIGRATION: ADD CASHBOOK_NAME TO ENTRIES TABLE
-- File: supabase/migrations/20260925_add_cashbook_name_to_entries.sql
-- Description:
-- Adds the `cashbook_name` column to the `public.entries` table so that whenever
-- the entries table is viewed in Supabase Table Editor, the cashbook's name is
-- visible right next to `cashbook_id`. Also backfills existing entries.
-- ==============================================================================

-- 1. Add `cashbook_name` column to `public.entries` if it does not already exist
ALTER TABLE public.entries 
ADD COLUMN IF NOT EXISTS cashbook_name TEXT;

-- 2. Backfill all existing rows in `public.entries` with the cashbook name from `public.cashbooks`
UPDATE public.entries e
SET cashbook_name = c.name
FROM public.cashbooks c
WHERE e.cashbook_id = c.id
  AND (e.cashbook_name IS NULL OR e.cashbook_name = '');

-- 3. Optional: Create an index on cashbook_name for fast filtering / searching
CREATE INDEX IF NOT EXISTS idx_entries_cashbook_name ON public.entries(cashbook_name);

-- 4. Verify columns
COMMENT ON COLUMN public.entries.cashbook_name IS 'The human-readable name of the cashbook this entry belongs to';
