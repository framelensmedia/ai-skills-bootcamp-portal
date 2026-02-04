-- Add user_id column to prompts table to track creator
ALTER TABLE prompts 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Optional: Create an index for faster lookups by user (e.g. "My Prompts")
CREATE INDEX IF NOT EXISTS idx_prompts_user_id ON prompts(user_id);
