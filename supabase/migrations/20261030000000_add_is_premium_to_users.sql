-- ==============================================================================
-- VoxFlow Users Premium Status Schema Migration
-- Migration: 20261030000000_add_is_premium_to_users.sql
-- Description:
--   Adds isPremium boolean status field to existing users table(s).
--   Default value is false (false = Free user, true = Premium user).
--   Preserves all existing user records, foreign key relationships, and data integrity.
--   Ensures existing users automatically receive false as their default value.
-- ==============================================================================

-- 1. Ensure public.profiles (VoxFlow user profiles table synced with auth.users) has isPremium field
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS "isPremium" BOOLEAN NOT NULL DEFAULT FALSE;

    COMMENT ON COLUMN public.profiles."isPremium" IS 'VoxFlow Premium user status: true = Premium user, false = Free user';
  END IF;
END $$;

-- 2. Ensure public.users table exists and has isPremium field
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  "isPremium" BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::TEXT, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::TEXT, NOW())
);

-- Safely add isPremium column if public.users already existed without it
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS "isPremium" BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.users."isPremium" IS 'VoxFlow Premium user status: true = Premium user, false = Free user';

-- Index on email and isPremium for fast lookup
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_premium ON public.users("isPremium");

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users RLS Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can view own user record'
  ) THEN
    CREATE POLICY "Users can view own user record"
      ON public.users FOR SELECT
      USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can update own user record'
  ) THEN
    CREATE POLICY "Users can update own user record"
      ON public.users FOR UPDATE
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- 3. Automatic user sync trigger from auth.users (populates both profiles and users)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Populate public.profiles if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    INSERT INTO public.profiles (id, email, full_name, avatar_url, "isPremium")
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
      COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
      COALESCE((NEW.raw_user_meta_data->>'isPremium')::BOOLEAN, FALSE)
    )
    ON CONFLICT (id) DO UPDATE
    SET
      email = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
      updated_at = TIMEZONE('utc'::TEXT, NOW());
  END IF;

  -- Populate public.users
  INSERT INTO public.users (id, email, full_name, avatar_url, "isPremium")
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    COALESCE((NEW.raw_user_meta_data->>'isPremium')::BOOLEAN, FALSE)
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    updated_at = TIMEZONE('utc'::TEXT, NOW());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Backfill existing auth.users into public.users with isPremium = false
INSERT INTO public.users (id, email, full_name, avatar_url, "isPremium", created_at, updated_at)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', ''),
  COALESCE(raw_user_meta_data->>'avatar_url', ''),
  COALESCE((raw_user_meta_data->>'isPremium')::BOOLEAN, FALSE),
  created_at,
  updated_at
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET
  "isPremium" = COALESCE(public.users."isPremium", FALSE);

-- Backfill public.profiles if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    INSERT INTO public.profiles (id, email, full_name, avatar_url, "isPremium", created_at, updated_at)
    SELECT 
      id,
      email,
      COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', ''),
      COALESCE(raw_user_meta_data->>'avatar_url', ''),
      COALESCE((raw_user_meta_data->>'isPremium')::BOOLEAN, FALSE),
      created_at,
      updated_at
    FROM auth.users
    ON CONFLICT (id) DO UPDATE
    SET
      "isPremium" = COALESCE(public.profiles."isPremium", FALSE);
  END IF;
END $$;

-- 5. Role Privileges & Schema Exposure
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON public.users TO anon, authenticated, service_role;
GRANT ALL ON public.users TO service_role;

-- 6. Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
