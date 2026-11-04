-- ==============================================================================
-- VoxFlow Usage Quotas Schema: Add User Name Column
-- Migration: 20261105000000_add_user_name_to_usage_quotas.sql
-- Description:
--   Adds user_name column to public.usage_quotas and backfills from public.profiles
-- ==============================================================================

ALTER TABLE public.usage_quotas
  ADD COLUMN IF NOT EXISTS user_name TEXT;

-- Backfill user_name from public.profiles if profile exists
UPDATE public.usage_quotas uq
SET user_name = p.full_name
FROM public.profiles p
WHERE uq.user_id = p.id AND uq.user_name IS NULL AND p.full_name IS NOT NULL;

NOTIFY pgrst, 'reload schema';
