-- ============================================================
-- AI-LED ONBOARDING SCHEMA
-- ============================================================
-- Updates profiles table to support AI-driven onboarding flow
-- ============================================================

-- 1. Add new columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS username TEXT,
ADD COLUMN IF NOT EXISTS intent TEXT CHECK (intent IN ('learn', 'create', 'both')),
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- 2. Add Unique Constraint on Username
-- We use a unique index to enforce uniqueness where username is not null
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_idx ON public.profiles (username) WHERE username IS NOT NULL;

-- 3. Add RLS Policies for Onboarding (if needed)
-- Users can already update their own profile, so standard policies should cover it.
-- But let's ensure they can read/update these specific fields.

-- Verify existing policies allow update (usually "Users can update own profile")

-- 4. Create function to check username availability (optional, but helpful for AI)
CREATE OR REPLACE FUNCTION check_username_available(requested_username TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE username = requested_username
  );
END;
$$;
