-- Migration for Social Media Scheduler and Connected Accounts
-- This adds the necessary tables to store OAuth tokens and scheduled posts.

-- 1. Create Social Accounts Table
CREATE TABLE IF NOT EXISTS public.social_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID, -- For future Agency Plan multi-tenant scaling
    platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'tiktok')),
    access_token TEXT NOT NULL,
    account_id TEXT NOT NULL, -- Specific Page ID or User ID on the platform
    account_name TEXT, -- Display Name 
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, platform, account_id)
);

-- Turn on RLS for social_accounts
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own social accounts"
    ON public.social_accounts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own social accounts"
    ON public.social_accounts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own social accounts"
    ON public.social_accounts FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own social accounts"
    ON public.social_accounts FOR DELETE
    USING (auth.uid() = user_id);

-- 2. Create Scheduled Posts Table
CREATE TABLE IF NOT EXISTS public.scheduled_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID,
    asset_id UUID, -- Optional foreign key to assets table
    asset_url TEXT NOT NULL, -- Public or signed URL of the media
    caption TEXT,
    platforms JSONB NOT NULL DEFAULT '[]'::jsonb, -- e.g., ["instagram", "facebook"]
    scheduled_for TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'publishing', 'posted', 'failed')),
    platform_responses JSONB, -- Stores the returned Post IDs or error messages
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Turn on RLS for scheduled_posts
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scheduled posts"
    ON public.scheduled_posts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scheduled posts"
    ON public.scheduled_posts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scheduled posts"
    ON public.scheduled_posts FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scheduled posts"
    ON public.scheduled_posts FOR DELETE
    USING (auth.uid() = user_id);

-- Add Triggers for updated_at
CREATE OR REPLACE FUNCTION update_social_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_social_accounts_timestamp
BEFORE UPDATE ON public.social_accounts
FOR EACH ROW
EXECUTE FUNCTION update_social_accounts_updated_at();

CREATE TRIGGER update_scheduled_posts_timestamp
BEFORE UPDATE ON public.scheduled_posts
FOR EACH ROW
EXECUTE FUNCTION update_social_accounts_updated_at();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_social_user ON public.social_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_workspace ON public.social_accounts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_user ON public.scheduled_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_workspace ON public.scheduled_posts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_status_time ON public.scheduled_posts(status, scheduled_for);
