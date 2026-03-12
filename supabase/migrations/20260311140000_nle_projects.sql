-- Migration: NLE Projects
-- Description: Creates a table to store NLE editor projects with auto-draft support.

-- 1. Create table for NLE projects
CREATE TABLE IF NOT EXISTS public.nle_projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Untitled Project',
    data JSONB NOT NULL DEFAULT '{}',
    is_draft BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_nle_projects_user_id ON public.nle_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_nle_projects_updated ON public.nle_projects(updated_at DESC);

-- Enable RLS
ALTER TABLE public.nle_projects ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own NLE projects"
ON public.nle_projects FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own NLE projects"
ON public.nle_projects FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own NLE projects"
ON public.nle_projects FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own NLE projects"
ON public.nle_projects FOR DELETE
USING (auth.uid() = user_id);

-- Auto-update updated_at on every UPDATE
CREATE OR REPLACE FUNCTION update_nle_project_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_nle_project_updated_at
    BEFORE UPDATE ON public.nle_projects
    FOR EACH ROW
    EXECUTE FUNCTION update_nle_project_timestamp();
