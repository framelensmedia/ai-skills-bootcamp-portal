-- Add prompt_id to video_generations to link Freestyle videos to their prompt template
ALTER TABLE video_generations ADD COLUMN IF NOT EXISTS prompt_id uuid REFERENCES prompts(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_video_generations_prompt_id ON video_generations(prompt_id);
