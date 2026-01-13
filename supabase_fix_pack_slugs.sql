-- Fix missing slugs for template packs

-- Update slugs that are null or empty
UPDATE template_packs
SET slug = lower(regexp_replace(pack_name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL OR slug = '';

-- Ensure no trailing/leading dashes
UPDATE template_packs
SET slug = trim(both '-' from slug)
WHERE slug IS NULL OR slug = '';

-- Fallback for extremely short or empty names (use ID)
UPDATE template_packs
SET slug = 'pack-' || id
WHERE slug IS NULL OR slug = '';
