-- ==============================================================================
-- VoxFlow Voice Transcriptions History Schema Migration
-- Migration: 20261024000000_create_voxflow_transcriptions_schema.sql
-- Description:
--   Creates production table for private user voice-input dictations and transformations.
--   Enforces Row Level Security (RLS) so authenticated users can only access, insert,
--   update, and delete their own voice history records.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.transcriptions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Voice Dictation',
  transcript TEXT NOT NULL DEFAULT '',
  transformed_text TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT 'Auto',
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'processing', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::TEXT, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::TEXT, NOW())
);

-- Performance and query indexes
CREATE INDEX IF NOT EXISTS idx_transcriptions_user_id ON public.transcriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_transcriptions_created_at ON public.transcriptions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transcriptions_user_created_at ON public.transcriptions(user_id, created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.transcriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Authenticated users can strictly access only their own records
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'transcriptions' AND policyname = 'Users can view own transcriptions'
  ) THEN
    CREATE POLICY "Users can view own transcriptions"
      ON public.transcriptions FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'transcriptions' AND policyname = 'Users can insert own transcriptions'
  ) THEN
    CREATE POLICY "Users can insert own transcriptions"
      ON public.transcriptions FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'transcriptions' AND policyname = 'Users can update own transcriptions'
  ) THEN
    CREATE POLICY "Users can update own transcriptions"
      ON public.transcriptions FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'transcriptions' AND policyname = 'Users can delete own transcriptions'
  ) THEN
    CREATE POLICY "Users can delete own transcriptions"
      ON public.transcriptions FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Triggers for automatic updated_at timestamp
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_updated_at') THEN
    DROP TRIGGER IF EXISTS set_transcriptions_updated_at ON public.transcriptions;
    CREATE TRIGGER set_transcriptions_updated_at
      BEFORE UPDATE ON public.transcriptions
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

-- Role Privileges
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transcriptions TO authenticated;
GRANT ALL ON public.transcriptions TO service_role;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
