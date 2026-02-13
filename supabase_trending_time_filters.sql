-- ============================================================
-- SMART FEED TIME FILTERS
-- ============================================================
-- Creates time-filtered trending views for Today, This Week, All Time
-- Uses the same trending algorithm with different time windows
-- ============================================================

-- View 1: Trending Today (Last 24 Hours)
-- ============================================================
CREATE OR REPLACE VIEW trending_today AS
SELECT 
  pg.id,
  pg.image_url,
  pg.upvotes_count,
  pg.favorites_count,
  pg.remix_count,
  pg.created_at,
  pg.user_id,
  pg.prompt_id,
  -- Trending Score Calculation (same formula)
  (
    (COALESCE(pg.remix_count, 0) * 5) + 
    (COALESCE(pg.upvotes_count, 0) * 1) + 
    (COALESCE(pg.favorites_count, 0) * 2)
  )::FLOAT / 
  POWER(
    (EXTRACT(EPOCH FROM (NOW() - pg.created_at)) / 3600.0) + 2, 
    1.5
  ) AS trending_score
FROM prompt_generations pg
WHERE pg.is_public = TRUE
  AND pg.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY trending_score DESC;

-- View 2: Trending This Week (Last 7 Days)
-- ============================================================
CREATE OR REPLACE VIEW trending_week AS
SELECT 
  pg.id,
  pg.image_url,
  pg.upvotes_count,
  pg.favorites_count,
  pg.remix_count,
  pg.created_at,
  pg.user_id,
  pg.prompt_id,
  -- Trending Score Calculation (same formula)
  (
    (COALESCE(pg.remix_count, 0) * 5) + 
    (COALESCE(pg.upvotes_count, 0) * 1) + 
    (COALESCE(pg.favorites_count, 0) * 2)
  )::FLOAT / 
  POWER(
    (EXTRACT(EPOCH FROM (NOW() - pg.created_at)) / 3600.0) + 2, 
    1.5
  ) AS trending_score
FROM prompt_generations pg
WHERE pg.is_public = TRUE
  AND pg.created_at >= NOW() - INTERVAL '7 days'
ORDER BY trending_score DESC;

-- Note: trending_all_time already exists as trending_generations view
-- Created in supabase_remix_lineage_algorithm.sql

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================
-- Test each view returns data:
-- SELECT COUNT(*) FROM trending_today;
-- SELECT COUNT(*) FROM trending_week;
-- SELECT COUNT(*) FROM trending_generations;
-- ============================================================
