-- add discord_user_id to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS discord_user_id text;
