-- Force update prompts_public view
-- First, drop the view to ensure we are starting fresh
DROP VIEW IF EXISTS prompts_public CASCADE;

-- Recreate the view with the JOIN to get pack_name
CREATE OR REPLACE VIEW prompts_public AS
SELECT 
  p.id,
  p.title,
  p.slug,
  p.summary,
  p.access_level,
  p.image_url,
  p.featured_image_url,
  p.media_url,
  p.category,
  p.created_at,
  p.is_published,
  p.status,
  p.template_pack_id,
  p.pack_order_index,
  tp.pack_name,
  tp.slug as pack_slug
FROM prompts p
LEFT JOIN template_packs tp ON p.template_pack_id = tp.id
WHERE p.is_published = true;

-- Grant permissions again since dropping CASCADE removes them
GRANT SELECT ON prompts_public TO authenticated, anon;
