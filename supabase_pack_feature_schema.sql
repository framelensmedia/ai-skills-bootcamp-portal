-- Step 1: Database Schema Updates for Prompt Packs Feature
-- Add missing columns for pack thumbnails and template ordering

-- 1. Add thumbnail_url to template_packs
ALTER TABLE template_packs 
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- 2. Add pack_order_index to prompts for ordering templates within a pack
ALTER TABLE prompts 
  ADD COLUMN IF NOT EXISTS pack_order_index INTEGER DEFAULT 0;

-- 3. Create index for efficient pack queries
CREATE INDEX IF NOT EXISTS idx_prompts_pack_id ON prompts(template_pack_id) WHERE template_pack_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_template_packs_published ON template_packs(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_template_packs_slug ON template_packs(slug);

-- 4. Add access_level to template_packs if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'template_packs' AND column_name = 'access_level'
  ) THEN
    ALTER TABLE template_packs ADD COLUMN access_level TEXT DEFAULT 'free';
  END IF;
END $$;

-- 5. Add is_published to template_packs if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'template_packs' AND column_name = 'is_published'
  ) THEN
    ALTER TABLE template_packs ADD COLUMN is_published BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 6. Verify the schema
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'template_packs'
ORDER BY ordinal_position;
