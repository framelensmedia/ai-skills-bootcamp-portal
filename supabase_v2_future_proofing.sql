
-- ============================================================
-- PHASE 3: V2 FUTURE-PROOFING
-- ============================================================

-- 1. Agentic Memory & Business Genie
-- ============================================================
-- Function to retrieve Business DNA for a user (serving as workspace context for now)
CREATE OR REPLACE FUNCTION public.get_blueprint_context(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_blueprint RECORD;
    v_context TEXT;
BEGIN
    SELECT * INTO v_blueprint 
    FROM public.business_blueprints 
    WHERE user_id = p_user_id 
    AND deleted_at IS NULL 
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN 'No business blueprint found. Please configure your Business Genie settings.';
    END IF;

    v_context := format(
        'Business Name: %s\nTarget Audience: %s\nUnique Value Proposition: %s\nBrand Tone: %s\nIndustry: %s',
        v_blueprint.business_name,
        v_blueprint.target_audience,
        v_blueprint.uvp,
        v_blueprint.brand_tone,
        v_blueprint.industry_niche
    );

    IF v_blueprint.raw_genie_output IS NOT NULL THEN
        v_context := v_context || E'\n\nDetailed Strategy:\n' || (v_blueprint.raw_genie_output->>'strategy_summary');
    END IF;

    RETURN v_context;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Social Media Scheduling (Prep)
-- ============================================================
-- Enable Vault for secure token storage. 
-- We remove "WITH SCHEMA vault" to avoid permission errors if user cannot create schemas.
-- Supabase defaults usually put this in extensions or public.
CREATE EXTENSION IF NOT EXISTS "supabase_vault";

-- Distribution Queue
CREATE TABLE IF NOT EXISTS public.content_distribution_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    platform_targets JSONB NOT NULL, -- e.g. ["linkedin", "twitter"]
    scheduled_at TIMESTAMPTZ,
    status TEXT DEFAULT 'draft', -- 'draft', 'scheduled', 'posted', 'failed'
    
    result_logs JSONB DEFAULT '{}', -- Store API responses/errors
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for the cron job to pick up pending items
CREATE INDEX IF NOT EXISTS idx_distribution_queue_scheduled
ON public.content_distribution_queue(status, scheduled_at)
WHERE status = 'scheduled';

-- 3. OpenClaw Command-to-Canvas (Drafts)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.draft_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    artifact_type TEXT NOT NULL, -- 'script', 'image_preview', 'canvas_layout'
    content JSONB NOT NULL, -- The transient data
    metadata JSONB DEFAULT '{}', -- Elastic schema for drafts
    
    status TEXT DEFAULT 'active', -- 'active', 'converted', 'discarded'
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Elastic Schema (The Flex Zones)
-- ============================================================
-- Add metadata to core tables
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'metadata') THEN
        ALTER TABLE public.profiles ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'metadata') THEN
        ALTER TABLE public.assets ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
END $$;

-- General Storage (Unstructured Reservoir)
CREATE TABLE IF NOT EXISTS public.general_storage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    category TEXT NOT NULL, -- e.g. 'competitor_analysis', 'goal_tracking'
    data JSONB NOT NULL DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_general_storage_category
ON public.general_storage(user_id, category);

-- 5. Identity Preservation (Fake LoRA)
-- ============================================================
-- Add is_primary to user_identities
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_identities' AND column_name = 'is_primary') THEN
        ALTER TABLE public.user_identities ADD COLUMN is_primary BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Ensure only one primary identity per user (Optional unique index, but logic might settle on 'latest primary')
-- For now, let's add a partial index
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_identities_primary
ON public.user_identities(user_id)
WHERE is_primary = true AND deleted_at IS NULL;
