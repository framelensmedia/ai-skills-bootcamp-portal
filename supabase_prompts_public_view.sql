-- Update prompts_public view to ONLY show published prompts
-- Drafts are managed separately in the admin dashboard

DROP VIEW IF EXISTS prompts_public CASCADE;

CREATE OR REPLACE VIEW prompts_public AS
SELECT 
  id,
  title,
  slug,
  summary,
  access_level,
  image_url,
  featured_image_url,
  media_url,
  category,
  created_at,
  is_published,
  status
FROM prompts
WHERE is_published = true;

-- Grant SELECT on the view
GRANT SELECT ON prompts_public TO authenticated, anon;
