-- ==============================================================================
-- VoxFlow Add-on Credits Schema Migration
-- Migration: 20261026000000_create_addon_credits_table.sql
-- Description:
--   Creates production ledger table for purchased add-on credits.
--   Enforces:
--     1. Separation of recurring plan allowances from purchased credits
--     2. Payment idempotency via unique (user_id, payment_id, quota_type) constraint
--     3. Expiry tracking and ordered consumption (earliest expiry first)
--     4. Strict Row Level Security (RLS) so users can only view their own credits
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.addon_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quota_type TEXT NOT NULL CHECK (
    quota_type IN ('transcription_minutes', 'voice_typing', 'text_correction', 'meeting', 'ai_summary')
  ),
  amount INTEGER NOT NULL CHECK (amount > 0),
  used_amount INTEGER NOT NULL DEFAULT 0 CHECK (used_amount >= 0 AND used_amount <= amount),
  payment_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::TEXT, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::TEXT, NOW())
);

-- Indexes for performance and lookup
CREATE INDEX IF NOT EXISTS idx_addon_credits_user_id ON public.addon_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_addon_credits_user_quota ON public.addon_credits(user_id, quota_type);
CREATE INDEX IF NOT EXISTS idx_addon_credits_expiry ON public.addon_credits(expires_at) WHERE expires_at IS NOT NULL;

-- Strict idempotency: Prevent duplicate credit grants from replayed or duplicate payment webhooks
CREATE UNIQUE INDEX IF NOT EXISTS idx_addon_credits_idempotency 
  ON public.addon_credits (user_id, payment_id, quota_type);

-- Enable Row Level Security (RLS)
ALTER TABLE public.addon_credits ENABLE ROW LEVEL SECURITY;

-- Addon Credits RLS: Authenticated users can view only their own credits
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'addon_credits' AND policyname = 'Users can view own addon credits'
  ) THEN
    CREATE POLICY "Users can view own addon credits"
      ON public.addon_credits FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Grants
GRANT SELECT ON public.addon_credits TO authenticated;
GRANT ALL ON public.addon_credits TO service_role;

NOTIFY pgrst, 'reload schema';
