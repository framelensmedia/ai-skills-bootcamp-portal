-- Add generation_id to prompt_favorites to allow saving Remixes
ALTER TABLE prompt_favorites ADD COLUMN IF NOT EXISTS generation_id UUID REFERENCES prompt_generations(id) ON DELETE CASCADE;

-- Ensure users can't favorite the same generation twice
CREATE UNIQUE INDEX IF NOT EXISTS idx_favorites_generation ON prompt_favorites(user_id, generation_id) WHERE generation_id IS NOT NULL;

-- Policy (update existing or create new)
-- Ensure insert/select works for generation_id
DROP POLICY IF EXISTS "Users can view their own favorites" ON prompt_favorites;
CREATE POLICY "Users can view their own favorites" ON prompt_favorites FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own favorites" ON prompt_favorites;
CREATE POLICY "Users can insert their own favorites" ON prompt_favorites FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own favorites" ON prompt_favorites;
CREATE POLICY "Users can delete their own favorites" ON prompt_favorites FOR DELETE USING (auth.uid() = user_id);
