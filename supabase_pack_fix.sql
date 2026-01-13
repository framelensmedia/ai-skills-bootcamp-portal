-- Fix template_packs schema for drop_announcement (Object -> JSONB)
ALTER TABLE template_packs 
ALTER COLUMN drop_announcement TYPE JSONB USING drop_announcement::JSONB;

-- Ensure prompts table has all new fields from the JSON spec
DO $$ 
BEGIN
  -- style_mode
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompts' AND column_name = 'style_mode') THEN
    ALTER TABLE prompts ADD COLUMN style_mode TEXT;
  END IF;

  -- edit_mode
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompts' AND column_name = 'edit_mode') THEN
    ALTER TABLE prompts ADD COLUMN edit_mode TEXT;
  END IF;

  -- required_elements
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompts' AND column_name = 'required_elements') THEN
    ALTER TABLE prompts ADD COLUMN required_elements TEXT[] DEFAULT '{}';
  END IF;

  -- aspect_ratios
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompts' AND column_name = 'aspect_ratios') THEN
    ALTER TABLE prompts ADD COLUMN aspect_ratios TEXT[] DEFAULT '{}';
  END IF;

  -- template_id (distinct from slug? usually same, but payload has both)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompts' AND column_name = 'template_id') THEN
    ALTER TABLE prompts ADD COLUMN template_id TEXT;
  END IF;
END $$;
