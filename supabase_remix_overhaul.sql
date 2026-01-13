-- Remix Overhaul: Add new columns to prompts table

ALTER TABLE prompts 
ADD COLUMN IF NOT EXISTS template_config_json JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS public_prompt TEXT,
ADD COLUMN IF NOT EXISTS system_rules TEXT,
ADD COLUMN IF NOT EXISTS subject_mode TEXT DEFAULT 'non_human';

-- Ensure pack_only is present (it was in previous setup but good to be sure)
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS pack_only BOOLEAN DEFAULT false;
