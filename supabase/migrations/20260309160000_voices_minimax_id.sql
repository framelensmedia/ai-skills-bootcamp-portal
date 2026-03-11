-- Add minimax_voice_id column to voices table
-- This caches the MiniMax custom_voice_id after the first clone
-- so we don't pay $1.50 per generation (only per unique voice registration)

ALTER TABLE public.voices
ADD COLUMN IF NOT EXISTS minimax_voice_id TEXT;

COMMENT ON COLUMN public.voices.minimax_voice_id IS 
'MiniMax custom_voice_id registered via fal-ai/minimax/voice-clone. Cached to avoid repeat $1.50 clone fees.';
