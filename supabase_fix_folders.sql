-- 1. Ensure the folder_id column exists
ALTER TABLE prompt_generations ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;
ALTER TABLE prompt_favorites ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;

-- 2. Drop existing update policy if it exists to clean up
DROP POLICY IF EXISTS "Users can update their own generations" ON prompt_generations;
DROP POLICY IF EXISTS "Users can update their own favorites" ON prompt_favorites;

-- 3. Create the update policy
CREATE POLICY "Users can update their own generations"
ON prompt_generations
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own favorites"
ON prompt_favorites
FOR UPDATE
USING (auth.uid() = user_id);

-- 4. Ensure folders table policies are correct too
DROP POLICY IF EXISTS "Users can view their own folders" ON folders;
CREATE POLICY "Users can view their own folders" ON folders FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own folders" ON folders;
CREATE POLICY "Users can insert their own folders" ON folders FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own folders" ON folders;
CREATE POLICY "Users can update their own folders" ON folders FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own folders" ON folders;
CREATE POLICY "Users can delete their own folders" ON folders FOR DELETE USING (auth.uid() = user_id);
