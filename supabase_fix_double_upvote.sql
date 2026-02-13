-- ============================================================
-- FIX: DOUBLE UPVOTE COUNT BUG
-- ============================================================
-- Diagnose: List all triggers on remix_upvotes
-- Run this SELECT first to see what triggers exist:
-- ============================================================

-- Step 1: Diagnostic query - run this first to see all triggers
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'remix_upvotes';

-- Step 2: Drop ALL triggers on remix_upvotes, then recreate just ONE
DROP TRIGGER IF EXISTS tr_remix_upvotes_count ON remix_upvotes;
DROP TRIGGER IF EXISTS trg_remix_upvotes_count ON remix_upvotes;

-- Step 3: Recreate the single, clean trigger function
CREATE OR REPLACE FUNCTION update_remix_upvotes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE prompt_generations 
    SET upvotes_count = upvotes_count + 1 
    WHERE id = NEW.generation_id;
    
    -- Log to engagement_logs for trending algorithm
    INSERT INTO engagement_logs (generation_id, user_id, type)
    VALUES (NEW.generation_id, NEW.user_id, 'upvote');
    
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE prompt_generations 
    SET upvotes_count = GREATEST(0, upvotes_count - 1) 
    WHERE id = OLD.generation_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create exactly ONE trigger
CREATE TRIGGER tr_remix_upvotes_count
AFTER INSERT OR DELETE ON remix_upvotes
FOR EACH ROW EXECUTE FUNCTION update_remix_upvotes_count();

-- Step 5: Resync all upvote counts to fix any existing inconsistencies
WITH real_counts AS (
    SELECT generation_id, COUNT(*) as count 
    FROM remix_upvotes 
    GROUP BY generation_id
)
UPDATE prompt_generations pg
SET upvotes_count = COALESCE(rc.count, 0)
FROM real_counts rc
WHERE pg.id = rc.generation_id;

-- Also reset any that have no upvotes but have a non-zero count
UPDATE prompt_generations 
SET upvotes_count = 0
WHERE upvotes_count > 0
AND id NOT IN (SELECT DISTINCT generation_id FROM remix_upvotes);
