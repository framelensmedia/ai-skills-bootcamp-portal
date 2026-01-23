-- =====================================================
-- VIDEO UPVOTE TRIGGERS
-- =====================================================

-- 1. Create Trigger Function for Videos
CREATE OR REPLACE FUNCTION update_video_upvotes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE video_generations 
        SET upvotes_count = upvotes_count + 1 
        WHERE id = NEW.video_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE video_generations 
        SET upvotes_count = GREATEST(0, upvotes_count - 1) 
        WHERE id = OLD.video_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create Trigger
DROP TRIGGER IF EXISTS tr_video_upvotes_count ON video_upvotes;
CREATE TRIGGER tr_video_upvotes_count
AFTER INSERT OR DELETE ON video_upvotes
FOR EACH ROW EXECUTE FUNCTION update_video_upvotes_count();

-- 3. SYNC DATA: Recalculate upvote counts to ensure consistency
WITH real_counts AS (
    SELECT video_id, COUNT(*) as count 
    FROM video_upvotes 
    GROUP BY video_id
)
UPDATE video_generations vg
SET upvotes_count = rc.count
FROM real_counts rc
WHERE vg.id = rc.video_id;
