-- ============================================================
-- PHASE 2: AI OPERATING SYSTEM MIGRATION
-- ============================================================
-- 1. Vector Readiness
-- 2. Identity Vault (with Soft Delete)
-- 3. Business Genie (with Soft Delete)
-- 4. Media Pipeline (Unified Assets)
-- 5. Usage Tracking (Investor-Grade)
-- ============================================================

-- 1. Vector Readiness
-- ============================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Identity & Likeness (InstantID / Reference Mode)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  identity_type TEXT DEFAULT 'human_likeness', -- 'human', 'character', 'product'
  ref_image_url TEXT NOT NULL,
  face_vector_id TEXT, -- For matching geometry across gens
  consent_granted_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  metadata JSONB, -- Stores style preferences
  created_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ -- Soft Delete for Privacy-by-Design
);

-- Index for searching active identities
CREATE INDEX IF NOT EXISTS idx_identities_user_active 
ON user_identities(user_id) 
WHERE deleted_at IS NULL;

-- 3. Business Genie Blueprints (Global Context)
-- ============================================================
CREATE TABLE IF NOT EXISTS business_blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT,
  target_audience TEXT,
  uvp TEXT, -- Unique Value Proposition
  brand_tone TEXT,
  industry_niche TEXT,
  raw_genie_output JSONB, -- Record of strategy
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ -- Soft Delete
);

-- Index for blueprints
CREATE INDEX IF NOT EXISTS idx_blueprint_user_active
ON business_blueprints(user_id)
WHERE deleted_at IS NULL;

-- 4. Media Production Pipeline (Stateful Assets)
-- ============================================================
-- Unified assets table.
-- If prompt_generations exists, we might eventually migrate it here.
-- For now, we create 'assets' as the new standard API.
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    asset_type TEXT NOT NULL, -- 'script', 'voiceover', 'image', 'video'
    content_url TEXT, -- The file/resource URL
    
    -- Content / Prompt Data
    prompt TEXT,
    system_prompt TEXT, -- For context injection
    
    -- Lineage
    parent_id UUID REFERENCES assets(id), -- Remix lineage
    
    -- Pipeline Links
    source_script_id UUID REFERENCES assets(id),
    source_voice_id UUID REFERENCES assets(id),
    
    -- Reproducibility
    generation_params JSONB, -- Exact seeds/settings
    
    -- Async Job Status
    job_id TEXT, -- External Job ID (e.g. Vertex)
    job_status TEXT DEFAULT 'completed', -- 'pending', 'processing', 'completed', 'failed'
    
    encryption_key_id TEXT, -- Future proofing
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ -- Soft Delete
);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_assets_updated_at
BEFORE UPDATE ON assets
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 5. Investor-Grade Usage Tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  asset_id UUID REFERENCES assets(id), -- Linked to the asset produced
  
  -- Model Details
  model_name TEXT NOT NULL, -- 'gemini-1.5-flash', 'veo-3.1', 'eleven-labs'
  provider TEXT NOT NULL, -- 'google', 'elevenlabs', 'openai'
  
  -- Metrics
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  duration_seconds DECIMAL(10, 2), -- For audio/video billing
  
  -- Cost
  estimated_cost_usd DECIMAL(12, 6),
  
  meta JSONB, -- Any extra provider-specific log data
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for Usage Analysis
CREATE INDEX IF NOT EXISTS idx_usage_cost_analysis 
ON usage_logs(model_name, estimated_cost_usd);

CREATE INDEX IF NOT EXISTS idx_usage_user_date
ON usage_logs(user_id, created_at DESC);

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
