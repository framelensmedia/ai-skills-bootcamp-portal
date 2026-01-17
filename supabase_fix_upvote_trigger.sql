-- 1. Ensure columns exist
ALTER TABLE prompt_generations ADD COLUMN IF NOT EXISTS upvotes_count INTEGER DEFAULT 0;

-- 2. Ensure upvotes table exists
CREATE TABLE IF NOT EXISTS remix_upvotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    generation_id UUID REFERENCES prompt_generations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, generation_id)
);

-- 3. RLS Policies for remix_upvotes (ensure they exist)
ALTER TABLE remix_upvotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Upvote access" ON remix_upvotes;
DROP POLICY IF EXISTS "Users can insert their own upvotes" ON remix_upvotes;
DROP POLICY IF EXISTS "Users can delete their own upvotes" ON remix_upvotes;
DROP POLICY IF EXISTS "Users can select all upvotes" ON remix_upvotes;

-- Create granular policies
CREATE POLICY "Users can select all upvotes" 
ON remix_upvotes FOR SELECT 
USING (true);

CREATE POLICY "Users can insert their own upvotes" 
ON remix_upvotes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own upvotes" 
ON remix_upvotes FOR DELETE 
USING (auth.uid() = user_id);


-- 4. Create/Refresh Trigger Function
CREATE OR REPLACE FUNCTION update_remix_upvotes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE prompt_generations 
        SET upvotes_count = upvotes_count + 1 
        WHERE id = NEW.generation_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE prompt_generations 
        SET upvotes_count = GREATEST(0, upvotes_count - 1) 
        WHERE id = OLD.generation_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Drop and Re-create Trigger
DROP TRIGGER IF EXISTS tr_remix_upvotes_count ON remix_upvotes;
CREATE TRIGGER tr_remix_upvotes_count
AFTER INSERT OR DELETE ON remix_upvotes
FOR EACH ROW EXECUTE FUNCTION update_remix_upvotes_count();

-- 6. SYNC DATA: Recalculate all upvote counts to fix inconsistencies
-- This is crucial for fixing the "Active Upvote, Count 0" bug
WITH real_counts AS (
    SELECT generation_id, COUNT(*) as count 
    FROM remix_upvotes 
    GROUP BY generation_id
)
UPDATE prompt_generations pg
SET upvotes_count = rc.count
FROM real_counts rc
WHERE pg.id = rc.generation_id;
