-- Add missing columns to template_packs table
ALTER TABLE template_packs 
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS version TEXT,
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_image_url TEXT;

-- Copy data from old columns to new ones if they exist and new ones are empty
UPDATE template_packs 
SET 
  title = COALESCE(title, pack_name),
  slug = COALESCE(slug, pack_id),
  summary = COALESCE(summary, pack_description)
WHERE title IS NULL OR slug IS NULL OR summary IS NULL;

-- Now we can optionally drop the old columns (commented out for safety)
-- ALTER TABLE template_packs DROP COLUMN IF EXISTS pack_id;
-- ALTER TABLE template_packs DROP COLUMN IF EXISTS pack_name;
-- ALTER TABLE template_packs DROP COLUMN IF EXISTS pack_description;
