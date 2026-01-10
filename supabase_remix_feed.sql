-- 1. Extend prompt_generations with visibility and performance fields
ALTER TABLE prompt_generations ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE;
ALTER TABLE prompt_generations ADD COLUMN IF NOT EXISTS upvotes_count INTEGER DEFAULT 0;

-- 2. Create upvotes table
CREATE TABLE IF NOT EXISTS remix_upvotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    generation_id UUID REFERENCES prompt_generations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, generation_id)
);

-- 3. Extend profiles with profile image
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_image TEXT;

-- 4. Trigger for upvote count synchronization
CREATE OR REPLACE FUNCTION update_remix_upvotes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE prompt_generations SET upvotes_count = upvotes_count + 1 WHERE id = NEW.generation_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE prompt_generations SET upvotes_count = upvotes_count - 1 WHERE id = OLD.generation_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_remix_upvotes_count ON remix_upvotes;
CREATE TRIGGER tr_remix_upvotes_count
AFTER INSERT OR DELETE ON remix_upvotes
FOR EACH ROW EXECUTE FUNCTION update_remix_upvotes_count();

-- 5. RLS Policies
ALTER TABLE remix_upvotes ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view public generations
DROP POLICY IF EXISTS "Feed visibility" ON prompt_generations;
CREATE POLICY "Feed visibility" ON prompt_generations
    FOR SELECT USING (auth.role() = 'authenticated' AND (is_public = TRUE OR auth.uid() = user_id));

-- Allow users to upvote
DROP POLICY IF EXISTS "Upvote access" ON remix_upvotes;
CREATE POLICY "Upvote access" ON remix_upvotes
    FOR ALL USING (auth.role() = 'authenticated');

-- Policies for profiles update (if not existing)
CREATE POLICY "Users can update own profile image" ON profiles
    FOR UPDATE USING (auth.uid() = user_id);
