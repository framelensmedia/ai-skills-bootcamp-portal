-- ============================================================
-- REMIX LINEAGE & TRENDING ALGORITHM MIGRATION
-- ============================================================
-- Implements parent-child tracking for viral remixes and 
-- time-weighted trending algorithm based on engagement velocity
-- ============================================================

-- Step 1: Add Lineage Fields to prompt_generations
-- ============================================================
ALTER TABLE prompt_generations 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES prompt_generations(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS remix_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS favorites_count INTEGER DEFAULT 0;

-- Step 2: Create Auto-Increment Trigger for Remix Count
-- ============================================================
-- When a remix is created (has parent_id), auto-increment parent's remix_count
CREATE OR REPLACE FUNCTION increment_parent_remix()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    UPDATE prompt_generations 
    SET remix_count = remix_count + 1 
    WHERE id = NEW.parent_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_increment_remix ON prompt_generations;
CREATE TRIGGER trg_increment_remix
AFTER INSERT ON prompt_generations
FOR EACH ROW EXECUTE FUNCTION increment_parent_remix();

-- Step 3: Create Engagement Logs Table for Algorithm
-- ============================================================
-- Centralized event stream capturing all engagement signals
CREATE TABLE IF NOT EXISTS engagement_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id UUID NOT NULL REFERENCES prompt_generations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('upvote', 'favorite', 'remix')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Step 4: Create Indexes for Performance
-- ============================================================
-- Critical for trending queries (time-decay calculations)
CREATE INDEX IF NOT EXISTS idx_engagement_velocity 
  ON engagement_logs (generation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_engagement_type 
  ON engagement_logs (type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_asset_lineage 
  ON prompt_generations (parent_id) 
  WHERE parent_id IS NOT NULL;

-- Step 5: Auto-Increment Favorites Count Trigger
-- ============================================================
-- Triggered by prompt_favorites table (generation_id column)
CREATE OR REPLACE FUNCTION update_favorites_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.generation_id IS NOT NULL) THEN
    UPDATE prompt_generations 
    SET favorites_count = favorites_count + 1 
    WHERE id = NEW.generation_id;
    
    -- Also log to engagement_logs for algorithm
    INSERT INTO engagement_logs (generation_id, user_id, type)
    VALUES (NEW.generation_id, NEW.user_id, 'favorite');
    
  ELSIF (TG_OP = 'DELETE' AND OLD.generation_id IS NOT NULL) THEN
    UPDATE prompt_generations 
    SET favorites_count = favorites_count - 1 
    WHERE id = OLD.generation_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_favorites_count ON prompt_favorites;
CREATE TRIGGER tr_favorites_count
AFTER INSERT OR DELETE ON prompt_favorites
FOR EACH ROW EXECUTE FUNCTION update_favorites_count();

-- Step 6: Enhance Upvote Trigger to Log Engagement
-- ============================================================
-- Modify existing upvote trigger to also log to engagement_logs
CREATE OR REPLACE FUNCTION update_remix_upvotes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE prompt_generations 
    SET upvotes_count = upvotes_count + 1 
    WHERE id = NEW.generation_id;
    
    -- Log to engagement_logs for algorithm
    INSERT INTO engagement_logs (generation_id, user_id, type)
    VALUES (NEW.generation_id, NEW.user_id, 'upvote');
    
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE prompt_generations 
    SET upvotes_count = upvotes_count - 1 
    WHERE id = OLD.generation_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create Trending Score View (Optional Helper)
-- ============================================================
-- Pre-calculated trending scores for fast queries
-- Formula: (Remixes × 5 + Upvotes × 1 + Favorites × 2) / (Hours_Since_Creation + 2)^1.5
CREATE OR REPLACE VIEW trending_generations AS
SELECT 
  pg.id,
  pg.image_url,
  pg.upvotes_count,
  pg.favorites_count,
  pg.remix_count,
  pg.created_at,
  pg.user_id,
  pg.prompt_id,
  -- Trending Score Calculation
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
ORDER BY trending_score DESC;

-- Step 8: Enable RLS for engagement_logs
-- ============================================================
ALTER TABLE engagement_logs ENABLE ROW LEVEL SECURITY;

-- Allow users to view engagement logs
CREATE POLICY "Anyone can view engagement logs"
  ON engagement_logs FOR SELECT
  USING (true);

-- Only system can insert (via triggers) - users cannot directly insert
-- This prevents gaming the algorithm
CREATE POLICY "System only inserts"
  ON engagement_logs FOR INSERT
  WITH CHECK (false);

-- Step 9: Backfill existing favorites_count (optional)
-- ============================================================
-- Count existing favorites and update prompt_generations
UPDATE prompt_generations pg
SET favorites_count = (
  SELECT COUNT(*)
  FROM prompt_favorites pf
  WHERE pf.generation_id = pg.id
)
WHERE favorites_count = 0;

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
-- Next steps:
-- 1. Update StudioCommunityFeed.tsx to query trending_generations view
-- 2. Add favorite buttons to RemixCard.tsx
-- 3. Update app/prompts/[slug]/page.tsx to show remixes (parent_id = prompt.id)
-- ============================================================
