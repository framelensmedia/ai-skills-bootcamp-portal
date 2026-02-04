-- 1. Add likes_count to prompt_generations if missing
ALTER TABLE prompt_generations 
ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;

-- 2. Create prompt_likes table
CREATE TABLE IF NOT EXISTS prompt_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  generation_id UUID REFERENCES prompt_generations(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, generation_id)
);

-- 3. Enable RLS
ALTER TABLE prompt_likes ENABLE ROW LEVEL SECURITY;

-- 4. Policies for prompt_likes
-- Drop existing policies to avoid errors if re-running
DROP POLICY IF EXISTS "Users can view all likes" ON prompt_likes;
DROP POLICY IF EXISTS "Users can insert their own likes" ON prompt_likes;
DROP POLICY IF EXISTS "Users can delete their own likes" ON prompt_likes;

CREATE POLICY "Users can view all likes" 
ON prompt_likes FOR SELECT 
USING (true);

CREATE POLICY "Users can insert their own likes" 
ON prompt_likes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes" 
ON prompt_likes FOR DELETE 
USING (auth.uid() = user_id);

-- 5. RPC Functions
CREATE OR REPLACE FUNCTION increment_generation_likes(row_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE prompt_generations
  SET likes_count = likes_count + 1
  WHERE id = row_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrement_generation_likes(row_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE prompt_generations
  SET likes_count = GREATEST(0, likes_count - 1)
  WHERE id = row_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
