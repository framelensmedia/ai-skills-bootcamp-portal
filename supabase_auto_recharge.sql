-- Auto-Recharge Feature: Add columns to profiles table
-- Run this in Supabase SQL Editor

-- Add auto-recharge preference columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auto_recharge_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auto_recharge_pack_id TEXT DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auto_recharge_threshold INTEGER DEFAULT 10;

-- Add index for efficient querying of users with auto-recharge enabled
CREATE INDEX IF NOT EXISTS idx_profiles_auto_recharge ON profiles (auto_recharge_enabled) WHERE auto_recharge_enabled = TRUE;

-- Comment for documentation
COMMENT ON COLUMN profiles.auto_recharge_enabled IS 'Whether user has enabled automatic credit top-up';
COMMENT ON COLUMN profiles.auto_recharge_pack_id IS 'Which credit pack to auto-purchase (credits_50, credits_120, credits_300)';
COMMENT ON COLUMN profiles.auto_recharge_threshold IS 'Credit balance threshold that triggers auto-recharge';
