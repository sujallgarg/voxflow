-- ==============================================================================
-- VoxFlow Usage Quotas Schema Expansion
-- Migration: 20261022000000_expand_usage_quotas_schema.sql
-- Description:
--   Expands public.usage_quotas to accurately track:
--     1. transcription_seconds_used (exact audio duration processed in seconds)
--     2. voice_typing_used (voice-input transcription requests)
--     3. text_corrections_used (AI text transformations / corrections)
--     4. meeting_summaries_used (AI meeting summary generations)
--     5. top_up_credits_remaining (purchased top-up credits preserved across resets)
-- ==============================================================================

ALTER TABLE public.usage_quotas
  ADD COLUMN IF NOT EXISTS transcription_seconds_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS voice_typing_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS text_corrections_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meeting_summaries_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS top_up_credits_remaining INTEGER NOT NULL DEFAULT 0;

-- Backfill legacy records if necessary
UPDATE public.usage_quotas
SET voice_typing_used = voice_transcriptions_used
WHERE voice_typing_used = 0 AND voice_transcriptions_used > 0;

-- Ensure RLS is enabled and proper permissions are retained
ALTER TABLE public.usage_quotas ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.usage_quotas TO authenticated;
GRANT ALL ON public.usage_quotas TO service_role;

NOTIFY pgrst, 'reload schema';
