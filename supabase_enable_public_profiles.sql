-- Enable public read access to profiles so creator info can be seen by everyone
-- This is often key for "Community Feed" or sharing features

-- 1. Ensure RLS is enabled (usually is, but good to be safe)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 2. Create policy to allow SELECT for everyone (anon and authenticated)
--    IF policy already exists, this might fail, so we can drop it first or just add IF NOT EXISTS equivalent logic manually
--    Supabase SQL editor handles simple attempts well.

DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON profiles;

CREATE POLICY "Public profiles are viewable by everyone."
ON profiles FOR SELECT
USING ( true );
